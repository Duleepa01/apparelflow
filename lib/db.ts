import { Pool } from 'pg';

const g = globalThis as unknown as { pool?: Pool };
const url = process.env.DATABASE_URL ?? '';
const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(url);

export const pool =
  g.pool ??
  new Pool({
    connectionString: url,
    ssl: isLocal ? false : { rejectUnauthorized: false },
    max: 5,
  });

if (process.env.NODE_ENV !== 'production') g.pool = pool;