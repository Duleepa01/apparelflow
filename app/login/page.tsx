'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DEMO, DEMO_PASSWORD } from '@/lib/demo';


export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function login(e: string, p: string) {
    setError('');
    setLoading(true);
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: e, password: p }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? 'Login failed');
      return;
    }
    router.push('/');
    router.refresh();
  }

  const inputCls =
    'w-full rounded border border-gray-500 bg-white px-3 py-2 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-700';

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center p-6">
      <h1 className="text-3xl font-bold text-slate-900">ApparelFlow</h1>
      <p className="mb-6 text-sm text-slate-700">Cutting verification and sewing queue gate</p>

      <form
        onSubmit={(ev) => {
          ev.preventDefault();
          login(email, password);
        }}
        className="space-y-3 rounded border border-gray-300 p-4"
      >
        <label className="block text-sm font-medium text-gray-900">
          Email
          <input
            className={inputCls}
            type="email"
            value={email}
            onChange={(ev) => setEmail(ev.target.value)}
            required
          />
        </label>
        <label className="block text-sm font-medium text-gray-900">
          Password
          <input
            className={inputCls}
            type="password"
            value={password}
            onChange={(ev) => setPassword(ev.target.value)}
            required
          />
        </label>
        {error && (
          <p role="alert" className="text-sm font-medium text-red-700">
            {error}
          </p>
        )}
        <button
          disabled={loading}
          className="w-full rounded bg-blue-800 px-3 py-2 font-medium text-white disabled:opacity-60"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <section className="mt-6 card p-5">
        <h2 className="mb-2 font-semibold text-gray-900">Demo credentials (password: {DEMO_PASSWORD})</h2>
        <ul className="space-y-2">
          {DEMO.map((d) => (
            <li key={d.email} className="flex items-center justify-between gap-2">
              <span className="text-sm text-gray-900">
                <strong>{d.label}</strong>
                <br />
                {d.email}
              </span>
              <button
                type="button"
                onClick={() => login(d.email, DEMO_PASSWORD)}
                className="rounded border border-blue-800 px-3 py-1 text-sm font-medium text-blue-800"
              >
                Sign in as
              </button>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}