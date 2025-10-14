// app/drop-instructions/page.tsx
import 'server-only';
import Link from 'next/link';
import Image from 'next/image';
import CustomerHeader from '../components/CustomerHeader';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata = {
  title: 'Overnight Drop-Off Instructions | McAfee Custom Deer Processing',
  description:
    'Step-by-step guide for using the 24/7 overnight drop at McAfee Custom Deer Processing.',
};

const GO_OUTDOORS_URL = 'https://www.gooutdoorsin.com/login';
// Put your Webbs price sheet in /public as /webbs-price-list.pdf
const WEBBS_PRICE_SHEET_URL = '/webbs-price-list.pdf';
// Property photo placed in /public (optional). Replace path/name if needed.
const PROPERTY_IMAGE = '/property-overview.jpg';
// Where your overnight intake form lives:
const OVERNIGHT_INTAKE_PATH = '/intake/overnight';

// Optional contact details for quick actions (click-to-call/maps).
const BUSINESS = {
  name: 'McAfee Custom Deer Processing',
  address: '10977 Buffalo Trace Rd NW, Palmyra, IN 47164', // update if needed
  phoneDisplay: '(502) 643-3916',               // update if needed
  phoneE164: '+15026433916',                    // update if needed
  mapsUrl: 'https://www.google.com/maps/place/McAfee+Custom+Deer+Processing/@38.3589993,-86.1374638,17z/data=!3m1!4b1!4m6!3m5!1s0x88694f6a5bbc0d69:0x55f1bf1b2c069cd4!8m2!3d38.3589951!4d-86.1348889!16s%2Fg%2F11fn4yq71c?entry=ttu&g_ep=EgoyMDI1MTAwOC4wIKXMDSoASAFQAw%3D%3D',
};

