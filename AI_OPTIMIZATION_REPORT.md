# AI Optimization Report

This report documents how I used AI while building ApparelFlow's Cutting Verification & Sewing Queue Gate, where the AI-generated code was wrong, and how I verified and hardened it. It follows the four sections required by the assessment.

> Disclosure: I drafted this report with Claude from a running log we kept during the build (the errors, the fixes, the design decisions). I reviewed it against what actually happened in the project.

---

## 1. Tools & Prompting

| Tool | Used for |
|---|---|
| **ChatGPT** | Reading and breaking down the assessment PDF, and turning it into a structured prompt for the build phase |
| **Claude (chat)** | Mentor and pair programmer for the whole build: stack choice, schema design, route handlers, UI, styling, test generation, debugging, and the README and this report |

I did not use Cursor, Copilot or v0. Everything was done in chat, and I typed or pasted every file myself, ran it, and reported results back. That made me read each file once, and it is where most bugs below were caught.

### How I prompted

1. **Requirements first.** ChatGPT helped me extract the requirements, roles, workflow, security rules and deliverables from the PDF. I then wrote a long mentor prompt for Claude that made the PDF the source of truth and told it not to invent requirements. Where the brief was unclear, I told it to say so, and it did (for example, the brief never defines "Expected Fabric", the post-sewing status name, or what happens when wastage exceeds the cap). Those decisions are listed in the README.
2. **Vertical slices, not a big-bang generation.** The rule was DB → API → UI → test → commit, with a pause for me to confirm after each step. No step produced the whole app.
3. **Security as a standing instruction.** I told Claude to treat the backend as the security boundary and to flag every rule that must be enforced server-side, assuming an evaluator would call the APIs directly.
4. **Verify, don't trust.** Every AI-written endpoint was exercised with direct HTTP calls (PowerShell `Invoke-RestMethod`) and database queries in pgAdmin before the UI was built on top of it.
5. **Pushing back on design.** I rejected the first look of the UI as "generic AI design", asked for hover and pointer feedback on everything clickable, and questioned a redundant dashboard.

AI was strong at scaffolding, SQL, and test generation. It was weakest at version-specific integration: Next.js 16, React 19 and Vitest 5 are newer than much of its training data. I did not find invented library APIs, but I did find code that was wrong for this exact stack.

---

## 2. Flawed / Broken AI Code

### 2.1 Session read outside `<Suspense>` (Next.js 16 blocking route)
- **What the AI wrote:** a home page that called `getSession()` (which reads the cookie) at the top level of the page component.
- **What was wrong:** with Cache Components enabled, reading request data outside `<Suspense>` makes the route "blocking". Next.js threw a "Blocking Route" error in the dev overlay, so the page failed.
- **How I detected it:** the error overlay on first login.
- **Fix:** the page became a static shell, with the session read moved into an async component wrapped in `<Suspense>`. I applied the same pattern to every page that reads the session (`/orders`, `/verify`, `/sewing`).

### 2.2 `setState` called directly inside `useEffect` (React 19 lint rule)
- **What the AI wrote:** client pages (`VerifyClient`, `OrdersClient`) with `useEffect(() => { loadList(); }, [...])`, where `loadList` set state.
- **What was wrong:** the React 19 lint rules flag synchronous state updates in effect bodies (cascading renders). It also had no cancellation, so a response arriving after unmount could still set state.
- **How I detected it:** the lint/overlay error pointing at the exact line.
- **Fix:** fetching became a function that only returns data, and state is set in the `.then` callback of a cancellable effect (`let cancelled = false` with a cleanup). In `OrdersClient` I used a `reload` counter that re-triggers the effect after create and resubmit.

### 2.3 Circular import in the test mock, which hung the suite silently
- **What the AI wrote:** `tests/setup.ts` mocked `next/headers`, and the mock factory imported `tests/session.ts`, which imported `lib/auth`, which imports `next/headers`.
- **What was wrong:** the circular dependency deadlocked module loading. Vitest did not fail; it sat in `[queued]` for more than 12 minutes.
- **How I detected it:** a trivial smoke test passed in 3 ms but the real test file never started, so the problem was in its imports. I wrote a probe test that timed each import and found that `lib/auth` was the one that hung.
- **Fix:** shared token state moved into a dependency-free module (`tests/state.ts`) that both the mock and the helper import, and the cycle is gone. The suite now runs in about one second.

