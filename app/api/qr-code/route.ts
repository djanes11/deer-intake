import 'server-only';
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';

function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function fallbackSvg(targetUrl: string, size: number) {
  const safeUrl = escapeXml(targetUrl);
  const fontSize = Math.max(12, Math.round(size * 0.04));
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#ffffff"/>
  <rect x="12" y="12" width="${size - 24}" height="${size - 24}" rx="20" fill="#f8fafc" stroke="#cbd5e1" stroke-width="2"/>
  <text x="50%" y="20%" text-anchor="middle" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="700" fill="#0f172a">
    Public Intake URL
  </text>
  <foreignObject x="40" y="${Math.round(size * 0.28)}" width="${size - 80}" height="${Math.round(size * 0.48)}">
    <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: Arial, sans-serif; font-size:${fontSize}px; color:#334155; word-break:break-word; line-height:1.4; text-align:center;">
      ${safeUrl}
    </div>
  </foreignObject>
  <text x="50%" y="90%" text-anchor="middle" font-family="Arial, sans-serif" font-size="${Math.max(11, fontSize - 1)}" fill="#64748b">
    QR could not be generated. Open this URL manually.
  </text>
</svg>`;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const data = String(searchParams.get('data') || '').trim();
  const size = Math.min(1200, Math.max(200, Number(searchParams.get('size') || 420) || 420));

  if (!data) {
    return new NextResponse('Missing QR data.', { status: 400 });
  }

  try {
    const upstream = new URL('https://api.qrserver.com/v1/create-qr-code/');
    upstream.searchParams.set('size', `${size}x${size}`);
    upstream.searchParams.set('margin', '18');
    upstream.searchParams.set('format', 'svg');
    upstream.searchParams.set('data', data);

    const res = await fetch(upstream.toString(), {
      cache: 'force-cache',
      next: { revalidate: 86400 },
    });

    if (res.ok) {
      const body = await res.text();
      return new NextResponse(body, {
        headers: {
          'content-type': 'image/svg+xml; charset=utf-8',
          'cache-control': 'public, max-age=86400, stale-while-revalidate=86400',
        },
      });
    }
  } catch {
    // fall through to local fallback SVG
  }

  return new NextResponse(fallbackSvg(data, size), {
    headers: {
      'content-type': 'image/svg+xml; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}
