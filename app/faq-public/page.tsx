import 'server-only';
import Link from 'next/link';

let SITE: any = {
  address: '3172 W 1100 N, Delphi, IN 46923',
  mapsUrl: 'https://maps.google.com/?q=3172%20W%201100%20N%2C%20Delphi%2C%20IN%2046923',
  phone: '(765) 564-0048',
  phoneE164: '+17655640048'
};
try {
  // @ts-ignore
  const cfg = require('@/lib/config'); SITE = cfg.SITE ?? SITE;
} catch {}

export default function FAQPublic() {
  const tel = SITE?.phoneE164 || (SITE?.phone ? 'tel:' + String(SITE.phone).replace(/\D+/g, '') : '');
  const phoneHref = String(tel).startsWith('tel:') ? tel : `tel:${tel}`;

  return (
    <main>
      <div style={{maxWidth: 1000, margin:'20px auto', padding:'0 16px'}}>
        <h1 style={{ fontSize:28, fontWeight:800, marginBottom:10 }}>Frequently Asked Questions</h1>

        <div style={{ display:'grid', gap:12 }}>
          <section>
            <h3 style={{ fontSize:18, fontWeight:800 }}>How do I use Overnight Drop?</h3>
            <p>See our <Link href="/drop-instructions">step-by-step overnight drop guide</Link>. It also links to the online intake form.</p>
          </section>

          <section>
            <h3 style={{ fontSize:18, fontWeight:800 }}>Where are you located?</h3>
            <p>
              <a href={SITE.mapsUrl} target="_blank" rel="noreferrer">{SITE.address}</a>
            </p>
          </section>

          <section>
            <h3 style={{ fontSize:18, fontWeight:800 }}>What are your hours?</h3>
            <p>See our <Link href="/hours">season hours</Link>. If in doubt, call ahead.</p>
          </section>

          <section>
            <h3 style={{ fontSize:18, fontWeight:800 }}>How will I know my deer is ready?</h3>
            <p>We’ll email you as soon as it’s officially tagged and again when it’s ready. You can also <Link href="/status">check status</Link> any time.</p>
          </section>

          <section>
            <h3 style={{ fontSize:18, fontWeight:800 }}>What’s the best way to contact you?</h3>
            <p>
              Call us at <a href={phoneHref}>{SITE.phone}</a>.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}


{/* Added pricing helper */}
<section className="screen-only">
  <h3>Processing Prices</h3>
  <p className="muted">
    Standard Processing: <strong>$130</strong> • Caped: <strong>+$20</strong> (i.e., $150 total)
  </p>
</section>