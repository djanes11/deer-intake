'use client';

import React from 'react';
import type { CSSProperties } from 'react';
import { specialtyBreakdown } from '@/lib/specialty';
import { filterVisibleAddOnItems, normalizeJobAddOnItems } from '@/lib/processorCatalog';
import type { CutOptionSettings } from '@/lib/cutOptions';

type Row = Record<string, any>;

const CARD: CSSProperties = {
  border: '1px solid #22303a',
  borderRadius: 20,
  padding: '18px 20px',
  background: 'linear-gradient(180deg, rgba(18,26,31,.98), rgba(12,18,22,.98))',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,.03)',
};

export default function ButcherOverlay({
  job,
  visible,
  manualTag,
  manualBusy,
  webbsEnabled = true,
  cutOptions,
  onManualTagChange,
  onManualSubmit,
}: {
  job?: Row | null;
  visible: boolean;
  manualTag: string;
  manualBusy: boolean;
  webbsEnabled?: boolean;
  cutOptions: CutOptionSettings;
  onManualTagChange: (value: string) => void;
  onManualSubmit: () => void;
}) {
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
  const steakThicknessRaw = String(get('Steak Thickness', 'Steak Size', 'steak', 'steakSize', 'steak_size') ?? '').trim();
  const steakThicknessOther = String(get('Steak Thickness Other', 'Steak Size Other', 'steakOther', 'steak_size_other') ?? '').trim();
  const steakThickness = steakThicknessRaw === 'Other' ? steakThicknessOther : steakThicknessRaw;
  const burgerSize = String(get('Burger Size', 'burgerSize') ?? '').trim();
  const backstrapPrep = String(get('Backstrap Prep', 'backstrapPrep') ?? '').trim();
  const backstrapThicknessRaw = String(get('Backstrap Thickness', 'backstrapThickness') ?? '').trim();
  const backstrapThicknessOther = String(get('Backstrap Thickness Other', 'backstrapThicknessOther') ?? '').trim();
  const backstrapThickness = backstrapThicknessRaw === 'Other' ? backstrapThicknessOther : backstrapThicknessRaw;
  const hindRoastCount = String(get('Hind Roast Count', 'hindRoastCount') ?? '').trim();
  const frontRoastCount = String(get('Front Roast Count', 'frontRoastCount') ?? '').trim();
  const showFrontShoulderSteaks = cutOptions.showFrontShoulderSteaks !== false;
  const showSteakThickness = cutOptions.showSteakThickness !== false;
  const showBackstrapThickness = cutOptions.showBackstrapThickness !== false;
  const showRoastCounts = cutOptions.showRoastCounts !== false;

  const hind = [
    isOn(get('Hind - Steak', 'hindSteak')) ? 'Steak' : '',
    isOn(get('Hind - Roast', 'hindRoast')) ? `Roast${showRoastCounts && hindRoastCount ? ` (${hindRoastCount})` : ''}` : '',
    isOn(get('Hind - Grind', 'hindGrind')) ? 'Grind' : '',
    isOn(get('Hind - None', 'hindNone')) ? 'None' : '',
  ].filter(Boolean);

  const front = [
    showFrontShoulderSteaks && isOn(get('Front - Steak', 'frontSteak')) ? 'Steak' : '',
    isOn(get('Front - Roast', 'frontRoast')) ? `Roast${showRoastCounts && frontRoastCount ? ` (${frontRoastCount})` : ''}` : '',
    isOn(get('Front - Grind', 'frontGrind')) ? 'Grind' : '',
    isOn(get('Front - None', 'frontNone')) ? 'None' : '',
  ].filter(Boolean);

  const addOnItems = filterVisibleAddOnItems(
    normalizeJobAddOnItems(
      row.addOnItems ||
        row.add_on_items ||
        [
          isOn(get('Beef Fat', 'beefFat')) ? { slug: 'beef-fat', name: 'Beef Fat', selected: true, price: 5, sortOrder: 10, legacyBooleanKey: 'beefFat' } : null,
          isOn(get('Webbs Order', 'webbsOrder')) ? { slug: 'webbs-order', name: 'Webbs Add-On', selected: true, price: 20, sortOrder: 20, legacyBooleanKey: 'webbsOrder' } : null,
        ].filter(Boolean)
    ).filter((item) => item.selected),
    webbsEnabled
  ).map((item) => `${item.name}${Number(item.price) > 0 ? ` (+$${Number(item.price).toFixed(2)})` : ''}`);

  const specialtyTotalLbs = specialtyBreakdown(row as Record<string, any>)
    .filter((item) => item.pounds > 0)
    .reduce((sum, item) => sum + Number(item.pounds || 0), 0);

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
  const webbsDetailedTotal = webbsItemsText.reduce((sum, line) => {
    const m = String(line).match(/(\d+(?:\.\d+)?)\s*lb/i);
    return sum + (m ? Number(m[1]) : 0);
  }, 0);
  const webbsPounds = Number(get('Webbs Pounds', 'webbsPounds') ?? 0) || webbsDetailedTotal || 0;

  const webbsStyle = String(get('Webbs Order Style', 'webbsOrderStyle') ?? '').trim();
  const showSpecialty = specialtyTotalLbs > 0;
  const showWebbs = webbsEnabled && (
    isOn(get('Webbs Order', 'webbsOrder')) ||
    webbsItemsText.length > 0 ||
    webbsStyle === 'whole_deer_percent'
  );

  const SummaryCard = ({ label, value }: { label: string; value: string }) => (
    <div style={CARD}>
      <div style={{ fontSize: 18, color: '#9fb0bb', marginBottom: 8, fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 34, fontWeight: 900, lineHeight: 1.12, whiteSpace: 'pre-wrap' }}>
        {value || '-'}
      </div>
    </div>
  );

  const ListCard = ({ label, items }: { label: string; items: string[] }) => (
    <div style={CARD}>
      <div style={{ fontSize: 18, color: '#9fb0bb', marginBottom: 10, fontWeight: 700 }}>{label}</div>
      <div style={{ display: 'grid', gap: 10 }}>
        {items.map((item) => (
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

  const detailCards = [
    showSteakThickness && steakThickness ? { label: 'Steak Thickness', value: steakThickness } : null,
    steaksPerPack ? { label: 'Steaks / Package', value: steaksPerPack } : null,
    burgerSize ? { label: 'Burger Size', value: burgerSize } : null,
    backstrapPrep ? { label: 'Backstrap Prep', value: backstrapPrep } : null,
    showBackstrapThickness && backstrapThickness ? { label: 'Backstrap Thickness', value: backstrapThickness } : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>;

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
            <div style={{ fontSize: 72, fontWeight: 900, lineHeight: 1.02, marginTop: 10 }}>{customer || 'Unknown customer'}</div>
          </div>
          <div style={{ display: 'grid', gap: 10, justifyItems: 'end', alignContent: 'start' }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#9fb0bb', letterSpacing: '.08em', textTransform: 'uppercase' }}>
              Processing View
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#dfe9ee' }}>
              Follow the cut instructions, then scan the tag again.
            </div>
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
            {(processType || detailCards.length) ? (
              <div style={{ ...CARD, display: 'grid', gap: 14 }}>
                <div style={{ fontSize: 18, color: '#9fb0bb', fontWeight: 700 }}>Primary Cut Instructions</div>
                <div style={{ display: 'grid', gap: 14, gridTemplateColumns: `repeat(${Math.max(1, Math.min(detailCards.length + (processType ? 1 : 0), 5))}, minmax(0,1fr))` }}>
                  {processType ? <SummaryCard label="Process Type" value={processType} /> : null}
                  {detailCards.map((card) => (
                    <SummaryCard key={card.label} label={card.label} value={card.value} />
                  ))}
                </div>
              </div>
            ) : null}

            {(hind.length || front.length) ? (
              <div style={{ display: 'grid', gap: 18, gridTemplateColumns: 'repeat(2, minmax(0,1fr))' }}>
                {hind.length ? <ListCard label="Hind Quarter" items={hind} /> : <div />}
                {front.length ? <ListCard label="Front Shoulder" items={front} /> : <div />}
              </div>
            ) : null}

            {notes ? (
              <div
                style={{
                  ...CARD,
                  background: 'linear-gradient(180deg, rgba(94,76,17,.98), rgba(63,49,10,.98))',
                  border: '1px solid rgba(245, 215, 72, .38)',
                  boxShadow: '0 0 0 1px rgba(255,229,143,.08), inset 0 1px 0 rgba(255,255,255,.04)',
                }}
              >
                <div style={{ fontSize: 18, color: '#fff3b0', marginBottom: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                  Notes
                </div>
                <div
                  style={{
                    fontSize: 34,
                    fontWeight: 950,
                    lineHeight: 1.22,
                    whiteSpace: 'pre-wrap',
                    color: '#fffbea',
                  }}
                >
                  {notes}
                </div>
              </div>
            ) : null}
          </div>

          <div style={{ display: 'grid', gap: 18 }}>
            <div style={{ ...CARD, display: 'grid', gap: 14 }}>
              <div style={{ fontSize: 18, color: '#9fb0bb', fontWeight: 700 }}>Watch For</div>

              {addOnItems.length ? (
                <div style={{ display: 'grid', gap: 10 }}>
                  <div style={{ fontSize: 15, color: '#9fb0bb', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.05em' }}>Add-Ons</div>
                  {addOnItems.map((item) => (
                    <div
                      key={item}
                      style={{
                        fontSize: 24,
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
              ) : null}

              {showSpecialty ? (
                <div style={{ display: 'grid', gap: 10 }}>
                  <div style={{ fontSize: 15, color: '#9fb0bb', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.05em' }}>Specialty</div>
                  <div
                    style={{
                      fontSize: 28,
                      fontWeight: 900,
                      lineHeight: 1.18,
                      padding: '10px 12px',
                      borderRadius: 14,
                      background: 'rgba(255,255,255,.04)',
                      border: '1px solid rgba(255,255,255,.08)',
                    }}
                  >
                    {specialtyTotalLbs} lb
                  </div>
                </div>
              ) : null}

              {showWebbs ? (
                <div style={{ display: 'grid', gap: 10 }}>
                  <div style={{ fontSize: 15, color: '#9fb0bb', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.05em' }}>Webbs</div>
                  <div
                    style={{
                      fontSize: 28,
                      fontWeight: 900,
                      lineHeight: 1.18,
                      padding: '10px 12px',
                      borderRadius: 14,
                      background: 'rgba(255,255,255,.04)',
                      border: '1px solid rgba(255,255,255,.08)',
                    }}
                  >
                    {webbsStyle === 'whole_deer_percent' ? 'Whole deer' : `${webbsPounds} lb`}
                  </div>
                </div>
              ) : null}

              {!addOnItems.length && !showSpecialty && !showWebbs ? (
                <div style={{ fontSize: 22, fontWeight: 700, color: '#c7d4dd' }}>No extra items</div>
              ) : null}
            </div>
          </div>
        </div>

        <div
          style={{
            padding: '14px 28px 18px',
            borderTop: '1px solid #1c2931',
            display: 'grid',
            gap: 14,
            pointerEvents: 'auto',
          }}
        >
          <div
            style={{
              fontSize: 24,
              fontWeight: 800,
              color: '#a9b8c2',
              textAlign: 'center',
            }}
          >
            Scan the same tag again when this deer is finished.
          </div>
          <div
            style={{
              display: 'flex',
              gap: 12,
              alignItems: 'center',
              justifyContent: 'center',
              flexWrap: 'wrap',
            }}
          >
            <input
              value={manualTag}
              onChange={(e) => onManualTagChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  onManualSubmit();
                }
              }}
              placeholder="Enter tag to continue"
              aria-label="Enter tag to continue"
              style={{
                width: 320,
                maxWidth: '70vw',
                padding: '14px 16px',
                borderRadius: 12,
                border: '1px solid #475569',
                background: '#f8fafc',
                color: '#0f172a',
                fontSize: 22,
                fontWeight: 700,
              }}
            />
            <button
              type="button"
              onClick={onManualSubmit}
              disabled={manualBusy || !manualTag.trim()}
              style={{
                padding: '14px 22px',
                borderRadius: 12,
                border: '1px solid #1f7a3f',
                background: manualBusy || !manualTag.trim() ? '#3b4a41' : '#2f7d42',
                color: '#f8fafc',
                fontSize: 22,
                fontWeight: 900,
                cursor: manualBusy || !manualTag.trim() ? 'default' : 'pointer',
              }}
            >
              {manualBusy ? 'Submitting...' : 'Submit Tag'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
