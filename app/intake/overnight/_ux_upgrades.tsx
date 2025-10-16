// app/intake/overnight/_ux_upgrades.tsx
'use client';

import React, { PropsWithChildren } from 'react';

/** ---------- Styles (inline so you don't need to touch global CSS) ---------- */
export const styles = {
  muted: { color: '#9ca3af' },
  small: { fontSize: 12 },
  section: {
    container: {
      border: '1px solid #1f2937',
      background: '#0b0f12',
      borderRadius: 12,
      padding: '14px 14px',
    } as React.CSSProperties,
    title: { fontSize: 18, fontWeight: 900, margin: 0, color: '#f3f4f6' } as React.CSSProperties,
    desc: { margin: '6px 0 0', color: '#9ca3af', fontSize: 13, lineHeight: 1.5 } as React.CSSProperties,
  },
  stickyHeading: {
    position: 'sticky',
    top: 0,
    background: 'linear-gradient(180deg, rgba(11,15,18,.95), rgba(11,15,18,.75))',
    backdropFilter: 'blur(2px)',
    borderBottom: '1px solid #1f2937',
    padding: '8px 10px',
    zIndex: 20,
  } as React.CSSProperties,
  labelHint: { color: '#9ca3af', fontSize: 12, marginTop: 4 } as React.CSSProperties,
  status: {
    ok: { border: '1px solid #2a5f47', background: '#193b2e', color: '#a7e3ba', borderRadius: 10, padding: '10px 12px' } as React.CSSProperties,
    err: { border: '1px solid #7f1d1d', background: 'rgba(127,29,29,.15)', color: '#fecaca', borderRadius: 10, padding: '10px 12px' } as React.CSSProperties,
  },
};

/** ---------- Section wrapper (collapsible optional) ---------- */
export function Section(props: PropsWithChildren<{ title: string; desc?: string; collapsible?: boolean; defaultOpen?: boolean; sticky?: boolean }>) {
  const { title, desc, collapsible = false, defaultOpen = true, sticky = false, children } = props;

  if (collapsible) {
    return (
      <details open={defaultOpen} style={styles.section.container}>
        <summary style={{ ...styles.section.title, listStyle: 'none', cursor: 'pointer' }}>{title}</summary>
        {desc ? <p style={styles.section.desc}>{desc}</p> : null}
        <div style={{ marginTop: 10 }}>{children}</div>
      </details>
    );
  }

  return (
    <section style={styles.section.container}>
      <div style={sticky ? styles.stickyHeading : undefined}>
        <h3 style={styles.section.title}>{title}</h3>
        {desc ? <p style={styles.section.desc}>{desc}</p> : null}
      </div>
      <div style={{ marginTop: 10 }}>{children}</div>
    </section>
  );
}

/** ---------- Small hint under a label ---------- */
export function Hint({ children }: PropsWithChildren) {
  return <div style={styles.labelHint}>{children}</div>;
}

/** ---------- Bulletize a "Missing or invalid: a, b, c" message ---------- */
export function BulletErrors({ message }: { message?: string | null }) {
  if (!message) return null;
  const isOk = /^save/i.test(message);
  const isAggregate = /Missing or invalid:/i.test(message) && message.includes(', ');
  if (isAggregate) {
    const items = message.replace(/Missing or invalid:\s*/i, '').split(/,\s*/g).filter(Boolean);
    return (
      <div style={styles.status.err}>
        <div style={{ fontWeight: 800, marginBottom: 6 }}>Missing or invalid</div>
        <ul style={{ margin: 0, paddingLeft: 18 }}>{items.map((f) => <li key={f}>{f}</li>)}</ul>
      </div>
    );
  }
  return <div style={isOk ? styles.status.ok : styles.status.err}>{message}</div>;
}

/** ---------- Example usage (delete this after copying patterns) ----------
 *
 * import { Section, Hint, BulletErrors } from './_ux_upgrades';
 *
 * function OvernightIntakeForm() {
 *   const [msg, setMsg] = useState<string | null>(null);
 *
 *   return (
 *     <main style={{ display: 'grid', gap: 12, maxWidth: 900, margin: '16px auto', padding: '0 12px' }}>
 *       <Section title="Customer" desc="We’ll use this to contact you about your order." collapsible defaultOpen>
 *         // ... your existing inputs for name/phone/email
 *       </Section>
 *
 *       <Section title="Hunt Details" desc="Basic info from your GoOutdoorsIN check-in — we match your deer using this." collapsible defaultOpen>
 *         <label>
 *           Confirmation # 
 *           <Hint>9 digits from your GoOutdoorsIN check-in</Hint>
 *           <input inputMode="numeric" pattern="[0-9]*" />
 *         </label>
 *         <label>
 *           Deer Sex
 *           <Hint>(buck = male, doe = female)</Hint>
 *           // your radios
 *         </label>
 *       </Section>
 *
 *       <Section title="Cuts" desc="Pick how you’d like your meat from each section." collapsible defaultOpen>
 *         // ... your existing cut fields
 *       </Section>
 *
 *       <Section title="Packaging & Add-ons" desc="Choose steak cut, pack size, and if you want beef fat added." collapsible defaultOpen={false}>
 *         <label>
 *           Beef Fat
 *           <Hint>Adds fat to grind (+$5)</Hint>
 *           // checkbox/select
 *         </label>
 *       </Section>
 *
 *       <Section title="Backstrap" desc="Optional: how you’d like your backstrap prepared." collapsible defaultOpen={false} />
 *
 *       <Section title="McAfee Specialty Products" desc="Optional sausage and jerky add-ons." collapsible defaultOpen={false} />
 *
 *       <Section title="Webbs (optional)" desc="Only fill this out if you’re sending meat to Webbs." collapsible defaultOpen={false}>
 *         <label>
 *           Webbs Form #
 *           <Hint>Form number from your Webbs sheet</Hint>
 *           // input
 *         </label>
 *       </Section>
 *
 *       <Section title="Communication & Consent" desc="Tell us how you want to be contacted about updates." collapsible defaultOpen={false} />
 *
 *       <BulletErrors message={msg} />
 *
 *       <div style={{ position: 'sticky', bottom: 0, padding: 12, borderTop: '1px solid #1f2937', background: 'rgba(11,15,18,.85)', backdropFilter: 'blur(3px)' }}>
 *         <button>Save</button>
 *       </div>
 *     </main>
 *   );
 * }
 *
 */