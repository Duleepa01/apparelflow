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
      {session.role === 'cutting_supervisor' && (
        <a href="/orders" className="mt-4 inline-block text-blue-800 underline">
          Cutting Orders
        </a>
      )}

      {session.role === 'cutting_verifier' && (
        <a href="/verify" className="mt-4 inline-block text-blue-800 underline">
          Verification Terminal
        </a>
      )}

      {session.role === 'sewing_supervisor' && (
        <a href="/sewing" className="mt-4 inline-block text-blue-800 underline">
          Sewing Queue
        </a>
      )}
      <div>
        <LogoutButton />
      </div>
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