import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { timingSafeEqual } from '@/lib/security';

export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret');

  if (
    !process.env.REVALIDATE_SECRET ||
    !secret ||
    !timingSafeEqual(secret, process.env.REVALIDATE_SECRET)
  ) {
    return NextResponse.json({ error: 'Invalid secret.' }, { status: 401 });
  }

  // Invalidate the landing page (pricing teaser + testimonials) and pricing calculator
  revalidatePath('/', 'page');
  revalidatePath('/pricing', 'page');

  return NextResponse.json({
    revalidated: true,
    timestamp: new Date().toISOString(),
  });
}

// Also support GET so the owner can trigger revalidation from the browser
export async function GET(req: NextRequest) {
  return POST(req);
}
