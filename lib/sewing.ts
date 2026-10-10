import { pool } from './db';
import { HttpError } from './http';

export async function getSewingQueue() {
  const { rows } = await pool.query(`
    SELECT o.id, o.order_no, o.target_qty, o.fabric_roll_id,
           o.actual_fabric_yds::float8 AS actual_fabric_yds,
           r.recipe_code, r.name AS recipe_name,
           l.wastage_pct::float8 AS wastage_pct, l.variances, l.decided_at,
           u.full_name AS verified_by
    FROM cutting_orders o
    JOIN recipes r ON r.id = o.recipe_id
    JOIN verification_logs l ON l.order_id = o.id AND l.decision = 'APPROVED'
    JOIN users u ON u.id = l.verifier_id
    WHERE o.status = 'VERIFIED'
    ORDER BY l.decided_at`);
  return rows;
}

export async function startSewing(id: number) {
  const r = await pool.query(
    `UPDATE cutting_orders SET status = 'SEWING_STARTED', updated_at = now()
     WHERE id = $1 AND status = 'VERIFIED'
     RETURNING id, order_no, status`,
    [id]
  );
  if (!r.rowCount) throw new HttpError(404, 'Order not found in the sewing queue');
  return r.rows[0];
}