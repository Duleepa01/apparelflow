'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';


type Comp = { id: number; component_name: string; pieces_per_garment: number };
type Recipe = {
  id: number; recipe_code: string; name: string;
  std_fabric_yards: number; wastage_cap: number; components: Comp[];
};
type Order = {
  id: number; order_no: string; status: string; target_qty: number;
  fabric_roll_id: string; actual_fabric_yds: number; created_at: string;
  recipe_code: string; recipe_name: string; rejection_note: string | null;
};
type Form = { recipeId: string; qty: string; roll: string; yards: string };

const emptyForm: Form = { recipeId: '', qty: '', roll: '', yards: '' };
const inputCls =
  'w-full rounded border border-gray-500 bg-white px-3 py-2 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-700';

function validate(f: Form) {
  const e: Record<string, string> = {};
  if (!f.recipeId) e.recipe_id = 'Select a recipe';
  if (!/^\d+$/.test(f.qty) || Number(f.qty) < 1 || Number(f.qty) > 100000)
    e.target_qty = 'Enter a whole number between 1 and 100000';
  if (!/^[A-Za-z0-9_-]{1,50}$/.test(f.roll.trim()))
    e.fabric_roll_id = 'Use letters, digits, - or _ (max 50 characters)';
  if (!/^\d+(\.\d{1,2})?$/.test(f.yards) || Number(f.yards) <= 0 || Number(f.yards) > 1000000)
    e.actual_fabric_yds = 'Enter a positive number, max 2 decimals';
  return e;
}

async function fetchData() {
  const [r, o] = await Promise.all([fetch('/api/recipes'), fetch('/api/orders')]);
  if (r.status === 401 || o.status === 401) return { kind: 'unauthorized' as const };
  if (!r.ok || !o.ok) return { kind: 'error' as const };
  return {
    kind: 'ok' as const,
    recipes: (await r.json()) as Recipe[],
    orders: (await o.json()) as Order[],
  };
}

function FieldError({ msg }: { msg?: string }) {
  return msg ? (
    <p role="alert" className="mt-1 text-sm font-medium text-red-700">{msg}</p>
  ) : null;
}

