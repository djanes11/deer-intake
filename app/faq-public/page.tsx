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
    <main>
      <div style={{ maxWidth: 1000, margin: '20px auto', padding: '0 16px' }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 10 }}>Frequently Asked Questions</h1>

        <div style={{ display: 'grid', gap: 12 }}>
          {faqItems.map((item) => (
            <section key={item.question}>
              <h3 style={{ fontSize: 18, fontWeight: 800 }}>{item.question}</h3>
              <p>{item.answer}</p>
            </section>
          ))}

          <section>
            <h3 style={{ fontSize: 18, fontWeight: 800 }}>What are your hours?</h3>
            <p>
              See our <Link href="/hours">season hours</Link>. If in doubt, call ahead.
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
