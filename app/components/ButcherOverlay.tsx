'use client';

import { specialtyMeatLbs } from '@/lib/specialtyYield';
import React from 'react';
import type { CSSProperties } from 'react';
import { specialtyBreakdown } from '@/lib/specialty';
import { filterVisibleAddOnItems, normalizeJobAddOnItems } from '@/lib/processorCatalog';
import type { CutOptionSettings } from '@/lib/cutOptions';

type Row = Record<string, any>;

const CARD: CSSProperties = {
  border: '1px solid #22303a',
  borderRadius: 16,
  padding: 'clamp(9px, 0.9vmin, 19px)',
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
  const [isFullscreen, setIsFullscreen] = React.useState(false);

  React.useEffect(() => {
    const syncFullscreen = () => setIsFullscreen(!!document.fullscreenElement);
    syncFullscreen();
    document.addEventListener('fullscreenchange', syncFullscreen);
    return () => document.removeEventListener('fullscreenchange', syncFullscreen);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch {}
  };

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

  const specialtyRows = specialtyBreakdown(row as Record<string, any>).filter(item => item.pounds > 0);
  const specialtyTotalLbs = specialtyBreakdown(row as Record<string, any>)
    .filter((item) => item.pounds > 0)
    .reduce((sum, item) => sum + specialtyMeatLbs(item, Number(item.pounds || 0)), 0);

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
      <div style={{ fontSize: 'clamp(14px, 0.625vmin, 17px)', color: '#9fb0bb', marginBottom: 6, fontWeight: 800 }}>{label}</div>
      <div style={{ fontSize: 'clamp(28px, 2vmin, 48px)', fontWeight: 950, lineHeight: 1.04, whiteSpace: 'pre-wrap' }}>
        {value || '-'}
      </div>
    </div>
  );

  const ListCard = ({ label, items }: { label: string; items: string[] }) => (
    <div style={CARD}>
      <div style={{ fontSize: 'clamp(14px, 0.675vmin, 18px)', color: '#9fb0bb', marginBottom: 7, fontWeight: 800 }}>{label}</div>
      <div style={{ display: 'grid', gap: 'clamp(10px, .9vw, 22px)' }}>
        {items.map((item) => (
          <div
            key={`${label}-${item}`}
            style={{
              fontSize: 'clamp(28px, 1.8vmin, 46px)',
              fontWeight: 900,
              lineHeight: 1.08,
              padding: 'clamp(6px, 0.5vmin, 12px) clamp(7px, 0.6vmin, 15px)',
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
      className="butcher-tv-overlay"
      aria-hidden={!visible}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: '#03080b',
        display: visible ? 'flex' : 'none',
        alignItems: 'stretch',
        justifyContent: 'center',
        padding: 0,
        pointerEvents: 'none',
        userSelect: 'none',
      }}
    >
      <div
        style={{
          width: '100vw',
          maxWidth: 'none',
          height: '100vh',
          minHeight: '100vh',
          borderRadius: 0,
          background: 'linear-gradient(180deg, #0b0f12, #071015)',
          color: '#edf4f8',
          border: 'none',
          boxShadow: '0 24px 60px rgba(0,0,0,.45)',
          overflow: 'hidden',
          display: 'grid',
          gridTemplateRows: 'auto minmax(0, 1fr) auto',
        }}
      >
        <div
          style={{
            padding: 'clamp(12px, 1.5vh, 23px) clamp(17px, 2vmin, 41px)',
            borderBottom: '1px solid #1c2931',
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.35fr) minmax(180px, .65fr)',
            gap: 'clamp(12px, 1.5vmin, 35px)',
            alignItems: 'center',
            background: 'linear-gradient(180deg, rgba(19,32,27,.88), rgba(11,15,18,.88))',
          }}
        >
          <div>
            <div style={{ fontSize: 'clamp(14px, 0.9vmin, 23px)', letterSpacing: 0, textTransform: 'uppercase', color: '#97b4a4', fontWeight: 900 }}>
              Butcher Processing
            </div>
            <div style={{ fontSize: 'clamp(56px, 5.25vmin, 125px)', fontWeight: 950, lineHeight: .9, marginTop: 5, overflowWrap: 'anywhere' }}>{tag || '-'}</div>
            <div style={{ fontSize: 'clamp(39px, 3.3vmin, 85px)', fontWeight: 950, lineHeight: .96, marginTop: 7, overflowWrap: 'anywhere' }}>{customer || 'Unknown customer'}</div>
          </div>
          <div style={{ display: 'grid', gap: 10, justifyItems: 'end', alignContent: 'start' }}>
            <div style={{ fontSize: 'clamp(14px, 0.75vmin, 21px)', fontWeight: 900, color: '#9fb0bb', letterSpacing: 0, textTransform: 'uppercase' }}>
              Processing View
            </div>
            <div style={{ fontSize: 'clamp(17px, 1.25vmin, 32px)', fontWeight: 900, color: '#dfe9ee', lineHeight: 1.08, textAlign: 'right' }}>
              Follow the cut instructions, then scan the tag again.
            </div>
          </div>
        </div>

        <div
          style={{
            padding: 'clamp(11px, 1.1vmin, 27px)',
            display: 'grid',
            gap: 'clamp(9px, 0.8vmin, 19px)',
            gridTemplateColumns: 'minmax(0, 1.55fr) minmax(240px, .7fr)',
            alignItems: 'start',
            minHeight: 0,
            overflow: 'auto',
            pointerEvents: 'auto',
          }}
        >
          <div style={{ display: 'grid', gap: 'clamp(9px, 0.75vmin, 18px)', minHeight: 0 }}>
            {detailCards.length ? (
              <div style={{ ...CARD, display: 'grid', gap: 'clamp(7px, 0.5vmin, 14px)' }}>
                <div style={{ fontSize: 'clamp(14px, 0.725vmin, 19px)', color: '#9fb0bb', fontWeight: 800 }}>Primary Cut Instructions</div>
                <div style={{ display: 'grid', gap: 'clamp(7px, 0.6vmin, 15px)', gridTemplateColumns: `repeat(${Math.max(1, Math.min(detailCards.length, 3))}, minmax(0,1fr))` }}>
                  {detailCards.map((card) => (
                    <SummaryCard key={card.label} label={card.label} value={card.value} />
                  ))}
                </div>
              </div>
            ) : null}

            {(hind.length || front.length) ? (
              <div style={{ display: 'grid', gap: 'clamp(9px, 0.75vmin, 18px)', gridTemplateColumns: 'repeat(2, minmax(0,1fr))' }}>
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
                <div style={{ fontSize: 'clamp(14px, 0.75vmin, 21px)', color: '#fff3b0', marginBottom: 7, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 0 }}>
                  Notes
                </div>
                <div
                  style={{
                    fontSize: 'clamp(28px, 2vmin, 51px)',
                    fontWeight: 950,
                    lineHeight: 1.08,
                    whiteSpace: 'pre-wrap',
                    color: '#fffbea',
                    overflowWrap: 'anywhere',
                  }}
                >
                  {notes}
                </div>
              </div>
            ) : null}
          </div>

          <div style={{ display: 'grid', gap: 'clamp(9px, 0.75vmin, 18px)', minHeight: 0 }}>
            <div style={{ ...CARD, display: 'grid', gap: 'clamp(8px, 0.6vmin, 15px)' }}>
              <div style={{ fontSize: 'clamp(14px, 0.95vmin, 25px)', color: '#9fb0bb', fontWeight: 900 }}>Watch For</div>

              {addOnItems.length ? (
                <div style={{ display: 'grid', gap: 'clamp(10px, .9vw, 22px)' }}>
                  <div style={{ fontSize: 'clamp(14px, 0.6vmin, 17px)', color: '#9fb0bb', fontWeight: 900, textTransform: 'uppercase', letterSpacing: 0 }}>Add-Ons</div>
                  {addOnItems.map((item) => (
                    <div
                      key={item}
                      style={{
                        fontSize: 'clamp(17px, 1.3vmin, 37px)',
                        fontWeight: 900,
                        lineHeight: 1.08,
                        padding: 'clamp(6px, 0.5vmin, 12px) clamp(7px, 0.6vmin, 15px)',
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
                <div style={{ display: 'grid', gap: 'clamp(10px, .9vw, 22px)' }}>
                  <div style={{ fontSize: 'clamp(14px, 0.6vmin, 17px)', color: '#9fb0bb', fontWeight: 900, textTransform: 'uppercase', letterSpacing: 0 }}>Specialty</div>
                  <div
                    style={{
                      fontSize: 'clamp(28px, 1.9vmin, 50px)',
                      fontWeight: 950,
                      lineHeight: 1.04,
                      padding: 'clamp(6px, 0.5vmin, 12px) clamp(7px, 0.6vmin, 15px)',
                      borderRadius: 14,
                      background: 'linear-gradient(180deg, rgba(94,76,17,.98), rgba(63,49,10,.98))',
                      border: '1px solid rgba(245, 215, 72, .38)',
                      boxShadow: '0 0 0 1px rgba(255,229,143,.08), inset 0 1px 0 rgba(255,255,255,.04)',
                      color: '#fffbea',
                    }}
                  >
                    {specialtyTotalLbs} lb meat needed
                    <div style={{ fontSize: 18 }}>{specialtyRows.map(item => <div key={item.key}>{item.shortLabel}: {specialtyMeatLbs(item, item.pounds)} lb meat → {item.pounds} lb take-home</div>)}</div>
                  </div>
                </div>
              ) : null}

              {showWebbs ? (
                <div style={{ display: 'grid', gap: 'clamp(10px, .9vw, 22px)' }}>
                  <div style={{ fontSize: 'clamp(14px, 0.6vmin, 17px)', color: '#9fb0bb', fontWeight: 900, textTransform: 'uppercase', letterSpacing: 0 }}>Webbs</div>
                  <div
                    style={{
                      fontSize: 'clamp(28px, 1.9vmin, 50px)',
                      fontWeight: 950,
                      lineHeight: 1.04,
                      padding: 'clamp(6px, 0.5vmin, 12px) clamp(7px, 0.6vmin, 15px)',
                      borderRadius: 14,
                      background: 'linear-gradient(180deg, rgba(94,76,17,.98), rgba(63,49,10,.98))',
                      border: '1px solid rgba(245, 215, 72, .38)',
                      boxShadow: '0 0 0 1px rgba(255,229,143,.08), inset 0 1px 0 rgba(255,255,255,.04)',
                      color: '#fffbea',
                    }}
                  >
                    {webbsStyle === 'whole_deer_percent' ? 'Whole deer' : `${webbsPounds} lb`}
                  </div>
                </div>
              ) : null}

              {!addOnItems.length && !showSpecialty && !showWebbs ? (
                <div style={{ fontSize: 'clamp(17px, 1.25vmin, 36px)', fontWeight: 800, color: '#c7d4dd' }}>No extra items</div>
              ) : null}
            </div>
          </div>
        </div>

        <div
          style={{
            padding: 'clamp(7px, 0.7vh, 14px) clamp(14px, 1.5vmin, 38px)',
            borderTop: '1px solid #1c2931',
            display: 'grid',
            gap: 'clamp(5px, 0.5vh, 11px)',
            pointerEvents: 'auto',
          }}
        >
          <div
            style={{
              fontSize: 'clamp(16px, 1.2vmin, 35px)',
              fontWeight: 900,
              color: '#a9b8c2',
              textAlign: 'center',
            }}
          >
            Scan the same tag again when this deer is finished.
          </div>
          <div
            style={{
              display: 'flex',
              gap: 'clamp(6px, 0.5vmin, 14px)',
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
                width: 'clamp(210px, 24vw, 310px)',
                maxWidth: '70vw',
                padding: 'clamp(7px, 0.5vmin, 14px) clamp(8px, 0.6vmin, 16px)',
                borderRadius: 12,
                border: '1px solid #475569',
                background: '#f8fafc',
                color: '#0f172a',
                fontSize: 'clamp(14px, 0.9vmin, 26px)',
                fontWeight: 800,
              }}
            />
            <button
              type="button"
              onClick={onManualSubmit}
              disabled={manualBusy || !manualTag.trim()}
              style={{
                padding: 'clamp(7px, 0.5vmin, 14px) clamp(11px, 0.9vmin, 24px)',
                borderRadius: 12,
                border: '1px solid #1f7a3f',
                background: manualBusy || !manualTag.trim() ? '#3b4a41' : '#2f7d42',
                color: '#f8fafc',
                fontSize: 'clamp(14px, 0.9vmin, 26px)',
                fontWeight: 900,
                cursor: manualBusy || !manualTag.trim() ? 'default' : 'pointer',
              }}
            >
              {manualBusy ? 'Submitting...' : 'Submit Tag'}
            </button>
            <button
              type="button"
              onClick={toggleFullscreen}
              style={{
                padding: 'clamp(7px, 0.5vmin, 14px) clamp(11px, 0.9vmin, 24px)',
                borderRadius: 12,
                border: '1px solid #475569',
                background: 'rgba(248,250,252,.08)',
                color: '#f8fafc',
                fontSize: 'clamp(14px, 0.9vmin, 26px)',
                fontWeight: 900,
                cursor: 'pointer',
              }}
            >
              {isFullscreen ? 'Exit Full Screen' : 'Full Screen'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
