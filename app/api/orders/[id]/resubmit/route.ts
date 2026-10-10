import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { errorResponse, HttpError, parseId } from '@/lib/http';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole('cutting_supervisor');
    const id = parseId((await params).id);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const o = await client.query(
        'SELECT status FROM cutting_orders WHERE id = $1 FOR UPDATE',
        [id]
      );
      if (!o.rowCount) throw new HttpError(404, 'Order not found');
      if (o.rows[0].status !== 'REJECTED') {
        throw new HttpError(409, `Only REJECTED orders can be resubmitted (order is ${o.rows[0].status})`);
      }
      await client.query(
        'UPDATE verification_items SET actual_qty = NULL, status = NULL WHERE order_id = $1',
        [id]
      );
      await client.query(
        `UPDATE cutting_orders SET status = 'PENDING_VERIFICATION', updated_at = now() WHERE id = $1`,
        [id]
      );
      await client.query('COMMIT');
      return NextResponse.json({ status: 'PENDING_VERIFICATION' });
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