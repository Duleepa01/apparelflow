import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { errorResponse } from '@/lib/http';
import { getSewingQueue } from '@/lib/sewing';

export async function GET() {
  try {
    await requireRole('sewing_supervisor');
    return NextResponse.json(await getSewingQueue());
  } catch (e) {
    return errorResponse(e);
  }
}