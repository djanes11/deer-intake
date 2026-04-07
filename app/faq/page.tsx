export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function FAQPage() {
  return (
    <main className="light-page watermark" style={{ margin: '0 auto', maxWidth: 860, padding: '18px 14px 40px' }}>
      <header className="form-card" style={{ padding: 14, borderRadius: 12, marginBottom: 12 }}>
        <h1 style={{ margin: '0 0 6px' }}>Processor FAQ</h1>
        <p className="muted">Common questions staff get from customers. If you do not see it here, call the shop.</p>
      </header>

      <section className="form-card" style={{ padding: 14, borderRadius: 12 }}>
        <details open>
          <summary><b>What are your drop-off hours?</b></summary>
          <p style={{ marginTop: 8 }}>We post hours on our door and public pages during the season. If you are running late, call and we will do our best to accommodate.</p>
        </details>
        <hr style={{ border: 'none', borderTop: '1px solid #e6e9ec', margin: '12px 0' }} />

        <details>
          <summary><b>How do I label my deer before drop-off?</b></summary>
          <p style={{ marginTop: 8 }}>Keep your state tag with the deer. We will apply our barcode tag at intake so we can track it through every step.</p>
        </details>
        <hr style={{ border: 'none', borderTop: '1px solid #e6e9ec', margin: '12px 0' }} />

        <details>
          <summary><b>What processing options do you offer?</b></summary>
          <p style={{ marginTop: 8 }}>Standard processing, skull-cap, European, and caping. Many processors also offer specialty products like summer sausage or jerky.</p>
        </details>
        <hr style={{ border: 'none', borderTop: '1px solid #e6e9ec', margin: '12px 0' }} />

        <details>
          <summary><b>How is pricing calculated?</b></summary>
          <p style={{ marginTop: 8 }}>Pricing is based on the chosen process type, optional add-ons like beef fat, and any specialty products priced by pound. The running total on the form is an estimate until final weights are confirmed.</p>
        </details>
        <hr style={{ border: 'none', borderTop: '1px solid #e6e9ec', margin: '12px 0' }} />

        <details>
          <summary><b>What&apos;s the usual turnaround time?</b></summary>
          <p style={{ marginTop: 8 }}>Turnaround varies with volume, but most orders are completed within several days. Customers are notified when the order is <i>Finished &amp; Ready</i>.</p>
        </details>
        <hr style={{ border: 'none', borderTop: '1px solid #e6e9ec', margin: '12px 0' }} />

        <details>
          <summary><b>How will I know when it&apos;s ready?</b></summary>
          <p style={{ marginTop: 8 }}>The customer will receive an automatic update using the contact method selected on the intake form when the order reaches <i>Finished &amp; Ready</i>.</p>
        </details>
        <hr style={{ border: 'none', borderTop: '1px solid #e6e9ec', margin: '12px 0' }} />

        <details>
          <summary><b>What payment methods do you accept?</b></summary>
          <p style={{ marginTop: 8 }}>This depends on the processor. If the customer needs split payment between processing and specialty items, note it at pickup.</p>
        </details>
        <hr style={{ border: 'none', borderTop: '1px solid #e6e9ec', margin: '12px 0' }} />

        <details>
          <summary><b>Can I change cut instructions after drop-off?</b></summary>
          <p style={{ marginTop: 8 }}>Call as soon as possible. If processing has not started on that section yet, the shop may still be able to adjust it.</p>
        </details>
        <hr style={{ border: 'none', borderTop: '1px solid #e6e9ec', margin: '12px 0' }} />

        <details>
          <summary><b>How is meat packaged?</b></summary>
          <p style={{ marginTop: 8 }}>Cuts are packaged clearly and burger is packed by the selected size. Exact packaging can vary a little by processor.</p>
        </details>
        <hr style={{ border: 'none', borderTop: '1px solid #e6e9ec', margin: '12px 0' }} />

        <details>
          <summary><b>Food safety tips?</b></summary>
          <p style={{ marginTop: 8 }}>Keep the deer cool and clean before drop-off. After pickup, keep products refrigerated or frozen and follow USDA best practices for thawing and cooking.</p>
        </details>
        <hr style={{ border: 'none', borderTop: '1px solid #e6e9ec', margin: '12px 0' }} />

        <details>
          <summary><b>Who do I contact with questions?</b></summary>
          <p style={{ marginTop: 8 }}>Reply to the intake or ready notification, or call the shop during hours. The processor can confirm turnaround, pricing, and pickup details.</p>
        </details>
      </section>
    </main>
  );
}
