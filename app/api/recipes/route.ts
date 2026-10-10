import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { errorResponse } from '@/lib/http';

export async function GET() {
  try {
    await requireRole('cutting_supervisor', 'cutting_verifier');
    const { rows } = await pool.query(`
      SELECT r.id, r.recipe_code, r.name, r.category,
             r.std_fabric_yards::float8 AS std_fabric_yards,
             r.wastage_cap::float8 AS wastage_cap,
             COALESCE(json_agg(json_build_object(
               'id', c.id,
               'component_name', c.component_name,
               'pieces_per_garment', c.pieces_per_garment
             ) ORDER BY c.id) FILTER (WHERE c.id IS NOT NULL), '[]') AS components
      FROM recipes r
      LEFT JOIN recipe_components c ON c.recipe_id = r.id
      GROUP BY r.id
      ORDER BY r.id`);
    return NextResponse.json(rows);
  } catch (e) {
    return errorResponse(e);
  }
}