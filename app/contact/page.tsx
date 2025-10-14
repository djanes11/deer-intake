import 'server-only';
import CustomerHeader from '../components/CustomerHeader';

let SITE: any = {
  name: 'McAfee Custom Deer Processing',
  address: '3172 W 1100 N, Delphi, IN 46923',
  lat: 40.6436,
  lng: -86.6754,
  phone: '(765) 564-0048',
  phoneE164: '+17655640048',
  mapsUrl: 'https://maps.google.com/?q=3172%20W%201100%20N%2C%20Delphi%2C%20IN%2046923',
};
try {
  // @ts-ignore
  const cfg = require('@/lib/config'); SITE = cfg.SITE ?? SITE;
} catch {}

export default function ContactPage() {
  const tel = SITE?.phoneE164 || (SITE?.phone ? 'tel:' + String(SITE.phone).replace(/\D+/g, '') : '');
  const phoneHref = String(tel).startsWith('tel:') ? tel : `tel:${tel}`;
  return (
    <main>
      <CustomerHeader />
      <div style={{ maxWidth: 900, margin:'20px auto', padding:'0 16px' }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 10 }}>Contact</h1>
        <div style={{ display:'grid', gap:10 }}>
          <div><b>Phone:</b> <a href={phoneHref}>{SITE.phone}</a></div>
          <div><b>Address:</b> <a href={SITE.mapsUrl} target="_blank" rel="noreferrer">{SITE.address}</a></div>
        </div>
      </div>
    </main>
  );
}