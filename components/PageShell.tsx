'use client';
import Link from 'next/link';
import LogoutButton from '@/app/LogoutButton';
import RoleSwitcher from './RoleSwitcher';
import { ROLE_INFO } from '@/lib/demo';

export default function PageShell({
  name, role, title, subtitle, actions, children,
}: {
  name: string; role: string; title: string; subtitle?: string;
  actions?: React.ReactNode; children: React.ReactNode;
}) {
  const info = ROLE_INFO[role];
  const roleLabel = info?.label ?? role;
  const showName = name.trim().toLowerCase() !== roleLabel.toLowerCase();
  const sub = subtitle ?? info?.blurb;

  return (
    <div className="min-h-screen">
      <header className="border-b-4 border-orange-700 bg-slate-900 text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-6 py-3">
          <Link href="/" className="flex items-center gap-3 no-underline hover:no-underline">
            <span aria-hidden className="flex h-9 w-9 items-center justify-center bg-orange-700 font-mono text-sm font-bold">
              AF
            </span>
            <span className="leading-tight">
              <span className="block text-base font-bold tracking-tight">ApparelFlow</span>
              <span className="block font-mono text-[11px] uppercase tracking-widest text-stone-300">Cutting gate</span>
            </span>
          </Link>
          <div className="flex flex-wrap items-center gap-4">
            <RoleSwitcher currentRole={role} />
            <div className="flex items-center gap-3">
              {showName && <span className="hidden text-sm font-semibold sm:inline">{name}</span>}
              <LogoutButton />
            </div>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8 text-slate-900">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{title}</h1>
            {sub && <p className="mt-1 text-sm text-slate-700">{sub}</p>}
          </div>
          {actions}
        </div>
        {children}
      </main>
    </div>
  );
}