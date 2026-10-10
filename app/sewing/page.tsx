import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import SewingClient from './SewingClient';

async function Guard() {
  const s = await getSession();
  if (!s) redirect('/login');
  if (s.role !== 'sewing_supervisor') redirect('/');
  return <SewingClient name={s.name} />;
}

export default function SewingPage() {
  return (
    <Suspense fallback={<p className="p-8 text-gray-900">Loading…</p>}>
      <Guard />
    </Suspense>
  );
}