import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { errorResponse, HttpError, parseId } from '@/lib/http';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole('cutting_verifier');
    const id = parseId((await params).id);

    const o = await pool.query(
      `SELECT o.id, o.order_no, o.status, o.target_qty, o.fabric_roll_id,
              o.actual_fabric_yds::float8 AS actual_fabric_yds,
              r.recipe_code, r.name AS recipe_name,
              r.std_fabric_yards::float8 AS std_fabric_yards,
              r.wastage_cap::float8 AS wastage_cap
       FROM cutting_orders o JOIN recipes r ON r.id = o.recipe_id
       WHERE o.id = $1`,
      [id]
    );
    if (!o.rowCount) throw new HttpError(404, 'Order not found');

    const items = await pool.query(
      `SELECT i.component_id, c.component_name, i.expected_qty, i.actual_qty, i.status
       FROM verification_items i JOIN recipe_components c ON c.id = i.component_id
       WHERE i.order_id = $1 ORDER BY i.component_id`,
      [id]
    );
    return NextResponse.json({ ...o.rows[0], items: items.rows });
  } catch (e) {
    return errorResponse(e);
  }
}
