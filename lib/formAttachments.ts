// lib/formAttachment.ts
import 'server-only';

type AnyRec = Record<string, any>;

const esc = (s: any) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

export function renderFormHTML(job: AnyRec & { tag?: string }) {
  const rows: [string, any][] = [
    ['Tag', job.tag],
    ['Customer', job.customer ?? job['Customer Name']],
    ['Phone', job.phone],
    ['Email', job.email],
    ['Address', [job.address, job.city, job.state, job.zip].filter(Boolean).join(', ')],
    ['Drop-off', job.dropoff],
    ['Status', job.status],
    ['Process Type', job.processType],
    ['Beef Fat', job.beefFat ? 'Yes' : 'No'],
    ['Webbs Order', job.webbsOrder ? 'Yes' : 'No'],
  ];

  return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8" />
<title>Deer Intake — ${esc(job.tag)}</title>
<style>
  @media print { body { -webkit-print-color-adjust: exact; } }
  body { font-family: Arial, sans-serif; margin: 16px; }
  h1 { margin: 0 0 8px; font-size: 20px; }
  .sub { color:#555; margin: 0 0 16px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #d1d5db; padding: 6px 8px; font-size: 12px; text-align: left; }
  th { width: 180px; background: #f8fafc; }
</style>
</head>
<body>
  <h1>Deer Intake</h1>
  <div class="sub">Tag ${esc(job.tag || '')}</div>
  <table>
    ${rows.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}
  </table>
</body></html>`;
}
