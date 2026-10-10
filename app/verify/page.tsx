import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import VerifyClient from './VerifyClient';

async function Guard() {
  const s = await getSession();
  if (!s) redirect('/login');
  if (s.role !== 'cutting_verifier') redirect('/');
  return <VerifyClient name={s.name} />;
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<p className="p-8 text-gray-900">Loading…</p>}>
      <Guard />
    </Suspense>
  );
}