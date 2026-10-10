import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { errorResponse, parseId } from '@/lib/http';
import { startSewing } from '@/lib/sewing';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole('sewing_supervisor');
    const id = parseId((await params).id);
    return NextResponse.json(await startSewing(id));
  } catch (e) {
    return errorResponse(e);
  }
}