import { vi } from 'vitest';

const url = process.env.TEST_DATABASE_URL;
if (!url) {
  throw new Error(
    'TEST_DATABASE_URL is not set. Copy .env.example to .env.test, point TEST_DATABASE_URL at an EMPTY Postgres database, run "npm run db:setup:test", then "npm test".'
  );
}
if (url === process.env.DATABASE_URL) throw new Error('TEST_DATABASE_URL must differ from DATABASE_URL');
process.env.DATABASE_URL = url;
process.env.JWT_SECRET ||= 'test-secret-not-for-production';

vi.mock('next/headers', async () => {
      const { state } = await import('./state');
  return {
    cookies: async () => ({
      get: (name: string) => (name === 'af_session' && state.token ? { value: state.token } : undefined),
    }),
  };
});