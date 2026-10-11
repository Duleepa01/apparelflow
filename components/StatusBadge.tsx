const STYLES: Record<string, string> = {
  PENDING_VERIFICATION: 'bg-amber-100 text-amber-900 border-amber-700',
  REJECTED: 'bg-red-100 text-red-900 border-red-800',
  VERIFIED: 'bg-green-100 text-green-900 border-green-800',
  SEWING_STARTED: 'bg-blue-100 text-blue-900 border-blue-800',
  CUTTING_IN_PROGRESS: 'bg-gray-100 text-gray-900 border-gray-700',
};

export default function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded-sm border px-2 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wide ${STYLES[status] ?? STYLES.CUTTING_IN_PROGRESS}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}