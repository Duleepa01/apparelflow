'use client';
import { useRouter } from 'next/navigation';

export default function LogoutButton() {
  const router = useRouter();
  return (
    <button
      className="mt-4 rounded border border-gray-700 px-3 py-1 text-gray-900"
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