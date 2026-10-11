'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DEMO, DEMO_PASSWORD, ROLE_INFO } from '@/lib/demo';

export default function RoleSwitcher({ currentRole }: { currentRole: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function switchTo(d: (typeof DEMO)[number]) {
    if (d.role === currentRole || busy) return;
    setError('');
    setBusy(true);
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: d.email, password: DEMO_PASSWORD }),
    });
    setBusy(false);
    if (!res.ok) {
      setError('Switch failed');
      return;
    }
    router.push(ROLE_INFO[d.role].href);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <span className="hidden font-mono text-[11px] uppercase tracking-widest text-stone-300 md:inline">Demo role</span>
      <div role="group" aria-label="Demo role switcher" className="flex overflow-hidden rounded-sm border border-stone-500">
        {DEMO.map((d) => {
          const active = d.role === currentRole;
          return (
            <button
              key={d.role}
              title={d.label}
              aria-pressed={active}
              onClick={() => switchTo(d)}
              className={`px-3 py-1.5 text-xs font-semibold ${
                active ? 'bg-orange-700 text-white' : 'bg-transparent text-stone-200 hover:bg-white/10'
              }`}
            >
              {d.short}
            </button>
          );
        })}
      </div>
      {error && <span role="alert" className="text-xs font-medium text-red-300">{error}</span>}
    </div>
  );
}