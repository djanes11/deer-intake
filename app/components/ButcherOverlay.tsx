'use client';

import type { CSSProperties } from 'react';

type Row = Record<string, any>;

const CARD: CSSProperties = {
  border: '1px solid #22303a',
  borderRadius: 20,
  padding: '18px 20px',
  background: 'linear-gradient(180deg, rgba(18,26,31,.98), rgba(12,18,22,.98))',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,.03)',
};

export default function ButcherOverlay({ job, visible }: { job?: Row | null; visible: boolean }) {
  const row = job || {};

  const key = (s: string) => s.toLowerCase().replace(/\s+/g, '');
  function get(...names: string[]) {
    for (const n of names) {
      const k = key(n);
      const hit = Object.keys(row).find((rk) => key(rk) === k);
      if (hit) return row[hit];
    }
    return '';
  }

  const isOn = (v: any) => {
    if (typeof v === 'boolean') return v;
    const s = String(v ?? '').trim().toLowerCase();
    if (!s || ['0', 'false', 'no', 'off', 'none', 'n/a', 'na'].includes(s)) return false;
    if (['true', 'yes', 'y', 'x', '1', 'on', 'paid'].includes(s)) return true;
    const n = Number(s);
    return Number.isFinite(n) ? n > 0 : !!s;
  };

  const tag = String(get('Tag') ?? '').trim();
  const customer = String(
    get('Customer', 'Customer Name', 'CustomerName', 'customerName', 'name', 'customer') ?? ''
  ).trim();
  const processType = String(get('Process Type', 'processType') ?? '').trim();
  const notes = String(get('Notes', 'notes') ?? '').trim();
  const steaksPerPack = String(get('Steaks per Package', 'Steaks Per Package', 'steaksPerPackage') ?? '').trim();
  const burgerSize = String(get('Burger Size', 'burgerSize') ?? '').trim();
  const backstrapPrep = String(get('Backstrap Prep', 'backstrapPrep') ?? '').trim();
  const beefFat = isOn(get('Beef Fat', 'beefFat'));

  const hindRoastCount = String(get('Hind Roast Count', 'hindRoastCount') ?? '').trim();
  const frontRoastCount = String(get('Front Roast Count', 'frontRoastCount') ?? '').trim();

  const hind = [
    isOn(get('Hind - Steak', 'hindSteak')) ? 'Steak' : '',
    isOn(get('Hind - Roast', 'hindRoast')) ? `Roast${hindRoastCount ? ` (${hindRoastCount})` : ''}` : '',
    isOn(get('Hind - Grind', 'hindGrind')) ? 'Grind' : '',
    isOn(get('Hind - None', 'hindNone')) ? 'None' : '',
  ].filter(Boolean);

  const front = [
    isOn(get('Front - Roast', 'frontRoast')) ? `Roast${frontRoastCount ? ` (${frontRoastCount})` : ''}` : '',
    isOn(get('Front - Grind', 'frontGrind')) ? 'Grind' : '',
    isOn(get('Front - None', 'frontNone')) ? 'None' : '',
  ].filter(Boolean);

  const specialtyItems = [
    ['Original Summer Sausage', get('Original Summer Sausage (lb)', 'originalSummerSausageLbs')],
    ['Summer Sausage + Cheese', get('Summer Sausage + Cheese (lb)', 'summerSausageCheeseLbs')],
    ['Jalapeno Summer Sausage + Cheddar', get('Jalapeno Summer Sausage + Cheddar (lb)', 'jalapenoSummerSausageCheeseLbs')],
    ['Original Snack Stix', get('Original Snack Stix (lb)', 'originalSnackSticksLbs')],
    ['Original Snack Stix + Cheddar', get('Original Snack Stix + Cheddar (lb)', 'originalSnackSticksCheeseLbs')],
    ['Jalapeno Snack Stix + Cheddar', get('Jalapeno Snack Stix + Cheddar (lb)', 'jalapenoSnackSticksCheeseLbs')],
  ]
    .map(([label, pounds]) => {
      const value = Number(pounds ?? 0) || 0;
      return value > 0 ? `${label}: ${value} lb` : '';
    })
    .filter(Boolean);

  const webbsPounds = String(get('Webbs Pounds', 'webbsPounds') ?? '').trim();
  const webbsPoundsNum = Number(webbsPounds || 0) || 0;
  const webbsItemsRaw = get('Webbs Items', 'webbsItems');
  const webbsItemsText = (() => {
    if (Array.isArray(webbsItemsRaw)) {
      return webbsItemsRaw
        .map((item: any) => {
          const label = item?.label || item?.key || '';
          const pounds = item?.pounds ? ` (${item.pounds} lb)` : '';
          const percent = item?.percent ? ` (${item.percent}%)` : '';
          return `${label}${pounds || percent}`.trim();
        })
        .filter(Boolean);
    }
    if (typeof webbsItemsRaw === 'string' && webbsItemsRaw.trim()) {
      try {
        const parsed = JSON.parse(webbsItemsRaw);
        if (Array.isArray(parsed)) {
          return parsed
            .map((item: any) => {
              const label = item?.label || item?.key || '';
              const pounds = item?.pounds ? ` (${item.pounds} lb)` : '';
              const percent = item?.percent ? ` (${item.percent}%)` : '';
              return `${label}${pounds || percent}`.trim();
            })
            .filter(Boolean);
        }
      } catch {}
    }
    return [] as string[];
  })();

  const webbsStyle = String(get('Webbs Order Style', 'webbsOrderStyle') ?? '').trim();
  const showSpecialty = specialtyItems.length > 0;
  const showWebbs =
    isOn(get('Webbs Order', 'webbsOrder')) ||
    webbsItemsText.length > 0 ||
    webbsPoundsNum > 0 ||
    webbsStyle === 'whole_deer_percent';

  const SummaryCard = ({ label, value }: { label: string; value: string }) => (
    <div style={CARD}>
      <div style={{ fontSize: 18, color: '#9fb0bb', marginBottom: 8, fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 34, fontWeight: 900, lineHeight: 1.12, whiteSpace: 'pre-wrap' }}>
        {value || '-'}
      </div>
    </div>
  );

  const ListCard = ({ label, items, empty = 'None' }: { label: string; items: string[]; empty?: string }) => (
    <div style={CARD}>
      <div style={{ fontSize: 18, color: '#9fb0bb', marginBottom: 10, fontWeight: 700 }}>{label}</div>
      <div style={{ display: 'grid', gap: 10 }}>
        {(items.length ? items : [empty]).map((item) => (
          <div
            key={`${label}-${item}`}
            style={{
              fontSize: 30,
              fontWeight: 800,
              lineHeight: 1.18,
              padding: '10px 12px',
              borderRadius: 14,
              background: 'rgba(34,197,94,.08)',
              border: '1px solid rgba(34,197,94,.22)',
            }}
          >
            {item}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div
      aria-hidden={!visible}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(4,8,11,.88)',
        display: visible ? 'flex' : 'none',
        alignItems: 'stretch',
        justifyContent: 'center',
        padding: '2vh 2vw',
        pointerEvents: 'none',
        userSelect: 'none',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 1700,
          minHeight: '96vh',
          borderRadius: 28,
          background: 'linear-gradient(180deg, #0b0f12, #071015)',
          color: '#edf4f8',
          border: '1px solid #22303a',
          boxShadow: '0 24px 60px rgba(0,0,0,.45)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '24px 30px',
            borderBottom: '1px solid #1c2931',
            display: 'grid',
            gridTemplateColumns: '1.15fr .85fr',
            gap: 24,
            alignItems: 'center',
            background: 'linear-gradient(180deg, rgba(19,32,27,.88), rgba(11,15,18,.88))',
          }}
        >
          <div>
            <div style={{ fontSize: 22, letterSpacing: '.08em', textTransform: 'uppercase', color: '#97b4a4', fontWeight: 800 }}>
              Butcher Processing
            </div>
            <div style={{ fontSize: 72, fontWeight: 950, lineHeight: 1, marginTop: 8 }}>{tag || '-'}</div>
            <div style={{ fontSize: 42, fontWeight: 800, lineHeight: 1.12, marginTop: 10 }}>{customer || 'Unknown customer'}</div>
          </div>
          <div style={{ display: 'grid', gap: 14, justifyItems: 'stretch' }}>
            <SummaryCard label="Process Type" value={processType} />
          </div>
        </div>

        <div
          style={{
            padding: 26,
            display: 'grid',
            gap: 18,
            gridTemplateColumns: '1.15fr .85fr',
            alignItems: 'start',
          }}
        >
          <div style={{ display: 'grid', gap: 18 }}>
            <div style={{ display: 'grid', gap: 18, gridTemplateColumns: 'repeat(2, minmax(0,1fr))' }}>
              <ListCard label="Hind Quarter" items={hind} />
              <ListCard label="Front Shoulder" items={front} />
            </div>

            <div style={{ display: 'grid', gap: 18, gridTemplateColumns: 'repeat(3, minmax(0,1fr))' }}>
              <SummaryCard label="Steaks / Package" value={steaksPerPack} />
              <SummaryCard label="Burger Size" value={burgerSize} />
              <SummaryCard label="Backstrap" value={backstrapPrep} />
            </div>

            <div style={CARD}>
              <div style={{ fontSize: 18, color: '#9fb0bb', marginBottom: 10, fontWeight: 700 }}>Add-ons / Notes</div>
              <div style={{ display: 'grid', gap: 12 }}>
                <div style={{ fontSize: 28, fontWeight: 800 }}>
                  Beef Fat: <span style={{ color: beefFat ? '#8df2a8' : '#c7d4dd' }}>{beefFat ? 'YES' : 'NO'}</span>
                </div>
                {notes ? (
                  <div
                    style={{
                      fontSize: 34,
                      fontWeight: 950,
                      lineHeight: 1.22,
                      whiteSpace: 'pre-wrap',
                      padding: '14px 16px',
                      borderRadius: 14,
                      background: 'rgba(34,197,94,.08)',
                      border: '1px solid rgba(34,197,94,.2)',
                    }}
                  >
                    {notes}
                  </div>
                ) : (
                  <div style={{ fontSize: 28, fontWeight: 700, color: '#c7d4dd' }}>No extra notes</div>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gap: 18 }}>
            {showSpecialty ? (
              <ListCard label="Specialty Products" items={specialtyItems} empty="No specialty products selected" />
            ) : null}

            {showWebbs ? (
              <div style={CARD}>
                <div style={{ fontSize: 18, marginBottom: 10, fontWeight: 700, color: '#9fb0bb' }}>
                  Webbs Order
                </div>
                <div style={{ display: 'grid', gap: 12 }}>
                  <div style={{ fontSize: 28, fontWeight: 800 }}>
                    Total: <span style={{ color: '#8df2a8' }}>{webbsPoundsNum > 0 ? `${webbsPoundsNum} lb` : 'Whole deer'}</span>
                  </div>
                  {webbsStyle ? (
                    <div style={{ fontSize: 24, fontWeight: 700, color: '#c7d4dd' }}>
                      {webbsStyle === 'whole_deer_percent' ? 'Whole deer by percentages' : 'Products by pounds'}
                    </div>
                  ) : null}
                  {webbsItemsText.length ? (
                    <div style={{ display: 'grid', gap: 10 }}>
                      {webbsItemsText.map((item) => (
                        <div
                          key={item}
                          style={{
                            fontSize: 24,
                            fontWeight: 700,
                            lineHeight: 1.2,
                            padding: '10px 12px',
                            borderRadius: 12,
                            background: 'rgba(255,255,255,.04)',
                          }}
                        >
                          {item}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: 24, fontWeight: 700, color: '#c7d4dd' }}>Webbs selected</div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div
          style={{
            padding: '14px 28px 18px',
            borderTop: '1px solid #1c2931',
            fontSize: 24,
            fontWeight: 800,
            color: '#a9b8c2',
            textAlign: 'center',
          }}
        >
          Scan the same tag again when this deer is finished.
        </div>
      </div>
    </div>
  );
}
