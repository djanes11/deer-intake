import { SITE } from '@/lib/config';

export default function Contact() {
  return (
    <main style={{ maxWidth: 720, margin: '20px auto', padding: '0 12px' }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 10 }}>Contact</h1>
      <p>Phone: {SITE.phone}</p>
      <p>Email: {SITE.email}</p>
      <p><a href={SITE.mapsUrl} target="_blank" rel="noreferrer">{SITE.address}</a></p>
    </main>
  );
}
