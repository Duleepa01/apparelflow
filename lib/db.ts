import { Pool } from 'pg';

const g = globalThis as unknown as { pool?: Pool };

export const pool =
  g.pool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 5,
  });

if (process.env.NODE_ENV !== 'production') g.pool = pool;