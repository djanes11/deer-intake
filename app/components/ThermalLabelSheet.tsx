'use client';

import React, { useEffect, useRef, useState } from 'react';

type AnyRec = Record<string, any>;

export type ThermalLabelType = 'deer' | 'antler' | 'cape' | 'package';

export function canPrintCapeLabel(job: AnyRec | null | undefined) {
  const processType = String(job?.processType || job?.['Process Type'] || '').trim().toLowerCase();
  return processType === 'caped' || processType === 'cape & donate';
}

export function canPrintAntlerLabel(job: AnyRec | null | undefined) {
  const sex = String(job?.sex || job?.Sex || job?.['Deer Sex'] || '').trim().toLowerCase();
  return sex === 'buck' || canPrintCapeLabel(job);
}

function value(job: AnyRec | null | undefined, keys: string[]) {
  for (const key of keys) {
    const v = job?.[key];
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
}

export default function ThermalLabelSheet({
  job,
  type,
  brandingName,
  brandingLogoUrl,
}: {
  job?: AnyRec | null;
  type: ThermalLabelType;
  brandingName?: string;
  brandingLogoUrl?: string;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [logoFailed, setLogoFailed] = useState(false);
  const labelType = type === 'cape' ? 'antler' : type;
  const brand = brandingName || 'Wild Game Butcher Board';
  const logoUrl =
    String(brandingLogoUrl || '').trim() ||
    value(job, ['brandingLogoUrl', 'processorLogoUrl', 'logoUrl', 'logo_url']) ||
    '/wgbb-logo.png';
  const customer = value(job, ['customer', 'Customer', 'customer_name', 'Customer Name']) || 'Unknown Customer';
  const confirmation = value(job, ['confirmation', 'Confirmation #', 'Confirmation', 'confirmationNumber']);
  const phone = value(job, ['phone', 'Phone', 'Phone Number', 'phoneNumber']);
  const tag = value(job, ['tag', 'Tag', 'tag_id', 'tagId']);
  const processType = value(job, ['processType', 'Process Type', 'process_type']);
  const sex = value(job, ['sex', 'Sex', 'Deer Sex']);
  const shouldShowBarcode = !!tag;

  const title =
    labelType === 'antler' ? 'Antler Tag' : labelType === 'package' ? 'Package Label' : 'Deer Tag';
  const footer =
    labelType === 'antler'
      ? 'Attach to antlers'
      : labelType === 'package'
      ? 'Finished package'
      : 'Main deer tag';
  const primaryLabel = labelType === 'package' ? 'Customer' : 'Tag';
  const primaryValue = labelType === 'package' ? customer : tag || '-';
  const metadata = [
    labelType === 'package' ? (tag ? `Tag ${tag}` : null) : customer,
    confirmation ? `Conf ${confirmation}` : null,
    labelType === 'antler' && sex ? sex : null,
    labelType !== 'package' && processType ? processType : null,
    labelType === 'deer' && phone ? phone : null,
  ].filter(Boolean).join(' | ');

  useEffect(() => {
    setLogoFailed(false);
  }, [logoUrl]);

  useEffect(() => {
    const container = rootRef.current;
    if (!container || !shouldShowBarcode || !tag) return;
    const nodes = Array.from(container.querySelectorAll('svg[data-barcode]')) as SVGSVGElement[];
    if (!nodes.length) return;

    const drawAll = () => {
      try {
        const JB = typeof window !== 'undefined' ? (window as any).JsBarcode : null;
        if (!JB) return;
        nodes.forEach((el) => {
          try {
            while (el.firstChild) el.removeChild(el.firstChild);
            JB(el, tag, {
              format: 'CODE128',
              lineColor: '#111',
              width: 1.05,
              height: 30,
              displayValue: false,
              font: 'monospace',
              margin: 0,
            });
          } catch {}
        });
      } catch {}
    };

    const ensureLib = () => {
      if (typeof window !== 'undefined' && (window as any).JsBarcode) {
        drawAll();
        return;
      }
      if (typeof document !== 'undefined') {
        const existing = document.querySelector('script[data-jsbarcode="1"]') as HTMLScriptElement | null;
        if (existing) {
          existing.addEventListener('load', drawAll, { once: true });
          return;
        }
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js';
        s.dataset.jsbarcode = '1';
        s.onload = drawAll;
        document.head.appendChild(s);
      }
    };

    ensureLib();
    const t1 = setTimeout(drawAll, 60);
    const t2 = setTimeout(drawAll, 220);
    const onBeforePrint = () => setTimeout(drawAll, 0);
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeprint', onBeforePrint);
    }

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      if (typeof window !== 'undefined') {
        window.removeEventListener('beforeprint', onBeforePrint);
      }
    };
  }, [shouldShowBarcode, tag]);

  return (
    <div className="thermalLabelRoot" ref={rootRef}>
      <div className={`thermalLabel thermalLabel--${labelType}`}>
        <div className="thermalLabel__top">
          <div className="thermalLabel__brandWrap">
            {!logoFailed && logoUrl ? (
              <img src={logoUrl} alt="" className="thermalLabel__logo" onError={() => setLogoFailed(true)} />
            ) : (
              <div className="thermalLabel__logoFallback">{brand.slice(0, 2).toUpperCase()}</div>
            )}
            <div className="thermalLabel__brand">{brand}</div>
          </div>
          <div className="thermalLabel__type">{title}</div>
        </div>
        <div className="thermalLabel__body">
          <div className="thermalLabel__primary">
            <div className="thermalLabel__label">{primaryLabel}</div>
            <div className="thermalLabel__value">{primaryValue}</div>
            <div className="thermalLabel__meta">{metadata || '-'}</div>
          </div>
          {shouldShowBarcode ? (
            <div className="thermalLabel__barcodeWrap">
              <svg data-barcode role="img" aria-label="Tag barcode" />
            </div>
          ) : (
            <div className="thermalLabel__secondary">
              <div className="thermalLabel__label">Confirmation</div>
              <div>{confirmation || '-'}</div>
            </div>
          )}
        </div>
        <div className="thermalLabel__footer">{footer}</div>
      </div>

      <style jsx>{`
        .thermalLabelRoot {
          display: block;
          width: 3.5in;
          height: 1.125in;
          background: #fff;
          padding: 0;
          box-sizing: border-box;
          page: thermal-label;
        }

        .thermalLabel {
          width: 3.5in;
          height: 1.125in;
          border: 1px solid #111;
          background: #fff;
          color: #111;
          box-sizing: border-box;
          padding: 0.035in 0.045in;
          display: grid;
          grid-template-rows: 0.22in minmax(0, 1fr) 0.13in;
          gap: 0.018in;
          font-family: Arial, Helvetica, sans-serif;
          overflow: hidden;
        }

        .thermalLabel--antler {
          border-width: 1.5px;
        }

        .thermalLabel__top {
          display: flex;
          min-width: 0;
          justify-content: space-between;
          align-items: center;
          gap: 0.05in;
          border-bottom: 1px solid #111;
          padding-bottom: 0.018in;
        }

        .thermalLabel__brandWrap {
          display: flex;
          align-items: center;
          gap: 0.035in;
          min-width: 0;
        }

        .thermalLabel__logo {
          width: 0.18in;
          height: 0.18in;
          display: block;
          object-fit: contain;
          flex: 0 0 auto;
        }

        .thermalLabel__logoFallback {
          width: 0.18in;
          height: 0.18in;
          display: grid;
          place-items: center;
          flex: 0 0 auto;
          border: 1px solid #111;
          font-size: 6px;
          font-weight: 900;
          line-height: 1;
        }

        .thermalLabel__brand {
          min-width: 0;
          max-width: 1.55in;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 6.8px;
          font-weight: 800;
          letter-spacing: 0.025em;
          text-transform: uppercase;
          line-height: 1;
        }

        .thermalLabel__type {
          flex: 0 0 auto;
          font-size: 8px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          line-height: 1;
        }

        .thermalLabel__body {
          display: grid;
          grid-template-columns: minmax(0, 1.08in) minmax(0, 1fr);
          gap: 0.045in;
          align-items: center;
          min-height: 0;
        }

        .thermalLabel__primary {
          display: grid;
          gap: 0.01in;
          min-width: 0;
        }

        .thermalLabel__label {
          font-size: 6.2px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          line-height: 1;
        }

        .thermalLabel__value {
          min-width: 0;
          font-size: 19px;
          font-weight: 900;
          line-height: 0.95;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .thermalLabel--package .thermalLabel__value {
          font-size: 14px;
          line-height: 1;
        }

        .thermalLabel__meta {
          min-width: 0;
          font-size: 6.4px;
          font-weight: 700;
          line-height: 1.05;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .thermalLabel__secondary {
          font-size: 8px;
          font-weight: 800;
          line-height: 1.05;
        }

        .thermalLabel__footer {
          border-top: 1px solid #111;
          padding-top: 0.018in;
          font-size: 6.2px;
          font-weight: 700;
          letter-spacing: 0.03em;
          text-transform: uppercase;
          line-height: 1;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .thermalLabel__barcodeWrap {
          min-width: 0;
          display: flex;
          justify-content: center;
          align-items: center;
          overflow: hidden;
        }

        .thermalLabel__barcodeWrap :global(svg) {
          width: 100%;
          max-width: 2.18in;
          height: 0.42in;
          display: block;
        }

        @media print {
          @page {
            size: 3.5in 1.125in;
            margin: 0;
          }

          .thermalLabelRoot {
            padding: 0;
            min-height: auto;
            width: 3.5in !important;
            height: 1.125in !important;
            overflow: hidden !important;
          }

          .thermalLabel {
            width: 3.5in !important;
            height: 1.125in !important;
            border-width: 1px;
            box-shadow: none !important;
          }
        }
      `}</style>
    </div>
  );
}