export default function DropInstructionsPage() {
  return (
    <main style={{ background: '#0b0f12', minHeight: '100vh', color: '#e5e7eb' }}>
      <CustomerHeader />

      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '20px 14px 40px' }}>
        {/* Hero / Intro */}
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

          {/* Quick Actions */}
          <div
            style={{
              marginTop: 14,
              display: 'flex',
              gap: 10,
              flexWrap: 'wrap',
            }}
          >
            <Link
              href={OVERNIGHT_INTAKE_PATH}
              style={{
                background: '#10b981',
                color: '#06291f',
                fontWeight: 800,
                padding: '10px 14px',
                borderRadius: 10,
                border: '1px solid #064e3b',
                textDecoration: 'none',
              }}
            >
              Start Overnight Intake Form
            </Link>

            <a
              href={GO_OUTDOORS_URL}
              target="_blank"
              rel="noreferrer"
              style={{
                background: '#e5e7eb',
                color: '#0b0f12',
                fontWeight: 800,
                padding: '10px 14px',
                borderRadius: 10,
                border: '1px solid #9ca3af',
                textDecoration: 'none',
              }}
            >
              Check-In at GoOutdoorsIN
            </a>

            <a
              href={WEBBS_PRICE_SHEET_URL}
              target="_blank"
              rel="noreferrer"
              style={{
                background: '#fef3c7',
                color: '#7c2d12',
                fontWeight: 800,
                padding: '10px 14px',
                border: '1px solid #f59e0b',
                borderRadius: 10,
                textDecoration: 'none',
              }}
            >
              Webbs Price Sheet (PDF)
            </a>
          </div>
        </section>

        {/* Property / Visual (optional) */}
        <section
          style={{
            display: 'grid',
            gridTemplateColumns: '1.2fr 1fr',
            gap: 16,
            alignItems: 'stretch',
          }}
        >
          <div
            style={{
              border: '1px solid #1f2937',
              borderRadius: 14,
              overflow: 'hidden',
              background: '#0b0f12',
            }}
          >
            <div style={{ position: 'relative', width: '100%', height: 300 }}>
              {/* If you don’t have this image in /public, delete this block */}
              <Image
                src={PROPERTY_IMAGE}
                alt="Property overview"
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                style={{ objectFit: 'cover' }}
                priority
              />
            </div>
            <div style={{ padding: '10px 12px', borderTop: '1px solid #1f2937' }}>
              <div style={{ fontSize: 12, color: '#93c5fd' }}>
                Tip: The cooler door is labeled <b>“24/7 Drop”</b> at the rear of the barn.
              </div>
            </div>
          </div>

          {/* Contact / Location card */}
          <div
            style={{
              border: '1px solid #1f2937',
              borderRadius: 14,
              padding: 14,
              background: '#0b0f12',
            }}
          >
            <h2 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 900, color: '#f3f4f6' }}>
              Location & Contact
            </h2>
            <div style={{ display: 'grid', gap: 10 }}>
              <div>
                <div style={{ fontSize: 12, color: '#9ca3af' }}>Address</div>
                <a
                  href={BUSINESS.mapsUrl}
                  target="_blank"
                  rel="noreferrer"
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

            <div style={{ marginTop: 12, borderTop: '1px dashed #334155', paddingTop: 12 }}>
              <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 6 }}>
                Storage Policy
              </div>
              <div
                style={{
                  background: '#111827',
                  border: '1px solid #374151',
                  borderRadius: 10,
                  padding: '8px 10px',
                  color: '#e5e7eb',
                }}
              >
                Deer are stored in our locked cooler. We’ll email you once it’s officially tagged,
                and again when it’s ready for pickup.
              </div>
            </div>
          </div>
        </section>

        {/* Steps */}
        <section
          style={{
            marginTop: 18,
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
            <li
              style={{
                background: '#0b1220',
                border: '1px solid #1f2937',
                borderRadius: 12,
                padding: '10px 12px',
              }}
            >
              <b>1) Stop at the first door</b> and grab:
              <ul style={{ margin: '6px 0 0 18px' }}>
                <li>a <b>Deer Tag</b></li>
                <li>a <b>Webbs form</b> (only if you want Webbs specialty products)</li>
              </ul>
            </li>

            <li
              style={{
                background: '#0b1220',
                border: '1px solid #1f2937',
                borderRadius: 12,
                padding: '10px 12px',
              }}
            >
              <b>2) Go to the rear of the barn.</b> You’ll see a cooler door marked <b>“24/7 Drop”</b>.
            </li>

            <li
              style={{
                background: '#0b1220',
                border: '1px solid #1f2937',
                borderRadius: 12,
                padding: '10px 12px',
              }}
            >
              <b>3) Fill out the Overnight Intake Form.</b>{' '}
              <Link href={OVERNIGHT_INTAKE_PATH} style={{ color: '#93c5fd', textDecoration: 'underline' }}>
                Open the intake form
              </Link>
              . You <u>must</u> have a{' '}
              <a href={GO_OUTDOORS_URL} target="_blank" rel="noreferrer" style={{ color: '#93c5fd' }}>
                GoOutdoorsIN confirmation number
              </a>
              {' '}from your check-in or we will not process your deer.
            </li>

            <li
              style={{
                background: '#0b1220',
                border: '1px solid #1f2937',
                borderRadius: 12,
                padding: '10px 12px',
              }}
            >
              <b>4) Webbs (optional):</b> If you want Webbs products, fill out the Webbs form and include:
              <ul style={{ margin: '6px 0 0 18px' }}>
                <li>the <b>form number</b> and</li>
                <li>the <b>number of pounds</b> to send to Webbs</li>
              </ul>
              <div style={{ marginTop: 6 }}>
                <a
                  href={WEBBS_PRICE_SHEET_URL}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: '#fcd34d', textDecoration: 'underline' }}
                >
                  View Webbs price sheet (PDF)
                </a>
              </div>
              <div style={{ marginTop: 6, fontSize: 13, color: '#cbd5e1' }}>
                Take the <b>back copy</b> of the Webbs form with you, and leave the other two in the mailbox inside the cooler.
              </div>
            </li>

            <li
              style={{
                background: '#0b1220',
                border: '1px solid #1f2937',
                borderRadius: 12,
                padding: '10px 12px',
              }}
            >
              <b>5) Save the intake form.</b> After you tap “Save,” we’ll record your drop-off.
            </li>

            <li
              style={{
                background: '#0b1220',
                border: '1px solid #1f2937',
                borderRadius: 12,
                padding: '10px 12px',
              }}
            >
              <b>6) Tag your deer:</b> on the Deer Tag, write your <b>Full Name</b>, <b>Phone Number</b>, and{' '}
              <b>GoOutdoorsIN Confirmation Number</b>. Attach the tag securely to the deer.
            </li>

            <li
              style={{
                background: '#0b1220',
                border: '1px solid #1f2937',
                borderRadius: 12,
                padding: '10px 12px',
              }}
            >
              <b>7) Place your deer at the furthest point in the cooler.</b>
            </li>

            <li
              style={{
                background: '#0b1220',
                border: '1px solid #1f2937',
                borderRadius: 12,
                padding: '10px 12px',
              }}
            >
              <b>8) Watch your email.</b> We’ll email once it’s officially tagged, and again when it’s ready for pickup.
            </li>
          </ol>

          {/* Bottom CTAs */}
          <div
            style={{
              marginTop: 14,
              display: 'flex',
              gap: 10,
              flexWrap: 'wrap',
              alignItems: 'center',
            }}
          >
            <Link
              href={OVERNIGHT_INTAKE_PATH}
              style={{
                background: '#10b981',
                color: '#06291f',
                fontWeight: 900,
                padding: '10px 14px',
                border: '1px solid #064e3b',
                borderRadius: 10,
                textDecoration: 'none',
              }}
            >
              Start Overnight Intake Form
            </Link>
            <a
              href={GO_OUTDOORS_URL}
              target="_blank"
              rel="noreferrer"
              style={{
                background: '#e5e7eb',
                color: '#0b0f12',
                fontWeight: 800,
                padding: '10px 14px',
                border: '1px solid #9ca3af',
                borderRadius: 10,
                textDecoration: 'none',
              }}
            >
              GoOutdoorsIN Check-In
            </a>
            <a
              href={BUSINESS.mapsUrl}
              target="_blank"
              rel="noreferrer"
              style={{
                background: '#111827',
                color: '#93c5fd',
                fontWeight: 800,
                padding: '10px 14px',
                border: '1px solid #1f2937',
                borderRadius: 10,
                textDecoration: 'none',
              }}
            >
              Open in Google Maps
            </a>
            <a
              href={`tel:${BUSINESS.phoneE164 || (BUSINESS.phoneDisplay || '').replace(/\D+/g, '')}`}
              style={{
                background: '#111827',
                color: '#cbd5e1',
                fontWeight: 800,
                padding: '10px 14px',
                border: '1px solid #1f2937',
                borderRadius: 10,
                textDecoration: 'none',
              }}
            >
              Call {BUSINESS.phoneDisplay}
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}

