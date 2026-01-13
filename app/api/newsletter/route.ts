// This file has been deprecated.
// Please use /api/cron/send-newsletters instead.

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    { 
      error: 'This endpoint is deprecated. Please use /api/cron/send-newsletters',
      redirect: '/api/cron/send-newsletters'
    },
    { status: 410 } // 410 Gone
  );
}

export async function POST() {
  return NextResponse.json(
    { 
      error: 'This endpoint is deprecated. Please use /api/cron/send-newsletters',
      redirect: '/api/cron/send-newsletters'
    },
    { status: 410 }
  );
}
