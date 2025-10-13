import { SITE } from '@/lib/config';

export default function Hours() {
  return (
    <main style={{ maxWidth: 720, margin: '20px auto', padding: '0 12px' }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 10 }}>Hours & Location</h1>
      <ul style={{ listStyle:'none', padding:0, margin:0 }}>
        {SITE.hours.map((h, i) => (
          <li key={i} style={{ padding:'8px 0' }}><b>{h.label}</b>: {h.value}</li>
        ))}
      </ul>
      <div style={{ marginTop: 12 }}>
        <a href={SITE.mapsUrl} target="_blank" rel="noreferrer">{SITE.address}</a>
      </div>
      <div style={{ marginTop: 8 }}>Phone: {SITE.phone}</div>
      <div>Email: {SITE.email}</div>
    </main>
  );
}
