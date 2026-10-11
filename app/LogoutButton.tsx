'use client';
import { useRouter } from 'next/navigation';

export default function LogoutButton() {
  const router = useRouter();
  return (
    <button
      className="rounded-sm border border-stone-400 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10"
      onClick={async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        router.push('/login');
        router.refresh();
      }}
    >
      Log out
    </button>
  );
}