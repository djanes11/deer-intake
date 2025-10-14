// components/PickupPanel.tsx
'use client';

import React from 'react';

type Props = {
  ready: boolean;
  addressText: string;       // "123 Farm Rd, Louisville, KY 402xx"
  lat?: number;              // optional
  lng?: number;              // optional
  phoneE164: string;         // "+15026433916"
  displayPhone?: string;     // "(502) 643-3916"
  hours?: { days: string; open: string; close: string }[];
  tag?: string;
  showPay?: boolean;
};

export default function PickupPanel({
  ready,
  addressText,
  lat,
  lng,
  phoneE164,
  displayPhone,
  hours = [],
  tag,
  showPay,
}: Props) {
  const gmaps =
    lat != null && lng != null
      ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
      : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addressText)}`;

  return (
    <section
      style={{
        marginTop: 10,
        border: '1px solid rgba(255,255,255,.08)',
        background: 'rgba(18,24,22,.95)',
        borderRadius: 12,
        padding: 12,
        color: '#e6ebe8',
      }}
    >
      {ready && (
        <div
          style={{
            background: '#193b2e',
            border: '1px solid #2a5f47',
            color: '#a7e3ba',
            borderRadius: 10,
            padding: '8px 10px',
            fontWeight: 800,
            marginBottom: 8,
          }}
        >
          Ready for pickup
        </div>
      )}

      <div style={{ display: 'grid', gap: 8, gridTemplateColumns: '1fr' }}>
        <div>
          <div style={{ fontWeight: 900, color: '#d4e7db', marginBottom: 2 }}>Pickup Location</div>
          <div style={{ opacity: 0.9 }}>{addressText}</div>
        </div>

        {hours.length > 0 && (
          <div>
            <div style={{ fontWeight: 900, color: '#d4e7db', marginBottom: 2 }}>Hours</div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, opacity: 0.9 }}>
              {hours.map((h, i) => (
                <li key={i}>{h.days}: {h.open} – {h.close}</li>
              ))}
            </ul>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <a
            href={gmaps}
            target="_blank"
            rel="noopener noreferrer"
            style={btn}
          >
            Open in Google Maps
          </a>
          <a href={`tel:${phoneE164}`} style={btnGhost}>
            Call {displayPhone || phoneE164}
          </a>
          {showPay && tag && (
            <a href={`/api/pay/create?tag=${encodeURIComponent(tag)}`} style={btnPrimary}>
              Pay now with Square
            </a>
          )}
        </div>

        <div style={{ fontSize: 12, color: 'rgba(230,235,232,.75)' }}>
          Need after-hours pickup? Call and we’ll work with you.
        </div>
      </div>
    </section>
  );
}

const btn: React.CSSProperties = {
  display: 'inline-block',
  padding: '10px 12px',
  borderRadius: 10,
  textDecoration: 'none',
  color: '#e6ebe8',
  border: '1px solid rgba(255,255,255,.15)',
  fontWeight: 800,
  fontSize: 14,
};

const btnGhost = btn;

const btnPrimary: React.CSSProperties = {
  ...btn,
  background: '#89c096',
  border: '1px solid transparent',
  color: '#0b0f0d',
};
