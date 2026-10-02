import { NextRequest, NextResponse } from 'next/server';

const BASE_API_URL = 'https://ampremnyxie.vercel.app/api';

// Rate Limiting Configuration:
// Max 10 accounts per IP / day (24 hours)
// Cooldown 3 minutes (180 seconds) per request / IP
const MAX_ACCOUNTS_PER_DAY = 10;
const COOLDOWN_MS = 3 * 60 * 1000; // 3 minutes in milliseconds
const ONE_DAY_MS = 24 * 60 * 60 * 1000; // 24 hours

interface RateLimitRecord {
  lastRequestTime: number;
  timestamps: number[];
}

const rateLimitStore = new Map<string, RateLimitRecord>();

function getClientIp(req: NextRequest): string {
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  const realIp = req.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }
  return 'default-ip';
}

function checkRateLimit(ip: string): { allowed: boolean; message?: string; retryAfterSeconds?: number } {
  const now = Date.now();
  const record = rateLimitStore.get(ip) || { lastRequestTime: 0, timestamps: [] };

  // Filter timestamps within the last 24 hours
  record.timestamps = record.timestamps.filter((t) => now - t < ONE_DAY_MS);

  // Check 3-minute cooldown between requests
  const timeSinceLast = now - record.lastRequestTime;
  if (record.lastRequestTime > 0 && timeSinceLast < COOLDOWN_MS) {
    const remainingSeconds = Math.ceil((COOLDOWN_MS - timeSinceLast) / 1000);
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;
    const timeFormatted = minutes > 0 ? `${minutes} menit ${seconds} detik` : `${seconds} detik`;
    return {
      allowed: false,
      message: `Mohon tunggu cooldown 3 menit sebelum mengirim permintaan berikutnya (${timeFormatted} lagi).`,
      retryAfterSeconds: remainingSeconds,
    };
  }

  // Check daily limit (10 accounts per day)
  if (record.timestamps.length >= MAX_ACCOUNTS_PER_DAY) {
    const oldestTimestamp = record.timestamps[0];
    const resetTime = oldestTimestamp + ONE_DAY_MS;
    const remainingHours = Math.ceil((resetTime - now) / (1000 * 60 * 60));
    return {
      allowed: false,
      message: `Batas harian tercapai (maksimal ${MAX_ACCOUNTS_PER_DAY} akun per hari). Coba lagi dalam ~${remainingHours} jam.`,
      retryAfterSeconds: Math.ceil((resetTime - now) / 1000),
    };
  }

  return { allowed: true };
}

function recordSuccessRequest(ip: string) {
  const now = Date.now();
  const record = rateLimitStore.get(ip) || { lastRequestTime: 0, timestamps: [] };
  record.lastRequestTime = now;
  record.timestamps.push(now);
  rateLimitStore.set(ip, record);
}

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const body = await req.json();
    const { action, email, link } = body;

    if (!action) {
      return NextResponse.json(
        { ok: false, message: 'Action diperlukan (send atau verify).' },
        { status: 400 }
      );
    }

    if (action === 'send') {
      if (!email || typeof email !== 'string') {
        return NextResponse.json(
          { ok: false, message: 'Email tidak boleh kosong.' },
          { status: 400 }
        );
      }

      // Check rate limit on 'send' action
      const rateLimitCheck = checkRateLimit(ip);
      if (!rateLimitCheck.allowed) {
        return NextResponse.json(
          {
            ok: false,
            message: rateLimitCheck.message,
            rateLimited: true,
            retryAfter: rateLimitCheck.retryAfterSeconds,
          },
          {
            status: 429,
            headers: {
              'Retry-After': String(rateLimitCheck.retryAfterSeconds || 180),
            },
          }
        );
      }

      const remoteRes = await fetch(`${BASE_API_URL}/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        },
        body: JSON.stringify({ email: email.trim() }),
      });

      let remoteData: any;
      try {
        remoteData = await remoteRes.json();
      } catch {
        return NextResponse.json(
          { ok: false, message: 'Server remote tidak mengembalikan JSON valid.' },
          { status: remoteRes.status || 502 }
        );
      }

      if (!remoteData.message && remoteData.error) {
        remoteData.message = remoteData.error;
      }

      // If send link succeeded, record rate limit timestamp
      if (remoteData.ok) {
        recordSuccessRequest(ip);
      }

      return NextResponse.json(remoteData, {
        status: remoteRes.status || (remoteData.ok ? 200 : 400),
      });
    }

    if (action === 'verify') {
      if (!email || !link) {
        return NextResponse.json(
          { ok: false, message: 'Email dan Magic link diperlukan.' },
          { status: 400 }
        );
      }

      const remoteRes = await fetch(`${BASE_API_URL}/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        },
        body: JSON.stringify({
          email: email.trim(),
          link: link.trim(),
        }),
      });

      let remoteData: any;
      try {
        remoteData = await remoteRes.json();
      } catch {
        return NextResponse.json(
          { ok: false, message: 'Server remote tidak mengembalikan JSON valid.' },
          { status: remoteRes.status || 502 }
        );
      }

      if (!remoteData.message && remoteData.error) {
        remoteData.message = remoteData.error;
      }

      return NextResponse.json(remoteData, {
        status: remoteRes.status || (remoteData.ok ? 200 : 400),
      });
    }

    return NextResponse.json(
      { ok: false, message: `Action "${action}" tidak dikenali.` },
      { status: 400 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, message: error?.message || 'Gagal menghubungi server upstream Alight Motion.' },
      { status: 500 }
    );
  }
}
