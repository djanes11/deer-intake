// app/faq/page.tsx — Customer FAQ (light cards)
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function FAQPage() {
  return (
    <main className="light-page watermark" style={{margin:'0 auto', maxWidth:860, padding:'18px 14px 40px'}}>
      <header className="form-card" style={{padding:14, borderRadius:12, marginBottom:12}}>
        <h1 style={{margin:'0 0 6px'}}>Deer Processing — FAQ</h1>
        <p className="muted">Common questions our customers ask. If you don’t see it here, give us a call.</p>
      </header>

      <section className="form-card" style={{padding:14, borderRadius:12}}>
        <details open>
          <summary><b>What are your drop‑off hours?</b></summary>
          <p style={{marginTop:8}}>We post hours on our door and social channels during the season. If you’re running late, call and we’ll do our best to accommodate.</p>
        </details>
        <hr style={{border:'none', borderTop:'1px solid #e6e9ec', margin:'12px 0'}}/>

        <details>
          <summary><b>How do I label my deer before drop‑off?</b></summary>
          <p style={{marginTop:8}}>Keep your tag with the deer. We’ll apply our barcode tag at intake so we can track it through every step.</p>
        </details>
        <hr style={{border:'none', borderTop:'1px solid #e6e9ec', margin:'12px 0'}}/>

        <details>
          <summary><b>What processing options do you offer?</b></summary>
          <p style={{marginTop:8}}>Standard processing, skull‑cap, European, and caping. We also offer specialty products: summer sausage (with/without cheese) and sliced jerky.</p>
        </details>
        <hr style={{border:'none', borderTop:'1px solid #e6e9ec', margin:'12px 0'}}/>

        <details>
          <summary><b>How is pricing calculated?</b></summary>
          <p style={{marginTop:8}}>Pricing is based on your chosen process type, optional beef fat, any Webbs work, and any specialty products (priced per pound). We’ll provide a running total preview on your form; the final amount may adjust once weights are confirmed.</p>
        </details>
        <hr style={{border:'none', borderTop:'1px solid #e6e9ec', margin:'12px 0'}}/>

        <details>
          <summary><b>What’s the usual turnaround time?</b></summary>
          <p style={{marginTop:8}}>Turnaround varies with volume, but most orders are completed within several days. We’ll email you when your order is <i>Finished &amp; Ready</i>.</p>
        </details>
        <hr style={{border:'none', borderTop:'1px solid #e6e9ec', margin:'12px 0'}}/>

        <details>
          <summary><b>How will I know when it’s ready?</b></summary>
          <p style={{marginTop:8}}>You’ll receive an automatic email to the address on your form when the status changes to <i>Finished &amp; Ready</i>.</p>
        </details>
        <hr style={{border:'none', borderTop:'1px solid #e6e9ec', margin:'12px 0'}}/>

        <details>
          <summary><b>What payment methods do you accept?</b></summary>
          <p style={{marginTop:8}}>Cash or card. If you need a split payment (processing vs. specialty), tell us at pickup and we’ll handle it.</p>
        </details>
        <hr style={{border:'none', borderTop:'1px solid #e6e9ec', margin:'12px 0'}}/>

        <details>
          <summary><b>Can I change my cut instructions after drop‑off?</b></summary>
          <p style={{marginTop:8}}>Call us as soon as possible. If processing hasn’t started on that section, we’ll try to accommodate.</p>
        </details>
        <hr style={{border:'none', borderTop:'1px solid #e6e9ec', margin:'12px 0'}}/>

        <details>
          <summary><b>What are “Webbs” and do I need it?</b></summary>
          <p style={{marginTop:8}}>Webbs is an outside service for certain work; if your order needs it, we’ll note it during intake and add a flat fee.</p>
        </details>
        <hr style={{border:'none', borderTop:'1px solid #e6e9ec', margin:'12px 0'}}/>

        <details>
          <summary><b>How is meat packaged?</b></summary>
          <p style={{marginTop:8}}>We vacuum‑seal cuts and label packages clearly. Burger is packed by your selected size.</p>
        </details>
        <hr style={{border:'none', borderTop:'1px solid #e6e9ec', margin:'12px 0'}}/>

        <details>
          <summary><b>Food safety tips?</b></summary>
          <p style={{marginTop:8}}>Keep the deer cool and clean before drop‑off. After pickup, keep products refrigerated or frozen. Follow USDA best practices for thawing and cooking.</p>
        </details>
        <hr style={{border:'none', borderTop:'1px solid #e6e9ec', margin:'12px 0'}}/>

        <details>
          <summary><b>Who do I contact with questions?</b></summary>
          <p style={{marginTop:8}}>Reply to your intake or ready email, or call the shop during hours. We’re happy to help.</p>
        </details>
      </section>
    </main>
  );
}
