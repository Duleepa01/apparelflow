'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type Pending = {
  id: number; order_no: string; target_qty: number;
  fabric_roll_id: string; recipe_code: string; recipe_name: string;
};
type Item = { component_id: number; component_name: string; expected_qty: number; actual_qty: number | null };
type Detail = {
  id: number; order_no: string; target_qty: number; fabric_roll_id: string;
  actual_fabric_yds: number; std_fabric_yards: number; wastage_cap: number;
  recipe_code: string; recipe_name: string; items: Item[];
};
type Flag = 'GREEN' | 'YELLOW' | 'RED' | null;

const JSON_HEADERS = { 'Content-Type': 'application/json' };
const inputCls =
  'w-24 rounded border border-gray-500 bg-white px-2 py-1 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-700';

function flagOf(expected: number, raw: string): Flag {
  if (!/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  return n < expected ? 'RED' : n > expected ? 'YELLOW' : 'GREEN';
}

const BADGE: Record<string, string> = {
  GREEN: 'bg-green-100 text-green-900 border-green-800',
  YELLOW: 'bg-yellow-100 text-yellow-900 border-yellow-800',
  RED: 'bg-red-100 text-red-900 border-red-800',
};
const LABEL: Record<string, string> = {
  GREEN: 'GREEN · Match',
  YELLOW: 'YELLOW · Excess',
  RED: 'RED · Shortage',
};

export default function VerifyClient({ name }: { name: string }) {
  const router = useRouter();
  const [orders, setOrders] = useState<Pending[]>([]);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [inputs, setInputs] = useState<Record<number, string>>({});
  const [note, setNote] = useState('');
  const [noteErr, setNoteErr] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

   const fetchPending = useCallback(async (): Promise<Pending[] | null> => {
    const r = await fetch('/api/verification/orders');
    if (r.status === 401) {
      router.push('/login');
      return null;
    }
    return r.ok ? r.json() : null;
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    fetchPending().then((d) => {
      if (!cancelled && d) setOrders(d);
    });
    return () => {
      cancelled = true;
    };
  }, [fetchPending]);

  async function loadList() {
    const d = await fetchPending();
    if (d) setOrders(d);
  }

  async function open(id: number) {
    setMsg(null);
    setNote('');
    setNoteErr('');
    const r = await fetch(`/api/verification/orders/${id}`);
    if (!r.ok) {
      setMsg({ ok: false, text: 'Could not load order' });
      return;
    }
    const d: Detail = await r.json();
    setDetail(d);
    setInputs(
      Object.fromEntries(d.items.map((i) => [i.component_id, i.actual_qty === null ? '' : String(i.actual_qty)]))
    );
  }

  async function fail(res: Response) {
    const d = await res.json().catch(() => ({}));
    setMsg({ ok: false, text: d.error ?? 'Request failed' });
    setBusy(false);
  }

  async function approve() {
    if (!detail) return;
    setBusy(true);
    setMsg(null);
    const counts = detail.items.map((i) => ({
      component_id: i.component_id,
      actual_qty: Number(inputs[i.component_id]),
    }));
    const put = await fetch(`/api/verification/orders/${detail.id}/counts`, {
      method: 'PUT', headers: JSON_HEADERS, body: JSON.stringify({ counts }),
    });
    if (!put.ok) return fail(put);
    const res = await fetch(`/api/verification/orders/${detail.id}/approve`, { method: 'POST' });
    if (!res.ok) return fail(res);
    setMsg({ ok: true, text: `${detail.order_no} verified and released to the Sewing Queue.` });
    setDetail(null);
    setBusy(false);
    loadList();
  }

  async function reject() {
    if (!detail) return;
    if (!note.trim()) {
      setNoteErr('A rejection reason is required');
      return;
    }
    setNoteErr('');
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/verification/orders/${detail.id}/reject`, {
      method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ note }),
    });
    if (!res.ok) return fail(res);
    setMsg({ ok: true, text: `${detail.order_no} rejected and returned to the supervisor.` });
    setDetail(null);
    setBusy(false);
    loadList();
  }

  const flags = detail ? detail.items.map((i) => flagOf(i.expected_qty, inputs[i.component_id] ?? '')) : [];
  const allCounted = flags.length > 0 && flags.every((f) => f !== null);
  const anyRed = flags.includes('RED');
  const canApprove = allCounted && !anyRed && !busy;

  const expectedFabric = detail ? detail.std_fabric_yards * detail.target_qty : 0;
  const wastage = detail ? ((detail.actual_fabric_yds - expectedFabric) / expectedFabric) * 100 : 0;

  return (
    <main className="mx-auto max-w-6xl p-6 text-gray-900">
      <h1 className="text-2xl font-bold">Verification Terminal</h1>
      <p className="mb-6 text-sm">
        {name} (Cutting Verifier) · <Link className="text-blue-800 underline" href="/">Home</Link>
      </p>

      {msg && (
        <p role="alert" className={`mb-4 rounded border p-3 font-medium ${msg.ok ? 'border-green-800 bg-green-100 text-green-900' : 'border-red-800 bg-red-100 text-red-900'}`}>
          {msg.text}
        </p>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        <section>
          <h2 className="mb-2 font-semibold">Pending verification ({orders.length})</h2>
          <ul className="space-y-2">
            {orders.length === 0 && <li className="text-sm">No orders waiting.</li>}
            {orders.map((o) => (
              <li key={o.id}>
                <button
                  onClick={() => open(o.id)}
                  className={`w-full rounded border p-3 text-left ${detail?.id === o.id ? 'border-blue-800 bg-blue-50' : 'border-gray-400 bg-white'}`}
                >
                  <strong>{o.order_no}</strong>
                  <br />
                  <span className="text-sm">{o.recipe_code} · {o.recipe_name}</span>
                  <br />
                  <span className="text-sm">Qty {o.target_qty} · {o.fabric_roll_id}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="md:col-span-2">
          {!detail && <p className="text-sm">Select an order to start counting.</p>}
          {detail && (
            <div className="space-y-4 rounded border border-gray-400 p-4">
              <div>
                <h2 className="text-lg font-bold">{detail.order_no} · {detail.recipe_name}</h2>
                <p className="text-sm">
                  Batch {detail.target_qty} · Roll {detail.fabric_roll_id} · Fabric used {detail.actual_fabric_yds} yds
                  (expected {expectedFabric.toFixed(2)})
                </p>
                <p className="text-sm">
                  Wastage <strong>{wastage.toFixed(2)}%</strong> (cap {detail.wastage_cap}%)
                  {wastage > detail.wastage_cap && ' — above cap (informational)'}
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-2 py-2">Component</th>
                      <th className="px-2 py-2">Expected</th>
                      <th className="px-2 py-2">Counted</th>
                      <th className="px-2 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.items.map((i, idx) => {
                      const raw = inputs[i.component_id] ?? '';
                      const f = flags[idx];
                      return (
                        <tr key={i.component_id} className="border-t border-gray-300">
                          <td className="px-2 py-2">{i.component_name}</td>
                          <td className="px-2 py-2 font-medium">{i.expected_qty}</td>
                          <td className="px-2 py-2">
                            <input
                              aria-label={`Counted ${i.component_name}`}
                              className={inputCls}
                              inputMode="numeric"
                              placeholder="0"
                              value={raw}
                              onChange={(ev) => setInputs({ ...inputs, [i.component_id]: ev.target.value })}
                            />
                            {raw !== '' && !f && (
                              <p role="alert" className="text-xs font-medium text-red-700">Whole number ≥ 0</p>
                            )}
                          </td>
                          <td className="px-2 py-2">
                            {f ? (
                              <span className={`rounded border px-2 py-1 text-xs font-semibold ${BADGE[f]}`}>{LABEL[f]}</span>
                            ) : (
                              <span className="text-xs">Not counted</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {!canApprove && !busy && (
                <p className="text-sm font-medium">
                  {anyRed
                    ? 'Approve blocked: at least one component has a shortage. Reject the batch instead.'
                    : 'Approve unavailable until every component is counted.'}
                </p>
              )}

              <button
                onClick={approve}
                disabled={!canApprove}
                className="rounded bg-green-800 px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:bg-gray-400 disabled:text-gray-900"
              >
                Approve Batch
              </button>

              <div className="border-t border-gray-300 pt-4">
                <label className="block text-sm font-medium">
                  Rejection reason (required to reject)
                  <textarea
                    className="mt-1 w-full rounded border border-gray-500 bg-white px-3 py-2 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-700"
                    rows={3}
                    maxLength={500}
                    placeholder="e.g. Sleeve cuffs short by 2 pieces"
                    value={note}
                    onChange={(ev) => setNote(ev.target.value)}
                  />
                </label>
                {noteErr && <p role="alert" className="mt-1 text-sm font-medium text-red-700">{noteErr}</p>}
                <button
                  onClick={reject}
                  disabled={busy}
                  className="mt-2 rounded bg-red-800 px-4 py-2 font-medium text-white disabled:opacity-60"
                >
                  Reject Batch
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}