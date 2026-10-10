import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { pool } from '@/lib/db';
import { COOKIE_NAME, createSessionToken, type Role } from '@/lib/auth';
import { errorResponse } from '@/lib/http';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body?.password === 'string' ? body.password : '';
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const { rows } = await pool.query(
      'SELECT id, password_hash, role, full_name FROM users WHERE email = $1',
      [email]
    );
    const user = rows[0];
    const ok = user && (await bcrypt.compare(password, user.password_hash));
    if (!ok) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    const token = await createSessionToken({
      userId: user.id,
      role: user.role as Role,
      name: user.full_name,
    });
    const res = NextResponse.json({ role: user.role });
    res.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 8,
    });
    return res;
  } catch (e) {
    return errorResponse(e);
  }
}