import { NextResponse } from 'next/server';

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function errorResponse(e: unknown) {
  if (e instanceof HttpError) {
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
  console.error(e);
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}
export function parseId(raw: string): number {
  if (!/^\d{1,9}$/.test(raw)) throw new HttpError(400, 'Invalid id');
  return Number(raw);
}