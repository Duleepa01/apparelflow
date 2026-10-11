'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import PageShell from '@/components/PageShell';
import StatusBadge from '@/components/StatusBadge';

type Variance = { component_name: string; expected: number; actual: number; variance: number };
type QueueOrder = {
  id: number; order_no: string; target_qty: number; fabric_roll_id: string;
  actual_fabric_yds: number; recipe_code: string; recipe_name: string;
  wastage_pct: number; variances: Variance[]; decided_at: string; verified_by: string;
};

export default function SewingClient({ name }: { name: string }) {
  const router = useRouter();
  const [orders, setOrders] = useState<QueueOrder[]>([]);
  const [openId, setOpenId] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const fetchQueue = useCallback(async (): Promise<QueueOrder[] | null> => {
    const r = await fetch('/api/sewing/queue');
    if (r.status === 401) {
      router.push('/login');
      return null;
    }
    return r.ok ? r.json() : null;
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    fetchQueue().then((d) => {
      if (!cancelled && d) setOrders(d);
    });
    return () => {
      cancelled = true;
    };
  }, [fetchQueue]);

  async function start(o: QueueOrder) {
    setBusyId(o.id);
    setMsg(null);
    const res = await fetch(`/api/sewing/orders/${o.id}/start`, { method: 'POST' });
    setBusyId(null);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setMsg({ ok: false, text: d.error ?? 'Request failed' });
    } else {
      setMsg({ ok: true, text: `${o.order_no} sent to sewing assembly.` });
    }
    const d = await fetchQueue();
    if (d) setOrders(d);
  }

  return (
    <PageShell name={name} role="sewing_supervisor" title="Sewing Queue">
      {msg && (
        <p role="alert" className={`mb-4 rounded border p-3 font-medium ${msg.ok ? 'border-green-800 bg-green-100 text-green-900' : 'border-red-800 bg-red-100 text-red-900'}`}>
          {msg.text}
        </p>
      )}

      {orders.length === 0 && (
        <p className="card p-4 text-sm">No verified batches waiting.</p>
      )}

      <ul className="space-y-4">
        {orders.map((o) => (
          <li key={o.id} className="card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-bold">{o.order_no} · {o.recipe_name} ({o.recipe_code})</h2>
                  <StatusBadge status="VERIFIED" />
                </div>
                <p className="mt-1 text-sm">
                  Batch {o.target_qty} · Roll {o.fabric_roll_id} · Fabric used {o.actual_fabric_yds} yds · Wastage{' '}
                  <strong>{o.wastage_pct}%</strong>
                </p>
                <p className="text-sm">
                  Verified by <strong>{o.verified_by}</strong> on {new Date(o.decided_at).toLocaleString()}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setOpenId(openId === o.id ? null : o.id)}
                  className="rounded border border-blue-800 px-3 py-2 text-sm font-medium text-blue-800"
                >
                  {openId === o.id ? 'Hide piece counts' : 'Piece counts'}
                </button>
                <button
                  onClick={() => start(o)}
                  disabled={busyId === o.id}
                  className="rounded bg-blue-800 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
                >
                  Start Sewing Assembly
                </button>
              </div>
            </div>

            {openId === o.id && (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="px-2 py-2">Component</th>
                      <th className="px-2 py-2">Expected</th>
                      <th className="px-2 py-2">Counted</th>
                      <th className="px-2 py-2">Variance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {o.variances.map((v) => (
                      <tr key={v.component_name} className="border-t border-slate-300">
                        <td className="px-2 py-2">{v.component_name}</td>
                        <td className="px-2 py-2">{v.expected}</td>
                        <td className="px-2 py-2">{v.actual}</td>
                        <td className="px-2 py-2 font-medium">
                          {v.variance === 0 ? 'Match' : `Excess +${v.variance}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </li>
        ))}
      </ul>
    </PageShell>
  );
}