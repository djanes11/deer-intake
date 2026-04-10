import 'server-only';
import Link from 'next/link';
import { getPublicSiteSettings } from '@/lib/siteSettings';

export default async function FAQPublic() {
  const settings = await getPublicSiteSettings();
  const branding = settings.branding;
  const tel = branding.phoneE164 || (branding.phoneDisplay ? `tel:${String(branding.phoneDisplay).replace(/\D+/g, '')}` : '');
  const phoneHref = String(tel).startsWith('tel:') ? tel : `tel:${tel}`;
  const faqItems = settings.publicCopy?.faqItems?.length
    ? settings.publicCopy.faqItems
    : [
        {
          question: 'How do I use the Public Intake Form?',
          answer: 'See the public intake guide for step-by-step instructions, after-hours drop-off, and what to do after you submit.',
        },
        {
          question: 'Where are you located?',
          answer: branding.address,
        },
        {
          question: 'How will I know my deer is ready?',
          answer: 'We will use the contact method you selected on your intake form for updates, and you can also check status any time.',
        },
      ];

  return (
    <main className="app-frame" style={{ maxWidth: 980 }}>
      <section className="app-hero">
        <div className="app-hero-grid">
          <div style={{ display: 'grid', gap: 8 }}>
            <div className="app-kicker">Public FAQ</div>
            <h1 className="app-title" style={{ fontSize: 'clamp(28px, 5vw, 38px)' }}>Frequently Asked Questions</h1>
            <p className="app-copy">
              Quick answers for the things customers ask most often about public intake, status updates, hours, and contacting the shop.
            </p>
          </div>
          <div className="app-side-note">
            <div style={{ fontWeight: 900, color: '#fff7e8' }}>Best next step</div>
            <div style={{ color: 'rgba(245,236,216,.84)', lineHeight: 1.55 }}>
              If you still need help after reading these answers, check your status page or call the shop directly for the fastest answer.
            </div>
          </div>
        </div>
      </section>

      <section className="app-surface-light" style={{ padding: 18, display: 'grid', gap: 16 }}>
        <div className="app-section-head">
          <div className="app-section-title">Common Questions</div>
          <div className="app-section-copy">
            Customer-friendly answers that match the current public workflow.
          </div>
        </div>

        <div style={{ display: 'grid', gap: 12 }}>
          {faqItems.map((item) => (
            <section
              key={item.question}
              style={{
                border: '1px solid #dbe4ee',
                borderRadius: 16,
                background: '#ffffff',
                padding: 16,
                color: '#0f172a',
                display: 'grid',
                gap: 8,
              }}
            >
              <h2 style={{ fontSize: 18, fontWeight: 900, margin: 0 }}>{item.question}</h2>
              <p style={{ margin: 0, color: '#475569', lineHeight: 1.6 }}>{item.answer}</p>
            </section>
          ))}

          <section
            style={{
              border: '1px solid #dbe4ee',
              borderRadius: 16,
              background: '#ffffff',
              padding: 16,
              color: '#0f172a',
              display: 'grid',
              gap: 8,
            }}
          >
            <h2 style={{ fontSize: 18, fontWeight: 900, margin: 0 }}>What are your hours?</h2>
            <p style={{ margin: 0, color: '#475569', lineHeight: 1.6 }}>
              See our{' '}
              <Link href="/hours" style={{ color: '#2f6f3f', textDecoration: 'none', fontWeight: 800 }}>
                season hours
              </Link>
              . If in doubt, call ahead.
            </p>
          </section>

          <section
            style={{
              border: '1px solid #dbe4ee',
              borderRadius: 16,
              background: '#ffffff',
              padding: 16,
              color: '#0f172a',
              display: 'grid',
              gap: 8,
            }}
          >
            <h2 style={{ fontSize: 18, fontWeight: 900, margin: 0 }}>What&apos;s the best way to contact you?</h2>
            <p style={{ margin: 0, color: '#475569', lineHeight: 1.6 }}>
              Call us at{' '}
              <a href={phoneHref} style={{ color: '#2f6f3f', textDecoration: 'none', fontWeight: 800 }}>
                {branding.phoneDisplay}
              </a>
              .
            </p>
          </section>
        </div>
      </section>
    </main>
  );
}
