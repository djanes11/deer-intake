'use client';

import React from 'react';
import type { CSSProperties } from 'react';
import { specialtyBreakdown } from '@/lib/specialty';
import { filterVisibleAddOnItems, normalizeJobAddOnItems } from '@/lib/processorCatalog';
import type { CutOptionSettings } from '@/lib/cutOptions';

type Row = Record<string, any>;

const CARD: CSSProperties = {
  border: '1px solid #22303a',
  borderRadius: 16,
  padding: 'clamp(18px, 1.8vw, 38px)',
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
      <div style={{ fontSize: 'clamp(20px, 1.25vw, 34px)', color: '#9fb0bb', marginBottom: 12, fontWeight: 800 }}>{label}</div>
      <div style={{ fontSize: 'clamp(46px, 4vw, 96px)', fontWeight: 950, lineHeight: 1.04, whiteSpace: 'pre-wrap' }}>
        {value || '-'}
      </div>
    </div>
  );

  const ListCard = ({ label, items }: { label: string; items: string[] }) => (
    <div style={CARD}>
      <div style={{ fontSize: 'clamp(22px, 1.35vw, 36px)', color: '#9fb0bb', marginBottom: 14, fontWeight: 800 }}>{label}</div>
      <div style={{ display: 'grid', gap: 'clamp(10px, .9vw, 22px)' }}>
        {items.map((item) => (
          <div
            key={`${label}-${item}`}
            style={{
              fontSize: 'clamp(44px, 3.6vw, 92px)',
              fontWeight: 900,
              lineHeight: 1.08,
              padding: 'clamp(12px, 1vw, 24px) clamp(14px, 1.2vw, 30px)',
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
          gridTemplateRows: 'minmax(220px, 27vh) minmax(0, 1fr) minmax(112px, 14vh)',
        }}
      >
        <div
          style={{
            padding: 'clamp(24px, 3vh, 46px) clamp(34px, 4vw, 82px)',
            borderBottom: '1px solid #1c2931',
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.35fr) minmax(340px, .65fr)',
            gap: 'clamp(24px, 3vw, 70px)',
            alignItems: 'center',
            background: 'linear-gradient(180deg, rgba(19,32,27,.88), rgba(11,15,18,.88))',
          }}
        >
          <div>
            <div style={{ fontSize: 'clamp(24px, 1.8vw, 46px)', letterSpacing: 0, textTransform: 'uppercase', color: '#97b4a4', fontWeight: 900 }}>
              Butcher Processing
            </div>
            <div style={{ fontSize: 'clamp(112px, 10.5vw, 250px)', fontWeight: 950, lineHeight: .9, marginTop: 10, overflowWrap: 'anywhere' }}>{tag || '-'}</div>
            <div style={{ fontSize: 'clamp(78px, 6.6vw, 170px)', fontWeight: 950, lineHeight: .96, marginTop: 14, overflowWrap: 'anywhere' }}>{customer || 'Unknown customer'}</div>
          </div>
          <div style={{ display: 'grid', gap: 10, justifyItems: 'end', alignContent: 'start' }}>
            <div style={{ fontSize: 'clamp(24px, 1.5vw, 42px)', fontWeight: 900, color: '#9fb0bb', letterSpacing: 0, textTransform: 'uppercase' }}>
              Processing View
            </div>
            <div style={{ fontSize: 'clamp(34px, 2.5vw, 64px)', fontWeight: 900, color: '#dfe9ee', lineHeight: 1.08, textAlign: 'right' }}>
              Follow the cut instructions, then scan the tag again.
            </div>
          </div>
        </div>

        <div
          style={{
            padding: 'clamp(22px, 2.2vw, 54px)',
            display: 'grid',
            gap: 'clamp(18px, 1.6vw, 38px)',
            gridTemplateColumns: 'minmax(0, 1.18fr) minmax(360px, .82fr)',
            alignItems: 'start',
            overflow: 'hidden',
          }}
        >
          <div style={{ display: 'grid', gap: 'clamp(18px, 1.5vw, 36px)', minHeight: 0 }}>
            {detailCards.length ? (
              <div style={{ ...CARD, display: 'grid', gap: 'clamp(14px, 1vw, 28px)' }}>
                <div style={{ fontSize: 'clamp(22px, 1.45vw, 38px)', color: '#9fb0bb', fontWeight: 800 }}>Primary Cut Instructions</div>
                <div style={{ display: 'grid', gap: 'clamp(14px, 1.2vw, 30px)', gridTemplateColumns: `repeat(${Math.max(1, Math.min(detailCards.length, 3))}, minmax(0,1fr))` }}>
                  {detailCards.map((card) => (
                    <SummaryCard key={card.label} label={card.label} value={card.value} />
                  ))}
                </div>
              </div>
            ) : null}

            {(hind.length || front.length) ? (
              <div style={{ display: 'grid', gap: 'clamp(18px, 1.5vw, 36px)', gridTemplateColumns: 'repeat(2, minmax(0,1fr))' }}>
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
                <div style={{ fontSize: 'clamp(24px, 1.5vw, 42px)', color: '#fff3b0', marginBottom: 14, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 0 }}>
                  Notes
                </div>
                <div
                  style={{
                    fontSize: 'clamp(48px, 4vw, 102px)',
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

          <div style={{ display: 'grid', gap: 'clamp(18px, 1.5vw, 36px)', minHeight: 0 }}>
            <div style={{ ...CARD, display: 'grid', gap: 'clamp(16px, 1.2vw, 30px)' }}>
              <div style={{ fontSize: 'clamp(28px, 1.9vw, 50px)', color: '#9fb0bb', fontWeight: 900 }}>Watch For</div>

              {addOnItems.length ? (
                <div style={{ display: 'grid', gap: 'clamp(10px, .9vw, 22px)' }}>
                  <div style={{ fontSize: 'clamp(22px, 1.2vw, 34px)', color: '#9fb0bb', fontWeight: 900, textTransform: 'uppercase', letterSpacing: 0 }}>Add-Ons</div>
                  {addOnItems.map((item) => (
                    <div
                      key={item}
                      style={{
                        fontSize: 'clamp(34px, 2.6vw, 74px)',
                        fontWeight: 900,
                        lineHeight: 1.08,
                        padding: 'clamp(12px, 1vw, 24px) clamp(14px, 1.2vw, 30px)',
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
                  <div style={{ fontSize: 'clamp(22px, 1.2vw, 34px)', color: '#9fb0bb', fontWeight: 900, textTransform: 'uppercase', letterSpacing: 0 }}>Specialty</div>
                  <div
                    style={{
                      fontSize: 'clamp(46px, 3.8vw, 100px)',
                      fontWeight: 950,
                      lineHeight: 1.04,
                      padding: 'clamp(12px, 1vw, 24px) clamp(14px, 1.2vw, 30px)',
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
                <div style={{ display: 'grid', gap: 'clamp(10px, .9vw, 22px)' }}>
                  <div style={{ fontSize: 'clamp(22px, 1.2vw, 34px)', color: '#9fb0bb', fontWeight: 900, textTransform: 'uppercase', letterSpacing: 0 }}>Webbs</div>
                  <div
                    style={{
                      fontSize: 'clamp(46px, 3.8vw, 100px)',
                      fontWeight: 950,
                      lineHeight: 1.04,
                      padding: 'clamp(12px, 1vw, 24px) clamp(14px, 1.2vw, 30px)',
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
                <div style={{ fontSize: 'clamp(34px, 2.5vw, 72px)', fontWeight: 800, color: '#c7d4dd' }}>No extra items</div>
              ) : null}
            </div>
          </div>
        </div>

        <div
          style={{
            padding: 'clamp(14px, 1.4vh, 28px) clamp(28px, 3vw, 76px)',
            borderTop: '1px solid #1c2931',
            display: 'grid',
            gap: 'clamp(10px, 1vh, 22px)',
            pointerEvents: 'auto',
          }}
        >
          <div
            style={{
              fontSize: 'clamp(32px, 2.4vw, 70px)',
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
              gap: 'clamp(12px, 1vw, 28px)',
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
                width: 'clamp(320px, 24vw, 620px)',
                maxWidth: '70vw',
                padding: 'clamp(14px, 1vw, 28px) clamp(16px, 1.2vw, 32px)',
                borderRadius: 12,
                border: '1px solid #475569',
                background: '#f8fafc',
                color: '#0f172a',
                fontSize: 'clamp(26px, 1.8vw, 52px)',
                fontWeight: 800,
              }}
            />
            <button
              type="button"
              onClick={onManualSubmit}
              disabled={manualBusy || !manualTag.trim()}
              style={{
                padding: 'clamp(14px, 1vw, 28px) clamp(22px, 1.8vw, 48px)',
                borderRadius: 12,
                border: '1px solid #1f7a3f',
                background: manualBusy || !manualTag.trim() ? '#3b4a41' : '#2f7d42',
                color: '#f8fafc',
                fontSize: 'clamp(26px, 1.8vw, 52px)',
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
                padding: 'clamp(14px, 1vw, 28px) clamp(22px, 1.8vw, 48px)',
                borderRadius: 12,
                border: '1px solid #475569',
                background: 'rgba(248,250,252,.08)',
                color: '#f8fafc',
                fontSize: 'clamp(26px, 1.8vw, 52px)',
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
