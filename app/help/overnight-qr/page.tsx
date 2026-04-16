// app/help/overnight-qr/page.tsx
import 'server-only';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import { getStaffProcessorContext } from '@/lib/staffContext';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function normalizeHostname(value: unknown) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .split('/')[0]
    .split(':')[0];
}

function qrImageUrl(targetUrl: string) {
  const params = new URLSearchParams({
    data: targetUrl,
    size: '420',
  });
  return `/api/qr-code?${params.toString()}`;
}

export default async function OvernightQRPage() {
  const processor = await getStaffProcessorContext().catch(() => null);
  let processorName = processor?.slug || 'this processor';
  let publicHostname = '';

  if (processor?.id && SUPABASE_URL && SERVICE_KEY) {
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
    const { data } = await supabase
      .from('processors')
      .select('name,public_name,public_hostname')
      .eq('id', processor.id)
      .maybeSingle();

    processorName = String(data?.public_name || data?.name || processorName);
    publicHostname = normalizeHostname(data?.public_hostname);
  }

  const intakeUrl = publicHostname ? `https://${publicHostname}/overnight` : '';
  const statusUrl = publicHostname ? `https://${publicHostname}/status` : '';

  return (
    <main className="light-page" style={{ margin: '0 auto', maxWidth: 960, padding: '18px 14px 40px' }}>
      <section className="form-card" style={{ padding: 18, borderRadius: 18, display: 'grid', gap: 16 }}>
        <div style={{ display: 'grid', gap: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase', color: '#9a6a2f' }}>
            Public Intake QR
          </div>
          <h1 style={{ margin: 0, color: '#0f172a' }}>Scan Here for {processorName}</h1>
          <p style={{ margin: 0, color: '#475569', lineHeight: 1.55 }}>
            Print this page and post it at the drop location. This QR is generated from this processor&apos;s public
            hostname, so customers land on the correct public intake page.
          </p>
        </div>

        {!intakeUrl ? (
          <div style={{ padding: 14, borderRadius: 14, background: '#fff7ed', border: '1px solid #fed7aa', color: '#9a3412', fontWeight: 800, lineHeight: 1.5 }}>
            This processor does not have a public hostname set yet. Add one in Processor Management before printing a QR code.
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 420px) 1fr', gap: 18, alignItems: 'center' }}>
              <div style={{ background: '#fff', border: '1px solid #dbe4ee', borderRadius: 18, padding: 16, boxShadow: '0 16px 36px rgba(15,23,42,.08)' }}>
                <img
                  src={qrImageUrl(intakeUrl)}
                  alt={`QR code for ${processorName} public intake`}
                  width={420}
                  height={420}
                  style={{ display: 'block', width: '100%', height: 'auto' }}
                />
              </div>
              <div style={{ display: 'grid', gap: 12 }}>
                <div style={{ padding: 14, borderRadius: 14, background: '#f8fafc', border: '1px solid #dbe4ee', color: '#0f172a' }}>
                  <div style={{ fontSize: 12, fontWeight: 900, color: '#64748b', letterSpacing: '.06em', textTransform: 'uppercase' }}>
                    QR opens
                  </div>
                  <div style={{ marginTop: 6, fontWeight: 900, overflowWrap: 'anywhere' }}>{intakeUrl}</div>
                </div>
                <div style={{ color: '#475569', lineHeight: 1.55 }}>
                  Before printing, scan the QR once with your phone and confirm the logo/name on the public site matches
                  <strong> {processorName}</strong>.
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <Link href={intakeUrl} target="_blank" style={{ textDecoration: 'none' }}>
                    <span className="btn">Test Public Intake</span>
                  </Link>
                  <Link href={statusUrl} target="_blank" style={{ textDecoration: 'none' }}>
                    <span className="btn secondary">Test Status Page</span>
                  </Link>
                  <span className="btn secondary">
                    Use browser print to save
                  </span>
                </div>
              </div>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
