# ApparelFlow ERP: Cutting Verification & Sewing Queue Gate

Full-stack implementation of the **Cutting Operations & Gatekeeper Verification Terminal** for Webtezza's ApparelFlow ERP. A cutting batch can never reach the Sewing Queue unless a Cutting Verifier has counted every component and none is short. The rule is enforced on the server, not in the UI.

- **Live app:** https://apparelflow-pi.vercel.app
- **Repository:** https://github.com/Duleepa01/apparelflow
- **AI usage report:** [AI_OPTIMIZATION_REPORT.md](./AI_OPTIMIZATION_REPORT.md)

## Demo credentials

All three accounts use the password **`Demo@1234`**. A role switcher in the header (and a demo panel on the login page) signs in as any persona through the real login API.

| Role | Email | Can do | Cannot do |
|---|---|---|---|
| Cutting Supervisor (`cutting_supervisor`) | supervisor@apparelflow.demo | Create cutting orders, log fabric, view own orders, resubmit rejected orders | Verify batches, open the Sewing Queue |
| Cutting Verifier (`cutting_verifier`) | verifier@apparelflow.demo | Count components, approve or reject batches | Create orders, open the Sewing Queue |
| Sewing Supervisor (`sewing_supervisor`) | sewing@apparelflow.demo | View verified batches and audit notes, start sewing | See pending or rejected orders |

These credentials are public on purpose (the assessment requires demo access). Never publish real accounts this way.

## Tech stack

Next.js 16 (App Router, Route Handlers) · TypeScript · Tailwind CSS v4 · PostgreSQL (Supabase) via `pg` with plain SQL · `jose` (JWT) + `bcryptjs` · Vitest · Vercel

## Workflow and state machine

```
PENDING_VERIFICATION --approve (verifier, no RED/uncounted)--> VERIFIED --start (sewing)--> SEWING_STARTED
PENDING_VERIFICATION --reject (verifier, note required)------> REJECTED --resubmit (supervisor)--> PENDING_VERIFICATION
```

Each transition is one guarded SQL statement or a row-locked transaction (`SELECT ... FOR UPDATE`), so two simultaneous requests cannot both succeed and no state can be skipped.

## API

| Endpoint | Role | Notes |
|---|---|---|
| `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me` | public / any | Sets or clears the session cookie |
| `GET /api/recipes` | supervisor, verifier | Recipes with components |
| `GET /api/orders`, `POST /api/orders` | supervisor | Create derives expected counts server-side |
| `POST /api/orders/[id]/resubmit` | supervisor | Only from `REJECTED`; clears old counts |
| `GET /api/verification/orders`, `GET /api/verification/orders/[id]` | verifier | Pending queue and order detail |
| `PUT /api/verification/orders/[id]/counts` | verifier | Server computes GREEN/YELLOW/RED |
| `POST /api/verification/orders/[id]/approve` | verifier | The hard stop |
| `POST /api/verification/orders/[id]/reject` | verifier | Non-empty note required |
| `GET /api/sewing/queue` | sewing | `WHERE status = 'VERIFIED'` in SQL |
| `POST /api/sewing/orders/[id]/start` | sewing | Only from `VERIFIED` |

Status codes: `400` validation, `401` not signed in, `403` wrong role, `404` not found, `409` invalid state transition, `422` business rule (shortage, uncounted, unknown component).

## Security and defensive design

All rules live on the server. Disabled buttons, hidden links and redirects are only UX.

- **Server-side RBAC:** every handler starts with `requireRole(...)`, which verifies the signed JWT (HS256, 8 h, `httpOnly`, `sameSite=lax`, `secure` in production). A supervisor calling approve receives **403**.
- **Hard stop (422):** approve ignores the request body and the stored status flags. Inside a transaction it re-reads expected and actual quantities and rejects if any component is short **or uncounted** (`actual_qty IS NULL`).
- **Traffic lights are computed by the server:** the client only submits quantities. The SQL `CASE` assigns GREEN, YELLOW or RED, so a client cannot submit "GREEN".
- **Query isolation:** the sewing queue query hard-codes `WHERE status = 'VERIFIED'` and inner-joins an `APPROVED` log row. The endpoint reads no query parameters, so `?status=...` tricks have no effect.
- **Authenticated context:** verifier identity comes from the JWT and timestamps from the database clock. Neither is read from the request body.
- **Immutable audit trail:** on approval the verifier id, timestamp, wastage % and a per-component variance snapshot are written to `verification_logs`. A database trigger rejects `UPDATE` and `DELETE` on that table.
- **Database as a backstop:** `CHECK` constraints enforce positive quantities, valid statuses and roles, and a non-empty rejection note on `REJECTED` logs. Unique constraints stop duplicate items.
- **Row-level security** is enabled on every table with no policies, which closes Supabase's auto-generated REST API. The app connects as the `postgres` role, which bypasses RLS.
- **Strict input validation:** quantities must be whole numbers, yards a whole number of 1 or more, and roll IDs match `[A-Za-z0-9_-]{1,50}`. Strings, decimals, negatives and empty payloads are rejected (`400` with per-field messages shown inline in the UI).
- **Non-leaking responses:** starting sewing on a non-verified order returns `404`, so a sewing user cannot discover pending orders.

