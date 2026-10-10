import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { errorResponse, HttpError, parseId } from '@/lib/http';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireRole('cutting_verifier');
    const id = parseId((await params).id);

    const body = await req.json().catch(() => null);
    const note = typeof body?.note === 'string' ? body.note.trim() : '';
    if (note.length < 1 || note.length > 500) {
      return NextResponse.json(
        { error: 'Validation failed', fields: { note: 'A rejection reason (1-500 characters) is required' } },
        { status: 400 }
      );
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
        throw new HttpError(409, `Order is ${o.rows[0].status}, not PENDING_VERIFICATION`);
      }
      await client.query(
        `INSERT INTO verification_logs (order_id, verifier_id, decision, rejection_note)
         VALUES ($1, $2, 'REJECTED', $3)`,
        [id, session.userId, note]
      );
      await client.query(
        `UPDATE cutting_orders SET status = 'REJECTED', updated_at = now() WHERE id = $1`,
        [id]
      );
      await client.query('COMMIT');
      return NextResponse.json({ status: 'REJECTED' });
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