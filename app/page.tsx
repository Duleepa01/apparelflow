import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import LogoutButton from './LogoutButton';

async function SessionInfo() {
  const session = await getSession();
  if (!session) redirect('/login');
  return (
    <>
      <p className="mt-2">
        Signed in as {session.name} ({session.role})
      </p>
      <LogoutButton />
    </>
  );
}

export default function Home() {
  return (
    <main className="p-8 text-gray-900">
      <h1 className="text-2xl font-bold">ApparelFlow ERP</h1>
      <Suspense fallback={<p className="mt-2">Loading…</p>}>
        <SessionInfo />
      </Suspense>
    </main>
  );
}