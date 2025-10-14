// app/faq-public/page.tsx
'use client';

import Link from 'next/link';
import { SITE, phoneHref } from '@/lib/config';

const CONTACT_EMAIL = (process.env.NEXT_PUBLIC_EMAIL || '').toString().trim();

export default function FaqPublicPage() {
  return (
    <main style={{ maxWidth: 820, margin: '24px auto', padding: '0 12px' }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 12 }}>Customer FAQ</h1>

      <section style={card}>
        <h2 style={h2}>How do I check my order status?</h2>
        <p>
          Go to{' '}
          <Link href="/status" style={a}>
            the Status page
          </Link>{' '}
          and search by <b>Confirmation #</b> (best) or <b>Tag + Last Name</b>.
        </p>
      </section>

      <section style={card}>
        <h2 style={h2}>Overnight drop-off instructions</h2>
        <ol style={{ paddingLeft: 18, margin: '8px 0' }}>
          <li>Stop at the first door and grab a deer tag and a Webbs form if you want specialty products.</li>
          <li>
            Go to the rear of the barn and use the cooler door marked <b>24/7 Drop</b>.
          </li>
          <li>
            Fill out the{' '}
            <Link href="/drop-instructions" style={a}>
              drop-off intake form
            </Link>
            . You <b>must</b> have a Confirmation # from{' '}
            <a href="https://www.gooutdoorsin.com/login" target="_blank" rel="noreferrer" style={a}>
              GoOutdoorsIN
            </a>
            .
          </li>
          <li>
            Doing Webbs? Review the{' '}
            <a
              href="/files/webbs-price.pdf"
              target="_blank"
              rel="noreferrer"
              style={a}
            >
              price sheet
            </a>
            , write your Webbs form # and pounds on the form. Keep the back copy and leave the other two in the mailbox inside
            the cooler.
          </li>
          <li>Save the intake form, then write your Full Name, Phone, and Confirmation # on the tag and attach it to the deer.</li>
          <li>Place the deer at the furthest point in the cooler.</li>
          <li>Watch your email—we’ll email when it’s officially tagged and again when it’s ready.</li>
        </ol>
      </section>

      <section style={card}>
        <h2 style={h2}>Pickup</h2>
        <p>We’ll notify you when it’s ready. After-hours pickup? Call—we’ll work with you.</p>
        <div style={{ marginTop: 8 }}>
          <div style={{ fontWeight: 900, marginBottom: 4 }}>Contact</div>
          <div><b>Address:</b> <a href={SITE.mapsUrl} target="_blank" rel="noreferrer" style={a}>{SITE.address}</a></div>
          <div><b>Phone:</b> <a href={phoneHref} style={a}>{SITE.phone}</a></div>
          {CONTACT_EMAIL ? (
            <div><b>Email:</b> <a href={`mailto:${CONTACT_EMAIL}`} style={a}>{CONTACT_EMAIL}</a></div>
          ) : null}
        </div>
      </section>

      <section style={card}>
        <h2 style={h2}>What should I bring with my deer?</h2>
        <ul style={{ paddingLeft: 18, margin: '8px 0' }}>
          <li>Your GoOutdoorsIN Confirmation #.</li>
          <li>Any specialty instructions (Webbs pounds, jerky/summer sausage preferences).</li>
          <li>Valid contact info (phone + email) so we can reach you fast.</li>
        </ul>
      </section>
    </main>
  );
}

/* ---------- styles ---------- */
const card: React.CSSProperties = {
  padding: 16,
  border: '1px solid #1f2937',
  borderRadius: 12,
  background: '#0b0f12',
  color: '#e5e7eb',
  marginBottom: 14,
};
const h2: React.CSSProperties = { fontSize: 18, fontWeight: 800, margin: '0 0 8px' };
const a: React.CSSProperties = { color: '#a7e3ba', textDecoration: 'underline' };
