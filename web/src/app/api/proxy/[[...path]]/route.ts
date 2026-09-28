import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const UPSTREAM = (
  process.env.API_BASE ||
  process.env.BACKEND_API_URL ||
  'http://localhost:5000'
).replace(/\/$/, '');

type RouteCtx = { params: Promise<{ path?: string[] }> };

async function forward(req: NextRequest, ctx: RouteCtx, method: string) {
  const { path: segments } = await ctx.params;
  const subpath = (segments ?? []).join('/');
  const url = `${UPSTREAM}/${subpath}${req.nextUrl.search}`;

  const headers = new Headers();
  const auth = req.headers.get('authorization');
  if (auth) headers.set('authorization', auth);
  const accept = req.headers.get('accept');
  if (accept) headers.set('accept', accept);
  const contentType = req.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);

  const appKey = process.env.APP_API_KEY?.trim();
  if (appKey) headers.set('X-API-Key', appKey);

  const init: RequestInit = { method, headers, cache: 'no-store' };
  if (method !== 'GET' && method !== 'HEAD') {
    init.body = await req.arrayBuffer();
  }

  const upstream = await fetch(url, init);
  const body = await upstream.arrayBuffer();
  const res = new NextResponse(body, { status: upstream.status });
  const ct = upstream.headers.get('content-type');
  if (ct) res.headers.set('content-type', ct);
  return res;
}

export async function GET(req: NextRequest, ctx: RouteCtx) {
  return forward(req, ctx, 'GET');
}

export async function POST(req: NextRequest, ctx: RouteCtx) {
  return forward(req, ctx, 'POST');
}

export async function PUT(req: NextRequest, ctx: RouteCtx) {
  return forward(req, ctx, 'PUT');
}

export async function PATCH(req: NextRequest, ctx: RouteCtx) {
  return forward(req, ctx, 'PATCH');
}

export async function DELETE(req: NextRequest, ctx: RouteCtx) {
  return forward(req, ctx, 'DELETE');
}
