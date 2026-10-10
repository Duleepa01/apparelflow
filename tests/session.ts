import { pool } from '@/lib/db';
import { createSessionToken, type Role } from '@/lib/auth';
import { state } from './state';

export async function loginAs(role: Role | null) {
  if (!role) {
    state.token = undefined;
    return;
  }
  const { rows } = await pool.query('SELECT id, full_name FROM users WHERE role = $1 LIMIT 1', [role]);
  if (!rows[0]) throw new Error('Test DB is not seeded. Run: npm run db:setup:test');
  state.token = await createSessionToken({ userId: rows[0].id, role, name: rows[0].full_name });
}