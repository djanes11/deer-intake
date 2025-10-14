// app/overnight/page.tsx
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import CustomerHeader from '../components/CustomerHeader';


export const dynamic = 'force-dynamic';

// ---- Config ----
// Where to send folks when they click Start Intake (can override with ?to=/path)
const DEFAULT_TARGET =
  (process.env.NEXT_PUBLIC_DROP_START_PATH ?? '/intake/overnight') as string;

// Webbs price sheet (put a PDF at /public/webbs-price.pdf or point the env var at a URL)
const WEBBS_PRICE_URL =
  (process.env.NEXT_PUBLIC_WEBBS_PRICE_URL ?? '/webbs-price.pdf') as string;

// Optional crest image in /public or remote URL allowed by next.config
const CREST_SRC =
  (process.env.NEXT_PUBLIC_CREST_SRC ?? '/crest.png') as string;

// LocalStorage “you already acknowledged the steps” flag
const TTL_HOURS = 12;
const LS_KEY = 'dropPrepOK'; // JSON: { ok: true, at: epoch_ms }

function setPrepFlag() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ ok: true, at: Date.now() }));
  } catch {}
}
function isPrepFlagFresh(): boolean {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return false;
    const obj = JSON.parse(raw) as { ok?: boolean; at?: number };
    if (!obj?.ok || !obj?.at) return false;
    return Date.now() - obj.at < TTL_HOURS * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

export default function OvernightPrepPage() {
  const router = useRouter();
  const sp = useSearchParams();

  // staff/test bypass: /overnight?fast=1
  const fast = sp.get('fast') === '1';
  const target = sp.get('to') || DEFAULT_TARGET;

  const [ack, setAck] = useState(false);
  const canStart = fast || ack;

  const alreadyPrepped = useMemo(() => isPrepFlagFresh(), []);
  useEffect(() => {
    if (alreadyPrepped) setAck(true);
  }, [alreadyPrepped]);

  const goStart = () => {
    setPrepFlag();
    router.push(String(target));
  };

  return (
    <main style={shell}>
      {/* Header with crest + nav */}
      <header style={header}>
        <div style={logoWrap}>
          {/* If crest image exists, show it. Otherwise show a brand square. */}
          {CREST_SRC ? (
            <Image
              src={CREST_SRC}
              alt="McAfee crest"
              width={36}
              height={36}
              style={{ borderRadius: 8, objectFit: 'cover' }}
              priority
            />
          ) : (
            <span aria-hidden style={logoFallback} />
          )}
          <span style={brand}>McAfee Custom Deer Processing</span>
        </div>
        <nav aria-label="Primary" style={nav}>
          <Link href="/" style={navLink}>Home</Link>
          <Link href="/status" style={navLink}>Check Status</Link>
          <Link href="/faq-public" style={navLink}>FAQ</Link>
        </nav>
      </header>

      {/* Instructions card */}
      <section style={card}>
        <div style={eyebrow}>Overnight Drop</div>
        <h1 style={title}>Before you start</h1>
        <p style={sub}>
          Quick instructions for the after-hours drop. The intake form takes about a minute.
        </p>

        {/* Steps */}
        <ol style={steps}>
          <li style={step}>
            <div style={bullet}>1</div>
            <div>
              <div style={stepTitle}>Stop at the first door</div>
              <div style={stepText}>
                Grab a <b>deer tag</b>. If you want <b>Webbs Specialty</b>, also grab a Webbs form.
              </div>
            </div>
          </li>

          <li style={step}>
            <div style={bullet}>2</div>
            <div>
              <div style={stepTitle}>Drive to the rear 24/7 Drop</div>
              <div style={stepText}>
                Continue to the back of the barn. You’ll see a cooler door marked <b>“24/7 DROP”</b>.
              </div>
            </div>
          </li>

          <li style={step}>
            <div style={bullet}>3</div>
            <div>
              <div style={stepTitle}>DNR Confirmation Required</div>
              <div style={stepText}>
                You must already have a <b>Confirmation #</b> from your check-in on{' '}
                <a
                  href="https://www.gooutdoorsin.com/login"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#a7e3ba', textDecoration: 'underline', fontWeight: 800 }}
                >
                  GoOutdoorsIN
                </a>
                . If you don’t have a confirmation, we <b>will not process</b> your deer.
              </div>
            </div>
          </li>

          <li style={step}>
            <div style={bullet}>4</div>
            <div>
              <div style={stepTitle}>Webbs (optional)</div>
              <div style={stepText}>
                Fill out the Webbs form. On the intake, enter the <b>Webbs form #</b> and the
                <b> number of pounds</b> you want sent. Keep the <b>back copy</b> and leave the other
                two copies in the <b>mailbox inside the cooler</b>.{' '}
                <a
                  href={WEBBS_PRICE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                  style={{ color: '#a7e3ba', textDecoration: 'underline', fontWeight: 800 }}
                >
                  Download Webbs price sheet
                </a>
                .
              </div>
            </div>
          </li>

          <li style={step}>
            <div style={bullet}>5</div>
            <div>
              <div style={stepTitle}>Fill out the intake form</div>
              <div style={stepText}>
                Tap <b>Start Intake</b> below, complete the form, and tap <b>Save</b>. After submitting
                you’ll see a confirmation number.
              </div>
            </div>
          </li>

          <li style={step}>
            <div style={bullet}>6</div>
            <div>
              <div style={stepTitle}>Tag your deer</div>
              <div style={stepText}>
                On the paper tag write your <b>Full Name</b>, <b>Phone Number</b>, and your <b>DNR Confirmation #</b>.
                Attach the tag to your deer.
              </div>
            </div>
          </li>

          <li style={step}>
            <div style={bullet}>7</div>
            <div>
              <div style={stepTitle}>Place deer in the cooler</div>
              <div style={stepText}>
                Take it to the <b>furthest point</b> in the cooler and close the door firmly.
              </div>
            </div>
          </li>

          <li style={step}>
            <div style={bullet}>8</div>
            <div>
              <div style={stepTitle}>Watch your email</div>
              <div style={stepText}>
                We’ll email when staff have <b>attached the official tag</b>, and again when your order is
                <b> ready for pickup</b>.
              </div>
            </div>
          </li>
        </ol>

        {/* Required acknowledgement */}
        <label style={ackRow}>
          <input
            type="checkbox"
            checked={ack}
            onChange={(e) => setAck(e.target.checked)}
            style={{ width: 18, height: 18 }}
          />
          <span>
            I understand I must have a <b>DNR Confirmation #</b>, tag my deer with my
            <b> Full Name</b>, <b>Phone</b>, and <b>Confirmation #</b>, and place it in the cooler.
          </span>
        </label>

        {/* Actions */}
        <div style={actions}>
          <button
            type="button"
            onClick={goStart}
            disabled={!canStart}
            style={{ ...primaryBtn, ...(canStart ? {} : disabledBtn) }}
            aria-disabled={!canStart}
          >
            Start Intake
          </button>
          <Link href="/faq-public" style={ghostBtn}>Read FAQ</Link>
        </div>

        <div style={help}>
          No Service? Fill out the tag in its entirety and leave it with the deer. We’ll call you with any questions.
        </div>
      </section>
    </main>
  );
}

/* ——— styles ——— */

const colors = {
  bg: '#0b0f0d',
  panel: 'rgba(18,24,22,.95)',
  panelBorder: 'rgba(255,255,255,.08)',
  brand: '#89c096',
  text: '#e6ebe8',
  sub: 'rgba(230,235,232,.8)',
  tileBg: 'rgba(18,24,22,.95)',
  accent: '#d4e7db',
} as const;

const shell: React.CSSProperties = {
  maxWidth: 980,
  margin: '0 auto',
  padding: '0 16px 40px',
  color: colors.text,
};

const header: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '16px 0',
};
const logoWrap: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10 };
const logoFallback: React.CSSProperties = { width: 36, height: 36, borderRadius: 8, background: colors.brand, display: 'inline-block' };
const brand: React.CSSProperties = { fontWeight: 900, letterSpacing: '.02em', fontSize: 16, textTransform: 'uppercase', color: colors.accent };

