// app/faq-public/page.tsx
import { SITE } from '@/lib/config';

export default function PublicFAQ() {
  return (
    <main style={{ maxWidth: 720, margin: '20px auto', padding: '0 12px' }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 10 }}>
        FAQ — McAfee Custom Deer Processing
      </h1>

      <div style={{ lineHeight: 1.7 }}>
        <p>
          <b>How does overnight drop-off work?</b><br />
          Use the <a href="/drop">Overnight Drop</a> page to submit your details.
          Then write the <b>last 5</b> of your confirmation and your <b>name</b> on a tag,
          attach it to the deer, and place it in the freezer.
        </p>

        <p>
          <b>When will I be notified?</b><br />
          We’ll email when it’s tagged at opening and again when it’s finished.
        </p>

        <p>
          <b>What can I check online?</b><br />
          You can check your status any time at <a href="/status">/status</a> using your
          confirmation number (or tag + last name).
        </p>

        <p>
          <b>What cuts/specialty options do you offer?</b><br />
          Standard processing and options like caping, skull-cap, European mounts, jerky, etc.
          Ask at drop-off if you’re unsure about anything.
        </p>

        <p>
          <b>Turnaround time?</b><br />
          Varies by volume; we’ll notify you the moment it’s ready.
        </p>

        <hr style={{ border:'none', borderTop:'1px solid #1f2937', margin:'16px 0' }} />

        <h2 style={{ fontSize: 18, fontWeight: 800 }}>Hours & Contact</h2>
        <div style={{ marginTop: 8 }}>
          <div><b>Hours:</b> {SITE.hours.map(h => `${h.label} ${h.value}`).join(' · ')}</div>
          <div><b>Address:</b> <a href={SITE.mapsUrl} target="_blank" rel="noreferrer">{SITE.address}</a></div>
          <div><b>Phone:</b> {SITE.phone}</div>
          <div><b>Email:</b> {SITE.email}</div>
        </div>
      </div>
    </main>
  );
}
