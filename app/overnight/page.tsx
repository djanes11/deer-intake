'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { SITE } from '@/lib/config';

const GO_OUTDOORS_URL = 'https://www.gooutdoorsin.com/login';
const WEBBS_PRICE_SHEET_URL = '/webbs-price.pdf';
const OVERNIGHT_INTAKE_PATH = '/intake/overnight';

type PublicBrandingState = {
  name: string;
  address: string;
  phoneDisplay: string;
  phoneE164: string;
  mapsUrl: string;
  webbsEnabled: boolean;
};

const DEFAULT_BRANDING: PublicBrandingState = {
  name: SITE.name,
  address: SITE.address,
  phoneDisplay: SITE.phone,
  phoneE164: SITE.phoneE164,
  mapsUrl: SITE.mapsUrl,
  webbsEnabled: true,
};

export default function OvernightInstructionsPage() {
  const [intakeEnabled, setIntakeEnabled] = useState(true);
  const [bannerMessage, setBannerMessage] = useState('');
  const [branding, setBranding] = useState(DEFAULT_BRANDING);
  const [agree, setAgree] = useState(false);
  const [canAgree, setCanAgree] = useState(false);
  const [showSticky, setShowSticky] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const scrolledRef = useRef(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767.98px)');
    const set = () => setIsMobile(mq.matches);
    set();
    mq.addEventListener?.('change', set);
    return () => mq.removeEventListener?.('change', set);
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('overnight_agree_v1');
      if (saved === '1') setAgree(true);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('overnight_agree_v1', agree ? '1' : '0');
    } catch {}
  }, [agree]);

  useEffect(() => {
    fetch('/api/public/site-settings', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        if (!j?.ok || !j?.settings) return;
        setIntakeEnabled(j.settings.public_intake_enabled !== false);
        setBannerMessage(String(j.settings.banner_enabled ? j.settings.banner_message || '' : ''));
        setBranding({
          name: String(j.settings?.branding?.name || DEFAULT_BRANDING.name),
          address: String(j.settings?.branding?.address || DEFAULT_BRANDING.address),
          phoneDisplay: String(j.settings?.branding?.phoneDisplay || DEFAULT_BRANDING.phoneDisplay),
          phoneE164: String(j.settings?.branding?.phoneE164 || DEFAULT_BRANDING.phoneE164),
          mapsUrl: String(j.settings?.branding?.mapsUrl || DEFAULT_BRANDING.mapsUrl),
          webbsEnabled: j.settings?.features?.webbsEnabled !== false,
        });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const onScroll = () => {
      const doc = document.documentElement;
      const atBottom = window.innerHeight + window.scrollY >= doc.scrollHeight - 24;
      const nearBottom = window.innerHeight + window.scrollY >= doc.scrollHeight * 0.8;
      if (isMobile && nearBottom) setShowSticky(true);
      if (atBottom && !scrolledRef.current) {
        scrolledRef.current = true;
        setCanAgree(true);
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, [isMobile]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        const active = document.activeElement as HTMLElement | null;
        const isStartBtn = active?.id === 'overnight-start';
        if (!isStartBtn) e.preventDefault();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const stepBox: React.CSSProperties = {
    border: '1px solid #dbe4ee',
    background: '#ffffff',
    borderRadius: 12,
    padding: '14px 14px',
    color: '#0f172a',
  };

  const startEnabled = intakeEnabled && canAgree && agree;

  const WarningCallout = useMemo(
    () => (
      <div
        role="note"
        aria-label="Important requirement"
        style={{
          display: 'grid',
          gridTemplateColumns: '24px 1fr',
          gap: 10,
          border: '1px solid #a16207',
          background: '#1f1a09',
          color: '#fde68a',
          borderRadius: 12,
          padding: '10px 12px',
          marginTop: 8,
        }}
      >
        <span aria-hidden="true" style={{ fontSize: 18, lineHeight: '24px' }}>
          !
        </span>
        <div>
          We <b>cannot process your deer</b> without a valid{' '}
          <a href={GO_OUTDOORS_URL} target="_blank" rel="noopener noreferrer" style={{ color: '#facc15', textDecoration: 'none', fontWeight: 800 }}>
            GoOutdoorsIN confirmation #
          </a>{' '}
          from your check-in.
        </div>
      </div>
    ),
    []
  );

  function handleStart() {
    if (!startEnabled) return;
    window.location.href = OVERNIGHT_INTAKE_PATH;
  }

  return (
    <main className="app-frame" style={{ maxWidth: 1080, paddingBottom: 96 }}>
        <section className="app-hero" style={{ marginBottom: 2 }}>
          <h1
            style={{
              fontSize: 32,
              fontWeight: 900,
              letterSpacing: 0.2,
              margin: '0 0 8px',
              color: '#fff7e8',
            }}
          >
            Public Intake - How It Works
          </h1>
          <p style={{ margin: 0, color: 'rgba(245,236,216,.84)', lineHeight: 1.6 }}>
            Quick, secure, and available anytime. Use this form for public deer intake, including after-hours drop-off.
          </p>
        </section>

        <section
          className="app-surface-light"
          style={{
            padding: 14,
            marginBottom: 14,
          }}
        >
          <h2 style={{ margin: '0 0 10px', fontSize: 18, fontWeight: 900, color: '#0f172a' }}>What you'll need</h2>
          <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>
            <li>Your <b>GoOutdoorsIN confirmation #</b> from State check-in</li>
            <li>Your phone and contact info</li>
            <li>
              A <b>Blank Deer Tag</b>
              {branding.webbsEnabled ? <> and optionally a <b>Webbs form</b> if you want Webbs products</> : null}
            </li>
          </ul>
          {WarningCallout}
        </section>

        <section
          className="app-surface-light"
          style={{
            padding: 14,
          }}
        >
          {!intakeEnabled ? (
            <div
              style={{
                marginBottom: 14,
                border: '1px solid #8a2b2b',
                background: '#2a0e0e',
                color: '#ffd6d6',
                borderRadius: 12,
                padding: '12px 14px',
                lineHeight: 1.5,
              }}
            >
              <b>Public intake is currently unavailable.</b>
              <div style={{ marginTop: 4 }}>
                {bannerMessage || 'Please call the shop or check back later for updated availability.'}
              </div>
            </div>
          ) : null}

          <h2 style={{ margin: '0 0 10px', fontSize: 20, fontWeight: 900, color: '#0f172a' }}>
            Step-by-step instructions
          </h2>

          <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 16 }}>
            <li style={stepBox}>
              <b>1) Stop at the first door</b> and grab:
              <ul style={{ margin: '6px 0 0 18px' }}>
                <li>a <b>Blank Deer Tag</b></li>
                {branding.webbsEnabled ? <li>a <b>Webbs form</b> if you want Webbs products</li> : null}
              </ul>
            </li>

            <li style={stepBox}>
              <b>2) Go to the rear of the barn.</b> You'll see a cooler door marked <b>24/7 Drop</b>.
            </li>

            <li style={stepBox}>
              <b>3) Fill out the Public Intake Form.</b> You <u>must</u> have a{' '}
              <a href={GO_OUTDOORS_URL} target="_blank" rel="noopener noreferrer" style={{ color: '#2f6f3f', textDecoration: 'none', fontWeight: 800 }}>
                GoOutdoorsIN confirmation number
              </a>{' '}
              from your check-in.
              <div style={{ marginTop: 8, color: '#d1fae5' }}>
                You do <b>not</b> need a processor deer tag number yet. Staff will assign that after your deer is checked in the next day.
              </div>
              {WarningCallout}
            </li>

            {branding.webbsEnabled ? (
            <li style={stepBox}>
              <b>4) Webbs (optional):</b> If you want Webbs products, fill out the Webbs form and include your product choices and pounds going into each product.
              <div style={{ marginTop: 6 }}>
                <a
                  href={WEBBS_PRICE_SHEET_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#2f6f3f', textDecoration: 'none', fontWeight: 800 }}
                >
                  View Webbs price sheet (PDF)
                </a>
              </div>
            </li>
            ) : null}

            <li style={stepBox}>
              <b>{branding.webbsEnabled ? '5' : '4'}) Save the intake form.</b> After you tap <b>Save</b>, we'll record your drop-off.
              <div style={{ marginTop: 8, color: '#d1fae5' }}>
                Save or screenshot your confirmation number. That is the fastest way to check your deer status later.
              </div>
            </li>

            <li style={stepBox}>
              <b>{branding.webbsEnabled ? '6' : '5'}) Tag your deer.</b> On the Blank Deer Tag, write your <b>Full Name</b>, <b>Phone Number</b>, and <b>GoOutdoorsIN State Confirmation Number</b>. Attach the tag securely to the deer.
            </li>

            <li style={stepBox}>
              <b>{branding.webbsEnabled ? '7' : '6'}) Place your deer at the furthest point in the cooler.</b>
            </li>

            <li style={stepBox}>
              <b>{branding.webbsEnabled ? '8' : '7'}) Watch for updates.</b> We’ll use the contact method you selected on your intake form once your deer is officially tagged and again when it is ready for pickup.
            </li>
          </ol>

          {!isMobile && (
            <div
              style={{
                marginTop: 16,
                paddingTop: 12,
                borderTop: '1px dashed #334155',
                display: 'grid',
                gap: 12,
              }}
            >
              <label style={{ display: 'flex', alignItems: 'start', gap: 10, lineHeight: 1.5, fontSize: 16 }}>
                <input
                  type="checkbox"
                  checked={agree}
                  onChange={(e) => setAgree(e.target.checked)}
                  disabled={!canAgree}
                  style={{ marginTop: 4, width: 22, height: 22 }}
                  aria-describedby="agree-help"
                />
                <span id="agree-help">
                  I agree to follow these public intake rules and understand a valid <b>GoOutdoorsIN confirmation number</b> is required.
                  {!canAgree ? (
                    <em style={{ display: 'block', color: '#9ca3af', fontSize: 12 }}>
                      Scroll to the bottom to enable the checkbox.
                    </em>
                  ) : null}
                </span>
              </label>

              <button
                id="overnight-start"
                disabled={!startEnabled}
                onClick={handleStart}
                style={{
                  display: 'inline-block',
                  padding: '14px 16px',
                  borderRadius: 12,
                  fontWeight: 900,
                  fontSize: 16,
                  border: `1px solid ${startEnabled ? '#064e3b' : '#374151'}`,
                  background: startEnabled ? '#10b981' : '#111827',
                  color: startEnabled ? '#06291f' : '#9ca3af',
                  cursor: startEnabled ? 'pointer' : 'not-allowed',
                  minWidth: 220,
                }}
                aria-disabled={!startEnabled}
                aria-controls="overnight-start"
              >
                Start Public Intake
              </button>
            </div>
          )}
        </section>

        <section
          className="app-surface-light"
          style={{
            marginTop: 16,
            padding: 14,
            display: 'grid',
            gap: 10,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: '#0f172a' }}>
            Location & Contact
          </h2>
          <div style={{ display: 'grid', gap: 10 }}>
            <div>
              <div style={{ fontSize: 12, color: '#9ca3af' }}>Address</div>
              <a
                href={branding.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-block',
                  marginTop: 4,
                  background: '#111827',
                  color: '#e5e7eb',
                  border: '1px solid #374151',
                  borderRadius: 12,
                  padding: '10px 12px',
                  textDecoration: 'none',
                }}
              >
                {branding.address}
              </a>
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#9ca3af' }}>Phone</div>
              <a
                href={`tel:${branding.phoneE164 || (branding.phoneDisplay || '').replace(/\D+/g, '')}`}
                style={{
                  display: 'inline-block',
                  marginTop: 4,
                  background: '#111827',
                  color: '#e5e7eb',
                  border: '1px solid #374151',
                  borderRadius: 12,
                  padding: '10px 12px',
                  textDecoration: 'none',
                }}
              >
                {branding.phoneDisplay}
              </a>
            </div>
          </div>
        </section>

      {isMobile && (
        <div
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 0,
            transform: showSticky ? 'translateY(0)' : 'translateY(100%)',
            transition: 'transform .25s ease',
            background: '#0b0f12',
            borderTop: '1px solid #1f2937',
            padding: '10px 14px',
            display: 'grid',
            gridTemplateColumns: '1fr auto',
            gap: 12,
            alignItems: 'center',
          }}
          aria-hidden={!showSticky}
        >
          <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              type="checkbox"
              checked={agree}
              onChange={(e) => setAgree(e.target.checked)}
              disabled={!canAgree}
              style={{ width: 20, height: 20 }}
              aria-label="I agree to the public intake rules"
            />
            <span style={{ fontSize: 14 }}>I agree to the public intake rules</span>
          </label>
          <button
            onClick={handleStart}
            disabled={!startEnabled}
            style={{
              padding: '12px 14px',
              borderRadius: 12,
              fontWeight: 900,
              border: `1px solid ${startEnabled ? '#064e3b' : '#374151'}`,
              background: startEnabled ? '#10b981' : '#111827',
              color: startEnabled ? '#06291f' : '#9ca3af',
              cursor: startEnabled ? 'pointer' : 'not-allowed',
              minWidth: 160,
            }}
          >
            Start Intake
          </button>
        </div>
      )}
    </main>
  );
}
