export const DEMO_PASSWORD = 'Demo@1234';
export const DEMO = [
  { label: 'Cutting Supervisor', short: 'Supervisor', role: 'cutting_supervisor', email: 'supervisor@apparelflow.demo' },
  { label: 'Cutting Verifier', short: 'Verifier', role: 'cutting_verifier', email: 'verifier@apparelflow.demo' },
  { label: 'Sewing Supervisor', short: 'Sewing', role: 'sewing_supervisor', email: 'sewing@apparelflow.demo' },
];

export const ROLE_INFO: Record<string, { label: string; href: string; page: string; blurb: string }> = {
  cutting_supervisor: {
    label: 'Cutting Supervisor', href: '/orders', page: 'Cutting Orders',
    blurb: 'Create cutting orders from recipes, log fabric usage, and resubmit rejected batches.',
  },
  cutting_verifier: {
    label: 'Cutting Verifier', href: '/verify', page: 'Verification Terminal',
    blurb: 'Count physical pieces per component, then approve or reject each batch.',
  },
  sewing_supervisor: {
    label: 'Sewing Supervisor', href: '/sewing', page: 'Sewing Queue',
    blurb: 'Review verified batches with verifier audit notes and start sewing assembly.',
  },
};