import 'server-only';
import Link from 'next/link';
import { getPublicSiteSettings } from '@/lib/siteSettings';

export default async function FAQPublic() {
  const settings = await getPublicSiteSettings();
  const branding = settings.branding;
  const tel = branding.phoneE164 || (branding.phoneDisplay ? `tel:${String(branding.phoneDisplay).replace(/\D+/g, '')}` : '');
  const phoneHref = String(tel).startsWith('tel:') ? tel : `tel:${tel}`;

  return (
    <main>
      <div style={{ maxWidth: 1000, margin: '20px auto', padding: '0 16px' }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 10 }}>Frequently Asked Questions</h1>

        <div style={{ display: 'grid', gap: 12 }}>
          <section>
            <h3 style={{ fontSize: 18, fontWeight: 800 }}>How do I use the Public Intake Form?</h3>
            <p>
              See our <Link href="/overnight">step-by-step public intake guide</Link>. It explains the form, after-hours drop-off, and what to do after you submit.
            </p>
          </section>

          <section>
            <h3 style={{ fontSize: 18, fontWeight: 800 }}>Where are you located?</h3>
            <p>
              <a href={branding.mapsUrl} target="_blank" rel="noreferrer">
                {branding.address}
              </a>
            </p>
          </section>

          <section>
            <h3 style={{ fontSize: 18, fontWeight: 800 }}>What are your hours?</h3>
            <p>
              See our <Link href="/hours">season hours</Link>. If in doubt, call ahead.
            </p>
          </section>

          <section>
            <h3 style={{ fontSize: 18, fontWeight: 800 }}>How will I know my deer is ready?</h3>
            <p>
              We&apos;ll use the contact method you selected on your intake form for updates. You can also <Link href="/status">check status</Link> any time.
            </p>
          </section>

          <section>
            <h3 style={{ fontSize: 18, fontWeight: 800 }}>What&apos;s the best way to contact you?</h3>
            <p>
              Call us at <a href={phoneHref}>{branding.phoneDisplay}</a>.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
