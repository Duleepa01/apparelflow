import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { ROLE_INFO } from '@/lib/demo';

async function Go(): Promise<null> {
  const s = await getSession();
  redirect(s ? ROLE_INFO[s.role].href : '/login');
}

export default function Home() {
  return (
    <Suspense fallback={null}>
      <Go />
    </Suspense>
  );
}