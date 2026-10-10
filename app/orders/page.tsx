import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import OrdersClient from './OrdersClient';

async function Guard() {
  const s = await getSession();
  if (!s) redirect('/login');
  if (s.role !== 'cutting_supervisor') redirect('/');
  return <OrdersClient name={s.name} />;
}

export default function OrdersPage() {
  return (
    <Suspense fallback={<p className="p-8 text-gray-900">Loading…</p>}>
      <Guard />
    </Suspense>
  );
}
