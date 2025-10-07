// app/components/ButcherOverlay.tsx — dumb view, tolerant key lookup, big type
'use client';

type Row = Record<string, any>;
export default function ButcherOverlay({ job, visible }: { job?: Row | null; visible: boolean }) {
  const row = job || {};

  // tolerant getters (space/no-space/camel)
  const key = (s: string) => s.toLowerCase().replace(/\s+/g, '');
  function get(...names: string[]) {
    for (const n of names) {
      const k = key(n);
      const hit = Object.keys(row).find(rk => key(rk) === k);
      if (hit) return row[hit];
    }
    return '';
  }
  const isOn = (v: any) => {
    if (typeof v === 'boolean') return v;
    const s = String(v ?? '').trim().toLowerCase();
    if (!s || ['0','false','no','off','none','n/a','na'].includes(s)) return false;
    if (['true','yes','y','x','1','✓','✔','on'].includes(s)) return true;
    const n = Number(s); return Number.isFinite(n) ? n > 0 : !!s;
  };
  const join = (...labels: string[]) => labels.filter(Boolean).join(' / ');

  // header
  const tag  = String(get('Tag') ?? '').trim();
  const cust = String(get('Customer','Customer Name','CustomerName','customerName','name','customer') ?? '').trim();

  // toggles
  const hind  = join(
    isOn(get('Hind - Steak','hindSteak')) ? 'Steak' : '',
    isOn(get('Hind - Roast','hindRoast')) ? 'Roast' : '',
    isOn(get('Hind - Grind','hindGrind')) ? 'Grind' : '',
    isOn(get('Hind - None','hindNone'))   ? 'None'  : ''
  );
  const front = join(
    isOn(get('Front - Steak','frontSteak')) ? 'Steak' : '',
    isOn(get('Front - Roast','frontRoast')) ? 'Roast' : '',
    isOn(get('Front - Grind','frontGrind')) ? 'Grind' : '',
    isOn(get('Front - None','frontNone'))   ? 'None'  : ''
  );

  // sizes / counts
  const steakSize      = String(get('Steak','Steak Size','steak') ?? '');
  const steakSizeOther = String(get('Steak Size (Other)','steakSizeOther','steakOther') ?? '');
  const steaksPerPack  = String(get('Steaks per Package','Steaks Per Package','steaksPerPackage') ?? '');
  const burgerSize     = String(get('Burger Size','burgerSize') ?? '');

  const bsPrep         = String(get('Backstrap Prep','backstrapPrep') ?? '');
  const bsThick        = String(get('Backstrap Thickness','backstrapThickness') ?? '');
  const bsThickOther   = String(get('Backstrap Thickness (Other)','backstrapThicknessOther') ?? '');

  // specialty / webbs
  const specialtyFlag  = get('Specialty Products','specialtyProducts');
  const specialtyLbs   = String(get('Specialty Pounds','specialtyPounds') ?? '');
  const showSpecialty  = isOn(specialtyFlag) || Number(specialtyLbs) > 0;

  const webbsFlag      = get('Webbs Order','webbsOrder');
  const webbsForm      = get('Webbs Order Form Number','webbsFormNumber');
  const webbsLbs       = String(get('Webbs Pounds','webbsPounds') ?? '');
  const showWebbs      = isOn(webbsFlag) || isOn(webbsForm) || Number(webbsLbs) > 0;

  const Cell = ({ label, value }: { label: string; value: string }) => (
    <div style={{ border:'1px solid #2a2f36', borderRadius:16, padding:'14px 16px' }}>
      <div style={{ fontSize:16, color:'#aab4be', marginBottom:8 }}>{label}</div>
      <div style={{ fontSize:30, fontWeight:800, lineHeight:1.2, whiteSpace:'pre-wrap', wordBreak:'break-word' }}>
        {value?.toString().trim() || '—'}
      </div>
    </div>
  );

  return (
    <div
      aria-hidden={!visible}
      style={{
        position:'fixed', inset:0, zIndex:1000,
        background:'rgba(8,11,15,.75)',
        display: visible ? 'flex' : 'none',
        alignItems:'center', justifyContent:'center',
        pointerEvents:'none', userSelect:'none'
      }}
    >
      <div style={{
        width:'min(1280px, 96vw)', maxHeight:'92vh', overflow:'hidden auto',
        borderRadius:22, background:'#0b0f12', color:'#e7ecf0',
        border:'1px solid #2a2f36', boxShadow:'0 12px 40px rgba(0,0,0,.35)',
        pointerEvents:'none'
      }}>
        <div style={{
          padding:'18px 22px', borderBottom:'1px solid #1c2228',
          display:'flex', justifyContent:'space-between', alignItems:'baseline', gap:16
        }}>
          <div style={{ fontSize:26, fontWeight:900 }}>Cut Specs</div>
          <div style={{ display:'flex', gap:24, alignItems:'baseline' }}>
            {tag  ? <span style={{ fontSize:42, fontWeight:900 }}>Tag #{tag}</span> : null}
            {cust ? <span style={{ fontSize:36, fontWeight:800, opacity:.95 }}>{cust}</span> : null}
          </div>
        </div>

        <div style={{ display:'grid', gap:16, padding:22, gridTemplateColumns:'repeat(3, minmax(0,1fr))' }}>
          <Cell label="Hind Quarter" value={hind} />
          <Cell label="Front Shoulder" value={front} />
          <Cell label="Steak Size" value={steakSize} />
          <Cell label="Steak Size (Other)" value={steakSizeOther} />
          <Cell label="Steaks per Package" value={steaksPerPack} />
          <Cell label="Burger Size" value={burgerSize} />
          <Cell label="Backstrap Prep" value={bsPrep} />
          <Cell label="Backstrap Thickness" value={bsThick} />
          <Cell label="Backstrap Thickness (Other)" value={bsThickOther} />
          {showSpecialty ? <Cell label="Specialty Total (lb)" value={specialtyLbs} /> : null}
          {showWebbs      ? <Cell label="Webbs Total (lb)" value={webbsLbs} />         : null}
        </div>

        <div style={{ padding:'10px 22px', borderTop:'1px solid #1c2228', fontSize:14, color:'#aab4be' }}>
          Overlay stays up during Processing. Scan again to finish—no clicks needed.
        </div>
      </div>
    </div>
  );
}