export default function OrdersClient({ name }: { name: string }) {
  const router = useRouter();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadError, setLoadError] = useState('');
  const [reload, setReload] = useState(0);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    fetchData().then((d) => {
      if (!active) return;
      if (d.kind === 'unauthorized') {
        router.push('/login');
      } else if (d.kind === 'error') {
        setLoadError('Failed to load data');
      } else {
        setLoadError('');
        setRecipes(d.recipes);
        setOrders(d.orders);
      }
    });
    return () => {
      active = false;
    };
  }, [reload, router]);

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    const errs = validate(form);
    setErrors(errs);
    setSubmitError('');
    if (Object.keys(errs).length) return;

    setSaving(true);
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipe_id: Number(form.recipeId),
        target_qty: Number(form.qty),
        fabric_roll_id: form.roll.trim(),
        actual_fabric_yds: Number(form.yards),
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      if (d.fields) setErrors(d.fields);
      setSubmitError(d.error ?? 'Failed to create order');
      return;
    }
    setOpen(false);
    setForm(emptyForm);
    setErrors({});
    setReload((n) => n + 1);
  }

  async function resubmit(o: Order) {
    setLoadError('');
    const res = await fetch(`/api/orders/${o.id}/resubmit`, { method: 'POST' });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setLoadError(d.error ?? 'Resubmit failed');
    }
    setReload((n) => n + 1);
  }

  const recipe = recipes.find((r) => r.id === Number(form.recipeId));
  const qtyOk = /^\d+$/.test(form.qty) && Number(form.qty) >= 1;
  const set = (k: keyof Form) => (ev: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: ev.target.value }));

  return (
    <main className="mx-auto max-w-5xl p-6 text-gray-900">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Cutting Orders</h1>
          <p className="text-sm">
            {name} (Cutting Supervisor) ·{' '}
            <Link className="text-blue-800 underline" href="/">Home</Link>
          </p>
        </div>
        <button
          onClick={() => { setErrors({}); setSubmitError(''); setOpen(true); }}
          className="rounded bg-blue-800 px-4 py-2 font-medium text-white"
        >
          New Cutting Order
        </button>
      </div>

      {loadError && <p role="alert" className="mb-4 font-medium text-red-700">{loadError}</p>}

      <div className="overflow-x-auto rounded border border-gray-300">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-100">
            <tr>
              {['Order', 'Recipe', 'Qty', 'Fabric roll', 'Yards used', 'Status', 'Created', 'Note / action'].map((h) => (
                <th key={h} className="px-3 py-2 font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-4">No orders yet.</td></tr>
            )}
            {orders.map((o) => (
              <tr key={o.id} className="border-t border-gray-300">
                <td className="px-3 py-2 font-medium">{o.order_no}</td>
                <td className="px-3 py-2">{o.recipe_code} · {o.recipe_name}</td>
                <td className="px-3 py-2">{o.target_qty}</td>
                <td className="px-3 py-2">{o.fabric_roll_id}</td>
                <td className="px-3 py-2">{o.actual_fabric_yds}</td>
                <td className="px-3 py-2 font-medium">{o.status}</td>
                <td className="px-3 py-2">{new Date(o.created_at).toLocaleString()}</td>
                <td className="px-3 py-2">
                  {o.status === 'REJECTED' && (
                    <div>
                      <p className="mb-1 font-medium text-red-900">Rejected: {o.rejection_note}</p>
                      <button
                        onClick={() => resubmit(o)}
                        className="rounded border border-blue-800 px-3 py-1 text-sm font-medium text-blue-800"
                      >
                        Resubmit for verification
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="fixed inset-0 z-10 flex items-start justify-center overflow-y-auto bg-black/60 p-4">
          <form onSubmit={submit} noValidate className="my-8 w-full max-w-lg space-y-3 rounded bg-white p-5 text-gray-900">
            <h2 className="text-xl font-bold">New Cutting Order</h2>

            <label className="block text-sm font-medium">
              Recipe
              <select className={inputCls} value={form.recipeId} onChange={set('recipeId')}>
                <option value="">Select a recipe…</option>
                {recipes.map((r) => (
                  <option key={r.id} value={r.id}>{r.recipe_code} - {r.name}</option>
                ))}
              </select>
              <FieldError msg={errors.recipe_id} />
            </label>

            <label className="block text-sm font-medium">
              Target batch quantity
              <input className={inputCls} inputMode="numeric" placeholder="e.g. 50" value={form.qty} onChange={set('qty')} />
              <FieldError msg={errors.target_qty} />
            </label>

            <label className="block text-sm font-medium">
              Fabric roll ID
              <input className={inputCls} placeholder="e.g. FAB-ROLL-882" value={form.roll} onChange={set('roll')} />
              <FieldError msg={errors.fabric_roll_id} />
            </label>

            <label className="block text-sm font-medium">
              Actual fabric used (yards)
              <input className={inputCls} inputMode="decimal" placeholder="e.g. 92.5" value={form.yards} onChange={set('yards')} />
              <FieldError msg={errors.actual_fabric_yds} />
            </label>

            {recipe && qtyOk && (
              <div className="rounded border border-gray-400 p-3 text-sm">
                <p className="mb-1 font-semibold">Expected component counts</p>
                <ul>
                  {recipe.components.map((c) => (
                    <li key={c.id}>
                      {c.component_name}: {c.pieces_per_garment} × {form.qty} = <strong>{c.pieces_per_garment * Number(form.qty)}</strong>
                    </li>
                  ))}
                </ul>
                <p className="mt-2">
                  Expected fabric: <strong>{(recipe.std_fabric_yards * Number(form.qty)).toFixed(2)} yds</strong>
                </p>
              </div>
            )}

            {submitError && <p role="alert" className="font-medium text-red-700">{submitError}</p>}

            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="rounded border border-gray-700 px-4 py-2">
                Cancel
              </button>
              <button disabled={saving} className="rounded bg-blue-800 px-4 py-2 font-medium text-white disabled:opacity-60">
                {saving ? 'Submitting…' : 'Submit for verification'}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}