// app/tips/page.tsx — Staff Tip Sheet (with Overnight Drop QR)
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import Image from 'next/image';

export default function TipsPage() {
  return (
    <main className="light-page watermark" style={{margin:'0 auto', maxWidth:960, padding:'18px 14px 40px'}}>
      <header className="form-card" style={{padding:14, borderRadius:12, marginBottom:12}}>
        <h1 style={{margin:'0 0 6px'}}>McAfee Intake App — Tip Sheet</h1>
        <p className="muted">Fast reminders for staff. Keep this page open during busy hours.</p>
      </header>

      {/* Overnight Drop QR */}
      <section className="form-card" style={{padding:14, borderRadius:12, marginBottom:12}}>
        <h2 style={{margin:'0 0 8px'}}>Overnight Drop — Scan Me</h2>
        <div style={{display:'flex', flexDirection:'column', alignItems:'center', gap:10}}>
          <p className="muted" style={{margin:0, textAlign:'center'}}>
            Ask after-hours customers to scan this code to start the <b>Overnight Drop</b> flow.
          </p>
          <div style={{
            background:'#fff', border:'1px solid #e6e9ec', borderRadius:12,
            padding:12, display:'inline-block'
          }}>
            <Image
              src="/img/overnight-qr.png"
              alt="Overnight Drop QR"
              width={260}
              height={260}
              priority
              style={{ display:'block', height:'auto', width:'260px' }}
            />
          </div>
          <div className="muted" style={{fontSize:12, textAlign:'center'}}>
            Tip: Print this page and post it by the night drop box.
          </div>
        </div>
      </section>

      <section className="form-card" style={{padding:14, borderRadius:12, marginBottom:12}}>
        <h2 style={{margin:'0 0 8px'}}>Quick Start</h2>
        <ol style={{paddingLeft:18, margin:'6px 0'}}>
          <li>From the Home page, choose <b>New Intake</b> for a fresh tag, or <b>Scan</b> to update an existing job.</li>
          <li>Always verify <b>Tag #</b>, <b>Customer Name</b>, and <b>Phone</b> before saving.</li>
          <li>Use <b>Search</b> if the barcode is damaged or missing; you can search by <i>name</i>, <i>tag</i>, or <i>confirmation #</i>.</li>
          <li>Set the correct <b>Process Type</b> first — it drives pricing and downstream steps.</li>
          <li>Hit <b>Save</b> even if you only changed status — it logs the update.</li>
        </ol>
      </section>

      <section className="form-card" style={{padding:14, borderRadius:12, marginBottom:12}}>
        <h2 style={{margin:'0 0 8px'}}>Status Flow</h2>
        <div style={{display:'grid', gap:8, gridTemplateColumns:'repeat(4, minmax(0,1fr))'}} className="grid">
          <div className="mini-card" style={{padding:'10px 12px', borderRadius:10, background:'#f5f8ff'}}>
            <div className="muted" style={{fontSize:12}}>1</div>
            <div><b>Dropped Off</b></div>
            <div className="muted" style={{fontSize:12}}>Intake complete</div>
          </div>
          <div className="mini-card" style={{padding:'10px 12px', borderRadius:10, background:'#f5f8ff'}}>
            <div className="muted" style={{fontSize:12}}>2</div>
            <div><b>Processing</b></div>
            <div className="muted" style={{fontSize:12}}>On the table</div>
          </div>
          <div className="mini-card" style={{padding:'10px 12px', borderRadius:10, background:'#f5f8ff'}}>
            <div className="muted" style={{fontSize:12}}>3</div>
            <div><b>Finished &amp; Ready</b></div>
            <div className="muted" style={{fontSize:12}}>Triggers the ready email</div>
          </div>
          <div className="mini-card" style={{padding:'10px 12px', borderRadius:10, background:'#f5f8ff'}}>
            <div className="muted" style={{fontSize:12}}>4</div>
            <div><b>Picked Up</b></div>
            <div className="muted" style={{fontSize:12}}>Closed</div>
          </div>
        </div>
        <p className="muted" style={{marginTop:8}}>Caping &amp; Webbs have their own sub-statuses; update those when relevant.</p>
      </section>

      <section className="form-card" style={{padding:14, borderRadius:12, marginBottom:12}}>
        <h2 style={{margin:'0 0 8px'}}>Scanning Tips</h2>
        <ul style={{paddingLeft:18, margin:'6px 0'}}>
          <li>Use the <b>Scan</b> page for the fastest status updates; the cursor auto-focuses the barcode field.</li>
          <li>If scanning fails, type the Tag # and press <kbd>Enter</kbd>.</li>
          <li>On shared devices, keep brightness high and lens clean for better reads.</li>
        </ul>
      </section>

      <section className="form-card" style={{padding:14, borderRadius:12, marginBottom:12}}>
        <h2 style={{margin:'0 0 8px'}}>Pricing Gotchas</h2>
        <ul style={{paddingLeft:18, margin:'6px 0'}}>
          <li><b>Process Type</b> sets the base. Changing it later will change the total preview.</li>
          <li><b>Beef Fat</b> adds a small fee; Webbs adds a separate fee.</li>
          <li><b>Specialty Products</b> (sausage/jerky) only show if selected; make sure to fill the pounds.</li>
        </ul>
      </section>

      <section className="form-card" style={{padding:14, borderRadius:12}}>
        <h2 style={{margin:'0 0 8px'}}>Troubleshooting</h2>
        <ul style={{paddingLeft:18, margin:'6px 0'}}>
          <li><b>“Failed to fetch” on Save</b>: Check the Apps Script URL in env (<code>NEXT_PUBLIC_GAS_BASE</code>) and your network.</li>
          <li><b>Picker shows no rows</b>: Make sure you searched exact <i>name</i> or <i>tag</i>; try phone last-4.</li>
          <li><b>Ready email didn’t send</b>: Verify the status really hit <i>Finished &amp; Ready</i> and that the email is present.</li>
        </ul>
      </section>
    </main>
  );
}
