import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { errorResponse, HttpError, parseId } from '@/lib/http';
import { checkInt } from '@/lib/validation';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole('cutting_verifier');
    const id = parseId((await params).id);

    const body = await req.json().catch(() => null);
    const counts = body?.counts;
    if (!Array.isArray(counts) || counts.length === 0 || counts.length > 50) {
      throw new HttpError(400, 'counts must be a non-empty array');
    }
    const fields: Record<string, string> = {};
    counts.forEach((c, i) => {
      const err = checkInt(c?.component_id, 1, 2147483647) ?? checkInt(c?.actual_qty, 0, 10000000);
      if (err) fields[`counts[${i}]`] = err;
    });
    if (Object.keys(fields).length) {
      return NextResponse.json({ error: 'Validation failed', fields }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const o = await client.query(
        'SELECT status FROM cutting_orders WHERE id = $1 FOR UPDATE',
        [id]
      );
      if (!o.rowCount) throw new HttpError(404, 'Order not found');
      if (o.rows[0].status !== 'PENDING_VERIFICATION') {
        throw new HttpError(409, `Order is ${o.rows[0].status}; counts can no longer be changed`);
      }

      for (const c of counts) {
        const r = await client.query(
          `UPDATE verification_items
           SET actual_qty = $1::int,
               status = CASE WHEN $1::int < expected_qty THEN 'RED'
                             WHEN $1::int > expected_qty THEN 'YELLOW'
                             ELSE 'GREEN' END
           WHERE order_id = $2 AND component_id = $3`,
          [c.actual_qty, id, c.component_id]
        );
        if (r.rowCount === 0) {
          throw new HttpError(422, `Component ${c.component_id} is not part of this order`);
        }
      }
      await client.query('COMMIT');

      const items = await pool.query(
        `SELECT i.component_id, c.component_name, i.expected_qty, i.actual_qty, i.status
         FROM verification_items i JOIN recipe_components c ON c.id = i.component_id
         WHERE i.order_id = $1 ORDER BY i.component_id`,
        [id]
      );
      return NextResponse.json({ items: items.rows });
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