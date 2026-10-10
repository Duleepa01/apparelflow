import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pool } from '@/lib/db';
import { getSewingQueue } from '@/lib/sewing';
import { POST as createOrder } from '@/app/api/orders/route';
import { PUT as saveCounts } from '@/app/api/verification/orders/[id]/counts/route';
import { POST as approve } from '@/app/api/verification/orders/[id]/approve/route';
import { POST as reject } from '@/app/api/verification/orders/[id]/reject/route';
import { GET as sewingQueueApi } from '@/app/api/sewing/queue/route';
import { loginAs } from './session';

const req = (method: string, body?: unknown) =>
  new Request('http://test.local/api', {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const ctx = (id: number) => ({ params: Promise.resolve({ id: String(id) }) });
const statusOf = async (id: number) =>
  (await pool.query('SELECT status FROM cutting_orders WHERE id = $1', [id])).rows[0].status;
const logsOf = async (id: number) =>
  (await pool.query('SELECT * FROM verification_logs WHERE order_id = $1', [id])).rows;

let blouseId: number;

async function newOrder(qty = 10) {
  await loginAs('cutting_supervisor');
  const res = await createOrder(
    req('POST', { recipe_id: blouseId, target_qty: qty, fabric_roll_id: 'TEST-ROLL-1', actual_fabric_yds: qty * 2 })
  );
  expect(res.status).toBe(201);
  return (await res.json()).id as number;
}

async function countAll(orderId: number, mode: 'exact' | 'excess' | 'short') {
  const { rows } = await pool.query(
    'SELECT component_id, expected_qty FROM verification_items WHERE order_id = $1 ORDER BY component_id',
    [orderId]
  );
  const counts = rows.map((r, i) => ({
    component_id: r.component_id,
    actual_qty:
      mode === 'short' && i === rows.length - 1 ? r.expected_qty - 1
      : mode === 'excess' && i === 0 ? r.expected_qty + 3
      : r.expected_qty,
  }));
  await loginAs('cutting_verifier');
  expect((await saveCounts(req('PUT', { counts }), ctx(orderId))).status).toBe(200);
}

beforeAll(async () => {
  const r = await pool.query("SELECT id FROM recipes WHERE recipe_code = 'REC-BL01'");
  if (!r.rows[0]) throw new Error('Test DB is not seeded. Run: npm run db:setup:test');
  blouseId = r.rows[0].id;
});
afterAll(async () => {
  await pool.end();
});

describe('Gatekeeper rules', () => {
  it('Test 1: all-GREEN order is approved by a verifier, audit uses the session user', async () => {
    const id = await newOrder();
    await countAll(id, 'exact');
    const res = await approve(req('POST', { verifier_id: 999 }), ctx(id));
    expect(res.status).toBe(200);
    expect(await statusOf(id)).toBe('VERIFIED');
    const [log] = await logsOf(id);
    expect(log.decision).toBe('APPROVED');
    expect(log.verifier_id).not.toBe(999);
    expect(Number(log.wastage_pct)).toBeGreaterThan(0);
  });

  it('Test 1b: YELLOW (excess) components still allow approval', async () => {
    const id = await newOrder();
    await countAll(id, 'excess');
    expect((await approve(req('POST'), ctx(id))).status).toBe(200);
  });

  it('Test 2: a RED (shortage) component blocks approval with 422', async () => {
    const id = await newOrder();
    await countAll(id, 'short');
    const res = await approve(req('POST'), ctx(id));
    expect(res.status).toBe(422);
    expect(await statusOf(id)).toBe('PENDING_VERIFICATION');
    expect(await logsOf(id)).toHaveLength(0);
  });

  it('Test 2b: uncounted components block approval with 422', async () => {
    const id = await newOrder();
    await loginAs('cutting_verifier');
    expect((await approve(req('POST'), ctx(id))).status).toBe(422);
    expect(await statusOf(id)).toBe('PENDING_VERIFICATION');
  });

  it('Test 3: rejecting without a note fails validation; with a note it succeeds', async () => {
    const id = await newOrder();
    await loginAs('cutting_verifier');
    for (const body of [{}, { note: '' }, { note: '   ' }, { note: 42 }]) {
      expect((await reject(req('POST', body), ctx(id))).status).toBe(400);
    }
    expect(await statusOf(id)).toBe('PENDING_VERIFICATION');
    expect((await reject(req('POST', { note: 'Cuffs short by 2' }), ctx(id))).status).toBe(200);
    expect(await statusOf(id)).toBe('REJECTED');
  });

  it('Test 4: non-verifier roles get 403, anonymous gets 401', async () => {
    const id = await newOrder();
    await countAll(id, 'exact');
    for (const role of ['cutting_supervisor', 'sewing_supervisor'] as const) {
      await loginAs(role);
      expect((await approve(req('POST'), ctx(id))).status).toBe(403);
      expect((await reject(req('POST', { note: 'x' }), ctx(id))).status).toBe(403);
    }
    await loginAs(null);
    expect((await approve(req('POST'), ctx(id))).status).toBe(401);
    expect(await statusOf(id)).toBe('PENDING_VERIFICATION');
  });

  it('Test 5: unapproved orders never appear in the sewing queue', async () => {
    const pending = await newOrder();
    const rejected = await newOrder();
    await loginAs('cutting_verifier');
    await reject(req('POST', { note: 'Defect' }), ctx(rejected));
    const verified = await newOrder();
    await countAll(verified, 'exact');
    await approve(req('POST'), ctx(verified));

    const queue = await getSewingQueue();
    const ids = queue.map((o) => o.id);
    expect(ids).toContain(verified);
    expect(ids).not.toContain(pending);
    expect(ids).not.toContain(rejected);
    for (const id of ids) expect(await statusOf(id)).toBe('VERIFIED');

    await loginAs('sewing_supervisor');
    expect((await sewingQueueApi()).status).toBe(200);
    for (const role of ['cutting_supervisor', 'cutting_verifier'] as const) {
      await loginAs(role);
      expect((await sewingQueueApi()).status).toBe(403);
    }
  });
});

describe('Extra guards', () => {
  it('a verifier cannot create orders', async () => {
    await loginAs('cutting_verifier');
    const res = await createOrder(
      req('POST', { recipe_id: blouseId, target_qty: 5, fabric_roll_id: 'R1', actual_fabric_yds: 9 })
    );
    expect(res.status).toBe(403);
  });

  it('invalid order payloads are rejected with 400', async () => {
    await loginAs('cutting_supervisor');
    const ok = { recipe_id: blouseId, target_qty: 5, fabric_roll_id: 'R1', actual_fabric_yds: 9 };
    const bad = [
      { ...ok, target_qty: 2.5 }, { ...ok, target_qty: -1 }, { ...ok, target_qty: '5' },
      { ...ok, actual_fabric_yds: 0 }, { ...ok, actual_fabric_yds: 1.234 },
      { ...ok, fabric_roll_id: '' }, {},
    ];
    for (const b of bad) expect((await createOrder(req('POST', b))).status).toBe(400);
  });

  it('an already-verified order cannot be approved or rejected again (409)', async () => {
    const id = await newOrder();
    await countAll(id, 'exact');
    await approve(req('POST'), ctx(id));
    expect((await approve(req('POST'), ctx(id))).status).toBe(409);
    expect((await reject(req('POST', { note: 'late' }), ctx(id))).status).toBe(409);
  });

  it('audit logs are immutable at the database level', async () => {
    await expect(pool.query('UPDATE verification_logs SET wastage_pct = 0')).rejects.toThrow(/immutable/);
    await expect(pool.query('DELETE FROM verification_logs')).rejects.toThrow(/immutable/);
  });
});