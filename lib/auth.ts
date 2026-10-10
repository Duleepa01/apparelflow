import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { HttpError } from './http';

export type Role = 'cutting_supervisor' | 'cutting_verifier' | 'sewing_supervisor';
export interface Session {
  userId: number;
  role: Role;
  name: string;
}

export const COOKIE_NAME = 'af_session';

function secret() {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET is not set');
  return new TextEncoder().encode(s);
}

export async function createSessionToken(s: Session) {
  return new SignJWT({ role: s.role, name: s.name })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(s.userId))
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(secret());
}

export async function getSession(): Promise<Session | null> {
  const key = secret();
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key, { algorithms: ['HS256'] });
    return {
      userId: Number(payload.sub),
      role: payload.role as Role,
      name: payload.name as string,
    };
  } catch {
    return null;
  }
}

export async function requireRole(...roles: Role[]): Promise<Session> {
  const s = await getSession();
  if (!s) throw new HttpError(401, 'Not authenticated');
  if (!roles.includes(s.role)) throw new HttpError(403, 'Forbidden');
  return s;
}