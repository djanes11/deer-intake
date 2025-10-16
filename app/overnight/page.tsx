// app/overnight/page.tsx
'use client';

import { useState } from 'react';

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
  const [agree, setAgree] = useState(false);

  const stepBox: React.CSSProperties = {
    border: '1px solid #374151',
    background: '#0b0f12',
    borderRadius: 10,
    padding: '10px 12px',
  };

  return (
    <main style={{ background: '#0b0f12', minHeight: '100vh', color: '#e5e7eb' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '20px 14px 40px' }}>
        {/* Intro */}
        <section
          style={{
            background: 'linear-gradient(180deg,#111827 0%, #0b0f12 100%)',
            border: '1px solid #1f2937',
            borderRadius: 14,
            padding: '18px 18px 14px',
            marginBottom: 18,
          }}
        >
          <h1
            style={{
              fontSize: 28,
              fontWeight: 900,
              letterSpacing: 0.2,
              margin: '0 0 8px',
              color: '#f3f4f6',
            }}
          >
            24/7 Overnight Drop-Off — How It Works
          </h1>
          <p style={{ margin: 0, color: '#cbd5e1', lineHeight: 1.5 }}>
            Quick, secure, and available anytime. Follow the steps below and you’ll be done in a few minutes.
          </p>
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
            Step-by-Step Instructions
          </h2>

          <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 12 }}>
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
              from your check-in or we will not process your deer.
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
              <b>5) Save the intake form.</b> After you tap “Save,” we’ll record your drop-off.
            </li>

            <li style={stepBox}>
              <b>6) Tag your deer:</b> on the Deer Tag, write your <b>Full Name</b>, <b>Phone Number</b>, and{' '}
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
              gap: 10,
            }}
          >
            <label style={{ display: 'flex', alignItems: 'start', gap: 8, lineHeight: 1.35 }}>
              <input
                type="checkbox"
                checked={agree}
                onChange={(e) => setAgree(e.target.checked)}
                style={{ marginTop: 3 }}
              />
              <span>
                I agree to follow these overnight drop rules and understand a valid <b>GoOutdoorsIN confirmation number</b> is required.
              </span>
            </label>

            <button
              disabled={!agree}
              onClick={() => {
                if (agree) window.location.href = OVERNIGHT_INTAKE_PATH;
              }}
              style={{
                display: 'inline-block',
                padding: '10px 14px',
                borderRadius: 10,
                fontWeight: 900,
                border: '1px solid ' + (agree ? '#064e3b' : '#374151'),
                background: agree ? '#10b981' : '#111827',
                color: agree ? '#06291f' : '#9ca3af',
                cursor: agree ? 'pointer' : 'not-allowed',
              }}
              aria-disabled={!agree}
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
                  borderRadius: 10,
                  padding: '8px 10px',
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
                  borderRadius: 10,
                  padding: '8px 10px',
                  textDecoration: 'none',
                }}
              >
                {BUSINESS.phoneDisplay}
              </a>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
