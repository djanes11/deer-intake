// app/overnight/page.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

const GO_OUTDOORS_URL = 'https://www.gooutdoorsin.com/login';
const WEBBS_PRICE_SHEET_URL = '/webbs-price.pdf';
const OVERNIGHT_INTAKE_PATH = '/intake/overnight';

const BUSINESS = {
  address: '10977 Buffalo Trace Rd NW, Palmyra, IN 47164',
  phoneDisplay: '(502) 643-3916',
  phoneE164: '+15026433916',
  mapsUrl:
    'https://www.google.com/maps/place/McAfee+Custom+Deer+Processing/@38.3589993,-86.1374638,17z/data=!3m1!4b1!4m6!3m5!1s0x88694f6a5bbc0d69:0x55f1bf1b2c069cd4!8m2!3d38.3589951!4d-86.1348889!16s%2Fg%2F11fn4yq71c?entry=ttu',
};

export default function OvernightInstructionsPage() {
  // Agreement + gating
  const [agree, setAgree] = useState(false);
  const [canAgree, setCanAgree] = useState(false); // becomes true only after user reaches the bottom
  const [showSticky, setShowSticky] = useState(false); // shows near-bottom sticky footer
  const scrolledRef = useRef(false);

  // Restore "agree" from localStorage, but DO NOT skip the scroll gate
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

  // Scroll detection: enable canAgree only after reaching bottom once per visit
  useEffect(() => {
    const onScroll = () => {
      const doc = document.documentElement;
      const atBottom = window.innerHeight + window.scrollY >= doc.scrollHeight - 24; // within 24px of bottom
      const nearBottom = window.innerHeight + window.scrollY >= doc.scrollHeight * 0.8; // 80% for sticky reveal
      if (nearBottom) setShowSticky(true);
      if (atBottom && !scrolledRef.current) {
        scrolledRef.current = true;
        setCanAgree(true);
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    // run once in case content is short on desktop
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Prevent accidental "Enter" triggering navigation
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        const active = document.activeElement as HTMLElement | null;
        // Only allow Enter on the Start button once all gates pass
        const isStartBtn = active?.id === 'overnight-start';
        if (!isStartBtn) e.preventDefault();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const stepBox: React.CSSProperties = {
    border: '1px solid #374151',
    background: '#0b0f12',
    borderRadius: 12,
    padding: '14px 14px',
  };

  const startEnabled = canAgree && agree;

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
        <span aria-hidden="true" style={{ fontSize: 18, lineHeight: '24px' }}>⚠️</span>
        <div>
          We <b>cannot process your deer</b> without a valid{' '}
          <a href={GO_OUTDOORS_URL} target="_blank" rel="noopener noreferrer" style={{ color: '#facc15', textDecoration: 'underline' }}>
            GoOutdoorsIN confirmation #
          </a> from your check‑in.
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
    <main style={{ background: '#0b0f12', minHeight: '100vh', color: '#f2f4f5' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '20px 14px 96px' }}>
        {/* Intro */}
        <section
          style={{
            background: 'linear-gradient(180deg,#111827 0%, #0b0f12 100%)',
            border: '1px solid #1f2937',
            borderRadius: 14,
            padding: '18px 18px 16px',
            marginBottom: 18,
          }}
        >
          <h1
            style={{
              fontSize: 28,
              fontWeight: 900,
              letterSpacing: 0.2,
              margin: '0 0 8px',
              color: '#f9fafb',
            }}
          >
            24/7 Overnight Drop-Off — How It Works
          </h1>
          <p style={{ margin: 0, color: '#d1d5db', lineHeight: 1.6 }}>
            Quick, secure, and available anytime. Follow the steps below and you’ll be done in a few minutes.
          </p>
        </section>

        {/* What you'll need */}
        <section
          style={{
            border: '1px solid #1f2937',
            borderRadius: 14,
            padding: 14,
            background: '#0b0f12',
            marginBottom: 14,
          }}
        >
          <h2 style={{ margin: '0 0 10px', fontSize: 18, fontWeight: 900, color: '#f3f4f6' }}>What you’ll need</h2>
          <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>
            <li>Your <b>GoOutdoorsIN confirmation #</b> from check‑in</li>
            <li>Your phone and contact info</li>
            <li>A <b>Deer Tag</b>, and optionally a <b>Webbs form</b> (for specialty products)</li>
          </ul>
          {WarningCallout}
        </section>

        {/* Steps */}
        <section
          style={{
            border: '1px solid #1f2937',
            borderRadius: 14,
            padding: 14,
            background: '#0b0f12',
          }}
        >
          <h2 style={{ margin: '0 0 10px', fontSize: 20, fontWeight: 900, color: '#f3f4f6' }}>
            Step-by-step instructions
          </h2>

          <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 16 }}>
            <li style={stepBox}>
              <b>1) Stop at the first door</b> and grab:
              <ul style={{ margin: '6px 0 0 18px' }}>
                <li>a <b>Deer Tag</b></li>
                <li>a <b>Webbs form</b> (only if you want Webbs specialty products)</li>
              </ul>
            </li>

            <li style={stepBox}>
              <b>2) Go to the rear of the barn.</b> You’ll see a cooler door marked <b>“24/7 Drop”</b>.
            </li>

            <li style={stepBox}>
              <b>3) Fill out the Overnight Intake Form.</b> You <u>must</u> have a{' '}
              <a href={GO_OUTDOORS_URL} target="_blank" rel="noopener noreferrer" style={{ color: '#93c5fd' }}>
                GoOutdoorsIN confirmation number
              </a>{' '}
              from your check‑in.
              {WarningCallout}
            </li>

            <li style={stepBox}>
              <b>4) Webbs (optional):</b> If you want Webbs products, fill out the Webbs form and include:
              <ul style={{ margin: '6px 0 0 18px' }}>
                <li>the <b>form number</b> and</li>
                <li>the <b>number of pounds</b> to send to Webbs</li>
              </ul>
              <div style={{ marginTop: 6 }}>
                <a
                  href={WEBBS_PRICE_SHEET_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#fcd34d', textDecoration: 'underline' }}
                >
                  View Webbs price sheet (PDF)
                </a>
              </div>
            </li>

            <li style={stepBox}>
              <b>5) Save the intake form.</b> After you tap <b>Save</b>, we’ll record your drop‑off.
            </li>

            <li style={stepBox}>
              <b>6) Tag your deer.</b> On the Deer Tag, write your <b>Full Name</b>, <b>Phone Number</b>, and{' '}
              <b>GoOutdoorsIN Confirmation Number</b>. Attach the tag securely to the deer.
            </li>

            <li style={stepBox}>
              <b>7) Place your deer at the furthest point in the cooler.</b>
            </li>

            <li style={stepBox}>
              <b>8) Watch your email.</b> We’ll email once it’s officially tagged, and again when it’s ready for pickup.
            </li>
          </ol>

          {/* Agreement + Start button */}
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
                I agree to follow these overnight drop rules and understand a valid{' '}
                <b>GoOutdoorsIN confirmation number</b> is required.
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
                border: '1px solid ' + (startEnabled ? '#064e3b' : '#374151'),
                background: startEnabled ? '#10b981' : '#111827',
                color: startEnabled ? '#06291f' : '#9ca3af',
                cursor: startEnabled ? 'pointer' : 'not-allowed',
                minWidth: 220,
              }}
              aria-disabled={!startEnabled}
              aria-controls="overnight-start"
            >
              Start Overnight Intake
            </button>
          </div>
        </section>

        {/* Small contact card */}
        <section
          style={{
            marginTop: 16,
            border: '1px solid #1f2937',
            borderRadius: 14,
            padding: 14,
            background: '#0b0f12',
            display: 'grid',
            gap: 10,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: '#f3f4f6' }}>
            Location & Contact
          </h2>
          <div style={{ display: 'grid', gap: 10 }}>
            <div>
              <div style={{ fontSize: 12, color: '#9ca3af' }}>Address</div>
              <a
                href={BUSINESS.mapsUrl}
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
                {BUSINESS.address}
              </a>
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#9ca3af' }}>Phone</div>
              <a
                href={`tel:${BUSINESS.phoneE164 || (BUSINESS.phoneDisplay || '').replace(/\D+/g, '')}`}
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
                {BUSINESS.phoneDisplay}
              </a>
            </div>
          </div>
        </section>
      </div>

      {/* Sticky footer: appears near-bottom on mobile to cut scroll back */}
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
            aria-label="I agree to the overnight drop rules"
          />
          <span style={{ fontSize: 14 }}>
            I agree to the overnight rules
          </span>
        </label>
        <button
          onClick={handleStart}
          disabled={!startEnabled}
          style={{
            padding: '12px 14px',
            borderRadius: 12,
            fontWeight: 900,
            border: '1px solid ' + (startEnabled ? '#064e3b' : '#374151'),
            background: startEnabled ? '#10b981' : '#111827',
            color: startEnabled ? '#06291f' : '#9ca3af',
            cursor: startEnabled ? 'pointer' : 'not-allowed',
            minWidth: 160,
          }}
        >
          Start Intake
        </button>
      </div>
    </main>
  );
}
