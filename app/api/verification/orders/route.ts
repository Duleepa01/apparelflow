import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { errorResponse } from '@/lib/http';

export async function GET() {
  try {
    await requireRole('cutting_verifier');
    const { rows } = await pool.query(`
      SELECT o.id, o.order_no, o.target_qty, o.fabric_roll_id, o.created_at,
             r.recipe_code, r.name AS recipe_name
      FROM cutting_orders o JOIN recipes r ON r.id = o.recipe_id
      WHERE o.status = 'PENDING_VERIFICATION'
      ORDER BY o.created_at`);
    return NextResponse.json(rows);
  } catch (e) {
    return errorResponse(e);
  }
}