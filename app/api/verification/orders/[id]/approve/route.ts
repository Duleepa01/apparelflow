import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { errorResponse, HttpError, parseId } from '@/lib/http';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireRole('cutting_verifier');
    const id = parseId((await params).id);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const o = await client.query(
        `SELECT o.status,
                ROUND(((o.actual_fabric_yds - o.target_qty * r.std_fabric_yards)
                       / (o.target_qty * r.std_fabric_yards)) * 100, 2)::float8 AS wastage_pct
         FROM cutting_orders o JOIN recipes r ON r.id = o.recipe_id
         WHERE o.id = $1 FOR UPDATE OF o`,
        [id]
      );
      if (!o.rowCount) throw new HttpError(404, 'Order not found');
      if (o.rows[0].status !== 'PENDING_VERIFICATION') {
        throw new HttpError(409, `Order is ${o.rows[0].status}, not PENDING_VERIFICATION`);
      }

      const items = await client.query(
        `SELECT i.component_id, c.component_name, i.expected_qty, i.actual_qty
         FROM verification_items i JOIN recipe_components c ON c.id = i.component_id
         WHERE i.order_id = $1 ORDER BY i.component_id`,
        [id]
      );
      if (!items.rowCount) throw new HttpError(422, 'Order has no components to verify');

      const blocked = items.rows.filter(
        (r) => r.actual_qty === null || r.actual_qty < r.expected_qty
      );
      if (blocked.length) {
        throw new HttpError(
          422,
          `Cannot approve: shortage or uncounted components (${blocked
            .map((b) => b.component_name)
            .join(', ')})`
        );
      }

      const variances = items.rows.map((r) => ({
        component_id: r.component_id,
        component_name: r.component_name,
        expected: r.expected_qty,
        actual: r.actual_qty,
        variance: r.actual_qty - r.expected_qty,
      }));
      await client.query(
        `INSERT INTO verification_logs (order_id, verifier_id, decision, wastage_pct, variances)
         VALUES ($1, $2, 'APPROVED', $3, $4)`,
        [id, session.userId, o.rows[0].wastage_pct, JSON.stringify(variances)]
      );
      await client.query(
        `UPDATE cutting_orders SET status = 'VERIFIED', updated_at = now() WHERE id = $1`,
        [id]
      );
      await client.query('COMMIT');
      return NextResponse.json({ status: 'VERIFIED', wastage_pct: o.rows[0].wastage_pct });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (e) {
    return errorResponse(e);
  }
}