## Data model

| Table | Key columns |
|---|---|
| `users` | id, email (unique), password_hash (bcrypt), role, full_name, created_at |
| `recipes` | id, recipe_code (unique), name, category, std_fabric_yards, wastage_cap |
| `recipe_components` | id, recipe_id, component_name, pieces_per_garment, image_url |
| `cutting_orders` | id, order_no (unique), recipe_id, target_qty, fabric_roll_id, actual_fabric_yds, status, created_by, created_at, updated_at |
| `verification_items` | id, order_id, component_id, expected_qty, actual_qty (NULL = uncounted), status (GREEN/YELLOW/RED) |
| `verification_logs` | id, order_id, verifier_id, decision, rejection_note, wastage_pct, variances (JSONB), decided_at |

Seeded recipes: **REC-BL01 Casual Blouse** (1.8 yds, 5% cap) and **REC-CT02 Crop Top** (1.1 yds, 8% cap), with the components from the brief. The full schema is in [`db/schema.sql`](./db/schema.sql).

## Assumptions where the brief is silent

1. **Expected fabric** = `target_qty × std_fabric_yards`. Wastage % = `(actual − expected) ÷ expected × 100`, rounded to 2 decimals, computed in SQL on approval.
2. **Wastage cap** is shown to the verifier as information. The brief defines no blocking rule, so exceeding the cap does not block approval.
3. YELLOW (excess) components do not block approval, as specified.
4. New orders are submitted straight to `PENDING_VERIFICATION`. `CUTTING_IN_PROGRESS` is allowed by the schema but unused.
5. **Start Sewing Assembly** moves an order to `SEWING_STARTED`, which removes it from the queue.
6. **Rejected orders:** the supervisor sees the verifier's reason and can resubmit. Resubmit clears the old counts so the pieces must be recounted. The earlier `REJECTED` log row is kept.
7. Fabric yards are not editable on resubmit.
8. All quantities, including fabric yards, are whole numbers, following the brief’s rule that inputs reject decimals. Expected fabric and wastage % are still computed with decimals.

## Local setup

**Prerequisites:** Node 20.6+ and a PostgreSQL database (a free Supabase project works).

```bash
git clone https://github.com/<your-username>/apparelflow.git
cd apparelflow
npm install
cp .env.example .env.local   # then fill in the values
npm run db:setup             # creates tables and seeds users and recipes
npm run dev                  # http://localhost:3000
```

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string (use the Supabase **transaction pooler** string for Vercel) |
| `JWT_SECRET` | Signing secret, e.g. `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `TEST_DATABASE_URL` | A separate, empty Postgres database for the test suite |

`npm run db:setup` is safe to re-run.

## Tests

The suite calls the real route handlers with real JWTs against a **separate** database. Only the cookie store is mocked. The setup refuses to run unless `TEST_DATABASE_URL` is set and differs from `DATABASE_URL`, so tests cannot touch production data.

```bash
cp .env.example .env.test    # set TEST_DATABASE_URL to an EMPTY database
npm run db:setup:test
npm test
```

13 tests cover the five required cases and extra guards:

| Test | Verifies |
|---|---|
| 1 | An all-GREEN order is approved by a verifier, and the audit user comes from the session even if the body claims another id |
| 1b | YELLOW (excess) still allows approval |
| 2 / 2b | A RED or uncounted component blocks approval with 422 and writes no log |
| 3 | Reject without a note (missing, empty, whitespace, non-string) returns 400 |
| 4 | Supervisor and sewing roles get 403, anonymous gets 401 |
| 5 | Pending and rejected orders never appear in the sewing queue query, and only the sewing role can call the endpoint |
| Extras | Verifier cannot create orders · invalid payloads return 400 · re-approving or re-rejecting a verified order returns 409 · audit logs are immutable · resubmit rules and role checks |

## Deployment (Vercel)

Import the GitHub repo, set `DATABASE_URL` (transaction pooler) and `JWT_SECRET` in the project's environment variables, and deploy. Every push to `main` redeploys.

## Verification performed

- **Live API checks** against the deployed URL with direct requests: 23 checks covering anonymous access (401), wrong roles (403), invalid input (400), and business rules (422, 404, 409). All returned the expected status. The sewing queue stayed clean even with `?status=PENDING_VERIFICATION`.
- **Accessibility (Lighthouse):** 100 on `/login` (desktop and mobile), and on `/orders`, `/verify`, `/sewing` (desktop). Point-in-time snapshot audits on `/orders` and `/verify` passed 24/24.
- **Responsive layouts** checked at 375 px (phones get stacked card layouts instead of wide tables).
- Inputs, dropdowns and focus states use explicit dark-on-light colors, so they stay legible regardless of the OS theme.

## Known limitations

- No login rate limiting, password change or user management (out of scope for this module).
- Order lists are not paginated.
- The database connection uses `rejectUnauthorized: false` for the Supabase pooler certificate. A production deployment should pin the CA instead.
- `npm audit` reports advisories in development tooling dependencies. They were not force-upgraded to avoid breaking the build.