const nav: React.CSSProperties = { display: 'flex', gap: 10, alignItems: 'center' };
const navLink: React.CSSProperties = {
  display: 'inline-block',
  padding: '8px 12px',
  borderRadius: 10,
  textDecoration: 'none',
  color: colors.text,
  border: `1px solid ${colors.panelBorder}`,
  fontWeight: 800,
  fontSize: 13,
};

const card: React.CSSProperties = {
  background: colors.panel,
  border: `1px solid ${colors.panelBorder}`,
  borderRadius: 14,
  padding: 16,
  marginTop: 8,
};

const eyebrow: React.CSSProperties = { color: colors.brand, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', fontSize: 12 };
const title: React.CSSProperties = { margin: '6px 0 10px', fontSize: 28, lineHeight: 1.2, fontWeight: 900 };
const sub: React.CSSProperties = { margin: '0 0 12px', color: colors.sub };

const steps: React.CSSProperties = { listStyle: 'none', padding: 0, margin: '8px 0 12px', display: 'grid', gap: 10 };
const step: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: '32px 1fr', gap: 10, alignItems: 'center',
  border: `1px solid ${colors.panelBorder}`, background: 'rgba(18,24,22,.92)', borderRadius: 12, padding: '10px 12px',
};
const bullet: React.CSSProperties = {
  width: 28, height: 28, borderRadius: 999, display: 'grid', placeItems: 'center',
  background: colors.brand, color: '#0b0f0d', fontWeight: 900,
};
const stepTitle: React.CSSProperties = { fontWeight: 900, color: colors.accent };
const stepText: React.CSSProperties = { opacity: 0.9 };

const ackRow: React.CSSProperties = { display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 6, userSelect: 'none' };

const actions: React.CSSProperties = { display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' };
const primaryBtn: React.CSSProperties = {
  display: 'inline-block', padding: '10px 14px', borderRadius: 12, textDecoration: 'none',
  color: '#0b0f0d', background: colors.brand, border: '1px solid transparent', fontWeight: 900, fontSize: 16, cursor: 'pointer',
};
const ghostBtn: React.CSSProperties = {
  display: 'inline-block', padding: '10px 14px', borderRadius: 12, textDecoration: 'none',
  color: colors.text, background: colors.tileBg, border: `1px solid ${colors.panelBorder}`, fontWeight: 900, fontSize: 16,
};
const disabledBtn: React.CSSProperties = { opacity: 0.5, cursor: 'not-allowed' };

const help: React.CSSProperties = { marginTop: 10, fontSize: 13, color: colors.sub };
