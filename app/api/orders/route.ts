import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { errorResponse, HttpError } from '@/lib/http';
import { checkInt, checkYards, checkRollId } from '@/lib/validation';

export async function GET() {
  try {
    await requireRole('cutting_supervisor');
    const { rows } = await pool.query(`
      SELECT o.id, o.order_no, o.status, o.target_qty, o.fabric_roll_id,
             o.actual_fabric_yds::float8 AS actual_fabric_yds, o.created_at,
             r.recipe_code, r.name AS recipe_name
      FROM cutting_orders o
      JOIN recipes r ON r.id = o.recipe_id
      ORDER BY o.created_at DESC`);
    return NextResponse.json(rows);
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireRole('cutting_supervisor');

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      throw new HttpError(400, 'Request body must be a JSON object');
    }

    const fields: Record<string, string> = {};
    const e1 = checkInt(body.recipe_id, 1, 2147483647);
    const e2 = checkInt(body.target_qty, 1, 100000);
    const e3 = checkRollId(body.fabric_roll_id);
    const e4 = checkYards(body.actual_fabric_yds, 1000000);
    if (e1) fields.recipe_id = e1;
    if (e2) fields.target_qty = e2;
    if (e3) fields.fabric_roll_id = e3;
    if (e4) fields.actual_fabric_yds = e4;
    if (Object.keys(fields).length) {
      return NextResponse.json({ error: 'Validation failed', fields }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const recipe = await client.query('SELECT id FROM recipes WHERE id = $1', [body.recipe_id]);
      if (recipe.rowCount === 0) throw new HttpError(422, 'Unknown recipe');

      const seq = await client.query(
        `SELECT nextval(pg_get_serial_sequence('cutting_orders','id'))::int AS id`
      );
      const id: number = seq.rows[0].id;
      const orderNo = `ORD-${String(id).padStart(5, '0')}`;

      const order = await client.query(
        `INSERT INTO cutting_orders
           (id, order_no, recipe_id, target_qty, fabric_roll_id, actual_fabric_yds, status, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,'PENDING_VERIFICATION',$7)
         RETURNING id, order_no, status`,
        [id, orderNo, body.recipe_id, body.target_qty, body.fabric_roll_id.trim(),
         body.actual_fabric_yds, session.userId]
      );

      await client.query(
        `INSERT INTO verification_items (order_id, component_id, expected_qty)
         SELECT $1, c.id, c.pieces_per_garment * $2
         FROM recipe_components c WHERE c.recipe_id = $3`,
        [id, body.target_qty, body.recipe_id]
      );

      await client.query('COMMIT');
      return NextResponse.json(order.rows[0], { status: 201 });
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