### 2.4 Stale-context code that referenced a function that no longer existed
- **What the AI wrote:** the resubmit handler for the orders page ended with `await load()`.
- **What was wrong:** by then I had refactored `OrdersClient` (see 2.2) and `load` no longer existed, so TypeScript reported `Cannot find name 'load'`. The AI had written against an older version of my file.
- **How I detected it:** the TypeScript error. I then pasted my actual file, and the fix was to use the existing `setReload` trigger.
- **Lesson:** I now paste the current file before asking for a change to it.

### 2.5 Layouts that broke on a phone
- **What the AI wrote:** wide data tables for the verifier terminal, the orders list and the sewing piece counts.
- **What was wrong:** at 375 px the verifier detail card became wider than the screen and cut off the Status column. In the orders list, the status and the Resubmit button sat off-screen, so a supervisor could not see that an order was rejected. Grid children also lacked `min-w-0`, so inner scrolling could not contain the table.
- **How I detected it:** manual testing in the browser's device toolbar (screenshots).
- **Fix:** `min-w-0` on grid sections, compact card lists for phones with tables kept for desktop (`md:` / `sm:` breakpoints), and the traffic-light badge rendered directly under each count input on mobile.

### 2.6 Smaller defects caught along the way
- A TypeScript error on the root route (`'Go' cannot be used as a JSX component`): an async component that only calls `redirect()` was inferred as `Promise<void>`. Fixed with an explicit `Promise<null>` return type.
- `npm i vitest` failed on a peer conflict (`@types/node` 20 vs 22+). I bumped the types package instead of using `--force`, which would have hidden the conflict.
- The Vitest config used ESM syntax in a `.ts` file loaded as CommonJS. I renamed it to `.mts` rather than changing `"type"` in `package.json`, which would affect Next.js.
- Commands were given in bash syntax (`&&`) that Windows PowerShell 5 rejects.
- The first UI had no pointer cursor or hover feedback on clickable items (Tailwind v4 resets buttons to the default cursor). I replaced `globals.css` with explicit rules.
- A dashboard whose only job was a button duplicating the navigation link. I asked for it to be redesigned, and it was removed (see 3).

---

## 3. Human Refactoring

**Hardening the AI's first draft**
- **Strict numeric validation:** the UI uses text inputs with regex checks instead of `type="number"` (which accepts `1e3` and `2.0`), and the API checks `typeof === 'number'`, integer-ness and ranges. Strings like `"5"`, decimals, negatives and empty payloads are all rejected (400 with per-field messages).
- **Database constraints as a second line of defence:** `CHECK` constraints for positive quantities, valid statuses and roles, plus a non-empty note on `REJECTED` logs.
- **Business logic moved out of the route** into `lib/sewing.ts` (`getSewingQueue`, `startSewing`) so the sewing-queue test exercises the actual database query rather than a copy of it.
- **Separate test database** and a setup guard that refuses to run unless `TEST_DATABASE_URL` is set and differs from `DATABASE_URL`, plus a clear error message and a documented `.env.example`.
- **Responsive rewrite** described in 2.5, and the one-file CSS theme described below.

**Design decisions I made after reviewing alternatives**
- **Own users table and JWT** instead of Supabase Auth, because the brief's schema requires `users.password_hash` and a server-derived identity.
- **Native `<select>` kept on purpose.** A custom dropdown (shadcn/headless) would have given a nicer hover, but a hand-built listbox is a likelier source of keyboard, mobile and contrast defects. The native control already has dark-on-light text and a visible focus ring.
- **Did not "fix" a build-log notice.** Next.js logs a prerender notice for GET handlers that call `cookies()`. The routes are correctly marked dynamic in the build output, and the `connection()` workaround risked breaking the tests, so I left it and noted it.
- **No new dependencies for the UI:** no component library or icon pack. A palette remap in `globals.css` (the existing `blue-*`, `slate-*` and `gray-*` utilities render as the brand colours) kept the edits small. The trade-off is that class names like `blue-800` no longer describe the colour, and I have noted this in the CSS comment.
- **Product judgment:** I rejected the generic look, asked for hover and pointer feedback on every clickable element, and removed the redundant dashboard. The role switcher moved into the header so it is available on every page, and each role lands directly in its workspace.

