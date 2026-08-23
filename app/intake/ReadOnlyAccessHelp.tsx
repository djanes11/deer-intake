export default function ReadOnlyAccessHelp({
  tag,
  businessName,
  phone,
  email,
  reason,
}: {
  tag?: string;
  businessName?: string;
  phone?: string;
  email?: string;
  reason?: string;
}) {
  const contactLine = [phone, email].filter(Boolean).join(' | ');
  return (
    <div className="light-page" style={{ maxWidth: 820, margin: '24px auto', padding: 16, background: '#ffffff', color: '#0b0f12', borderRadius: 16 }}>
      <div style={{ display: 'grid', gap: 14 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase', color: '#64748b' }}>
            Read-only intake link
          </div>
          <h1 style={{ color: '#0b0f12', margin: '6px 0 0', fontSize: 28, lineHeight: 1.1 }}>
            This intake link cannot be opened.
          </h1>
          <p style={{ color: '#374151', lineHeight: 1.55, margin: '10px 0 0' }}>
            {reason || 'The link may be old, incomplete, or copied without its secure access code.'}
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
          <div style={{ border: '1px solid #dbe4ee', borderRadius: 14, padding: 14, background: '#f8fafc', display: 'grid', gap: 8 }}>
            <div style={{ fontWeight: 950, color: '#0f172a' }}>Customer next step</div>
            <div style={{ color: '#475569', lineHeight: 1.5 }}>
              Contact {businessName || 'the processor'} and ask them to send a fresh intake link.
            </div>
            {contactLine ? <div style={{ color: '#0f172a', fontWeight: 900, overflowWrap: 'anywhere' }}>{contactLine}</div> : null}
          </div>

          <div style={{ border: '1px solid #fed7aa', borderRadius: 14, padding: 14, background: '#fff7ed', display: 'grid', gap: 8 }}>
            <div style={{ fontWeight: 950, color: '#0f172a' }}>Staff fix</div>
            <div style={{ color: '#7c2d12', lineHeight: 1.5 }}>
              Search {tag ? `tag ${tag}` : 'for this deer'}, open the Messages tab, and resend the Drop-Off Tagged notification to generate a fresh read-only link.
            </div>
            <a href="/search" style={{ color: '#166534', fontWeight: 950, textDecoration: 'none' }}>Open Search</a>
          </div>
        </div>
      </div>
    </div>
  );
}
