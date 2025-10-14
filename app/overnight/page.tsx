// app/overnight/page.tsx
import Link from 'next/link';
import CustomerHeader from '../components/CustomerHeader';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function OvernightInfoPage() {
  return (
    <>
      <CustomerHeader />

      <main style={{ maxWidth: 960, margin: '20px auto', padding: '0 14px 40px' }}>
        <h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 8 }}>
          24/7 Overnight Drop-Off — How It Works
        </h1>
        <p style={{ opacity: 0.9, marginBottom: 16 }}>
          Quick, secure, and available anytime. Follow the steps below and you’ll be done in a few minutes.
        </p>

        <div
          style={{
            border: '1px solid #1f2937',
            background: '#0b0f12',
            color: '#e6e7eb',
            borderRadius: 12,
            padding: 16,
            display: 'grid',
            gap: 14,
          }}
        >
          <ol style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 10 }}>
            <li>
              <b>Stop at the first door</b> and grab:
              <ul style={{ marginTop: 6 }}>
                <li>a <b>McAfee deer tag</b></li>
                <li>and a <b>Webbs smoked meats form</b> (if you want Webbs products)</li>
              </ul>
            </li>

            <li>
              <b>Go around to the rear of the barn</b> to the cooler door marked <b>“24/7 Drop.”</b>
            </li>

            <li>
              <b>Fill out the intake form online</b> on the next page. You <u>must</u> have a{' '}
              <b>Confirmation #</b> from the state check-in (<b>GoOutdoorsIN</b>) or we cannot
              process your deer.{' '}
              <a
                href="https://www.gooutdoorsin.com/login"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#a7e3ba', textDecoration: 'underline' }}
              >
                Check in at GoOutdoorsIN
              </a>
              .
            </li>

            <li>
              <b>If you want Webbs products</b>, fill out the Webbs form and note the form number and
              how many pounds you want sent to Webbs. You can view pricing here:{' '}
              <a
                href="/docs/webbs-price-list.pdf"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#a7e3ba', textDecoration: 'underline' }}
              >
                Webbs Smoked Venison price sheet (PDF)
              </a>
              .
              <div style={{ marginTop: 6, fontSize: 14, opacity: 0.9 }}>
                Take the <b>back copy</b> with you and leave the other two copies in the mailbox
                inside the cooler.
              </div>
            </li>

            <li>
              <b>Save the intake form.</b> On the physical McAfee tag, write your{' '}
              <b>Full Name</b>, <b>Phone Number</b>, and <b>Confirmation #</b>, and attach it to your deer.
            </li>

            <li>
              <b>Place your deer at the furthest point</b> inside the cooler.
            </li>

            <li>
              <b>Watch your email.</b> We’ll email once it’s officially tagged, and again when it’s ready
              for pickup.
            </li>
          </ol>

          <div style={{ marginTop: 6, fontSize: 13, opacity: 0.85 }}>
            Tip: If you prefer to do the online intake on your phone outside first, that’s fine—just make
            sure the tag on the deer has your name, phone, and confirmation number so we can match it.
          </div>

          {/* Agreement + gated start button */}
          <form
            action="/intake/overnight"
            method="get"
            style={{
              marginTop: 8,
              paddingTop: 12,
              borderTop: '1px solid #1f2937',
              display: 'grid',
              gap: 12,
            }}
          >
            {/* Hidden hint for analytics/routing if you want it later */}
            <input type="hidden" name="src" value="overnight-info" />
            <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', lineHeight: 1.35 }}>
              <input
                type="checkbox"
                name="agree"
                required
                aria-required="true"
                style={{ marginTop: 2, transform: 'scale(1.1)' }}
              />
              <span>
                I have read the instructions above and agree to follow the overnight drop-off rules,
                including providing my state <b>Confirmation #</b> and attaching a tag with my{' '}
                <b>Full Name</b>, <b>Phone Number</b>, and <b>Confirmation #</b> to the deer.
              </span>
            </label>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                type="submit"
                style={{
                  display: 'inline-block',
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: '1px solid #1f2937',
                  background: '#13202c',
                  color: '#e6e7eb',
                  fontWeight: 800,
                }}
              >
                Start Overnight Intake Form
              </button>

              <Link
                href="/"
                style={{
                  display: 'inline-block',
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: '1px solid #1f2937',
                  background: 'transparent',
                  color: '#c7ced6',
                  fontWeight: 800,
                  textDecoration: 'none',
                }}
              >
                Back to Home
              </Link>
            </div>
          </form>
        </div>

        {/* Optional property photo — put a file at public/overnight-map.jpg if you want this block */}
        {/* <figure style={{ marginTop: 14 }}>
          <img
            src="/overnight-map.jpg"
            alt="Property overview and 24/7 drop location"
            style={{ width: '100%', borderRadius: 12, border: '1px solid #1f2937' }}
          />
          <figcaption style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
            Rear cooler door is marked “24/7 Drop”.
          </figcaption>
        </figure> */}
      </main>
    </>
  );
}