**Verification I ran myself**
- 13 automated tests pass (README maps them to the five required cases plus extras).
- A direct-API attack script against the deployed URL: 23 checks across anonymous access, wrong roles, invalid input, invalid state transitions and queue tampering. All returned the expected status code (401, 403, 400, 422, 404, 409), and the sewing queue stayed clean even with `?status=PENDING_VERIFICATION` appended.
- Database checks in pgAdmin: the audit rows (verifier id, wastage %, variances) were written correctly, and an `UPDATE` on `verification_logs` was refused by the immutability trigger.
- Lighthouse accessibility: 100 on all four pages in desktop mode (and on `/login` in mobile), and 24/24 on point-in-time snapshots of `/orders` and `/verify`.

---

## 4. Defensive Architecture

### How the state machine is protected

```
PENDING_VERIFICATION --approve--> VERIFIED --start--> SEWING_STARTED
PENDING_VERIFICATION --reject---> REJECTED --resubmit--> PENDING_VERIFICATION
```

| Transition | Who | Guard |
|---|---|---|
| Create → `PENDING_VERIFICATION` | supervisor | `requireRole`, validation, expected counts computed in SQL (`pieces_per_garment × target_qty`), order and items inserted in one transaction |
| `PENDING_VERIFICATION → VERIFIED` | verifier | `requireRole`; row lock (`FOR UPDATE`); status must be `PENDING_VERIFICATION` (else 409); every component re-read from the DB and any short or uncounted component returns 422; audit row written in the same transaction |
| `PENDING_VERIFICATION → REJECTED` | verifier | `requireRole`; non-empty note (400); row lock; status check (409) |
| `REJECTED → PENDING_VERIFICATION` | supervisor | `requireRole`; row lock; only from `REJECTED` (409); old counts cleared so pieces must be recounted |
| `VERIFIED → SEWING_STARTED` | sewing supervisor | `requireRole`; a single `UPDATE ... WHERE status = 'VERIFIED'`, which matches zero rows for any other state (404) |

### Layers that block an unauthorized status override

1. **Authentication:** every handler starts with `requireRole(...)`, which verifies the signed JWT. Unauthenticated requests get 401, wrong roles get 403. Role and user id come from the token, never the request body.
2. **The hard stop does not trust anything stored or sent.** Approve ignores the request body. It re-reads expected and actual quantities inside the transaction, so a tampered client, a stale UI, or a direct `curl` cannot approve a shortage. The traffic-light status is computed by SQL when counts are saved, and the client's colours are only a preview.
3. **Concurrency:** `SELECT ... FOR UPDATE` serialises approve and reject, so two simultaneous decisions cannot both succeed.
4. **Query isolation:** the sewing queue has `WHERE status = 'VERIFIED'` hard-coded in SQL and an inner join on an `APPROVED` log. It reads no query parameters.
5. **No information leak:** starting sewing on a non-verified order returns 404, so a sewing user cannot probe for pending orders.
6. **Database backstops:** `CHECK` constraints, unique constraints, and a trigger that makes `verification_logs` immutable. Row-level security is enabled on all tables (no policies) so Supabase's auto-generated REST API cannot be used to bypass the app.
7. **Tests prove each layer:** approve with all GREEN, with RED, and with uncounted components; reject without a note; 403 for non-verifiers and 401 for anonymous callers; unapproved orders absent from the queue; 409 on repeat decisions; the audit trail refusing edits. The suite calls the real route handlers with real JWTs.

### Known limits (honest notes)
No login rate-limiting or password management; order lists are not paginated; the database connection uses `rejectUnauthorized: false` for the Supabase pooler certificate (a production system should pin the CA); `npm audit` reports advisories in dev tooling that I did not force-upgrade.
