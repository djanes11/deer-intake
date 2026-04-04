import Link from 'next/link';

const OPTIONS = [
  {
    name: 'Option 1',
    slug: 'wordmark-antler',
    note: 'Full name with a simple antler mark. Most balanced and easiest to use everywhere.',
  },
  {
    name: 'Option 2',
    slug: 'wordmark-tag',
    note: 'Full name with a tag icon. Feels more operational and literal.',
  },
  {
    name: 'Option 3',
    slug: 'monogram-antler',
    note: 'WGBB-led system logo with a cleaner SaaS feel.',
  },
  {
    name: 'Option 4',
    slug: 'monogram-board',
    note: 'WGBB with a cutting-board shape. Strongest if you want a badge-like brand.',
  },
] as const;

export default function LogoPreviewPage() {
  return (
    <main style={{ maxWidth: 1120, margin: '0 auto', padding: '24px 16px 40px', display: 'grid', gap: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'end' }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: '#89c096' }}>
            Branding
          </div>
          <h1 style={{ margin: '6px 0 0', fontSize: 34, fontWeight: 900 }}>Logo Options</h1>
          <p style={{ margin: '8px 0 0', opacity: 0.82, maxWidth: 720 }}>
            These are cleaner directions for Wild Game Butcher Board. Option 1 is also the temporary default in the shared shell right now.
          </p>
        </div>
        <Link href="/admin" className="btn" style={{ textDecoration: 'none' }}>
          Back to Admin
        </Link>
      </div>

      <div style={{ display: 'grid', gap: 16 }}>
        {OPTIONS.map((option) => (
          <section key={option.slug} className="card" style={{ padding: 16, display: 'grid', gap: 12 }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 900 }}>{option.name}</div>
              <div className="muted" style={{ marginTop: 4 }}>{option.note}</div>
              <div style={{ marginTop: 6, fontSize: 13, opacity: 0.75 }}>/logo-options/{option.slug}.svg</div>
            </div>

            <div style={{ display: 'grid', gap: 10 }}>
              <div style={{ padding: 16, borderRadius: 16, background: '#0c1210', border: '1px solid rgba(255,255,255,.08)' }}>
                <img src={`/logo-options/${option.slug}.svg`} alt={`${option.name} dark preview`} style={{ width: '100%', height: 'auto', display: 'block' }} />
              </div>
              <div style={{ padding: 16, borderRadius: 16, background: '#f6f3eb', border: '1px solid #e5ddd0' }}>
                <img src={`/logo-options/${option.slug}.svg`} alt={`${option.name} light preview`} style={{ width: '100%', height: 'auto', display: 'block' }} />
              </div>
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
