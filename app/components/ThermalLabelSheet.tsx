'use client';

import React, { useEffect, useRef } from 'react';

type AnyRec = Record<string, any>;

export type ThermalLabelType = 'deer' | 'cape' | 'package';

export function canPrintCapeLabel(job: AnyRec | null | undefined) {
  const processType = String(job?.processType || job?.['Process Type'] || '').trim().toLowerCase();
  return processType === 'caped' || processType === 'cape & donate';
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
}: {
  job?: AnyRec | null;
  type: ThermalLabelType;
  brandingName?: string;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const brand = brandingName || 'Wild Game Butcher Board';
  const customer = value(job, ['customer', 'Customer', 'customer_name', 'Customer Name']) || 'Unknown Customer';
  const confirmation = value(job, ['confirmation', 'Confirmation #', 'Confirmation', 'confirmationNumber']);
  const phone = value(job, ['phone', 'Phone', 'Phone Number', 'phoneNumber']);
  const tag = value(job, ['tag', 'Tag', 'tag_id', 'tagId']);
  const shouldShowBarcode = (type === 'deer' || type === 'cape') && !!tag;

  const title =
    type === 'cape' ? 'Cape Transport Label' : type === 'package' ? 'Package Label' : 'Deer Tag Label';
  const footer =
    type === 'cape'
      ? 'Attach to antler for cape transport'
      : type === 'package'
      ? 'Apply to finished package'
      : 'Place inside the deer with the meat';

  const lines =
    type === 'cape'
      ? [
          { label: 'Customer', value: customer, large: true },
          { label: 'Tag', value: tag || '-', large: true },
          { label: 'Confirmation', value: confirmation || '-', large: true },
          { label: 'Phone', value: phone || '-', large: false },
        ]
      : type === 'package'
      ? [
          { label: 'Customer', value: customer, large: true },
          { label: 'Confirmation', value: confirmation || '-', large: true },
        ]
      : [
          { label: 'Customer', value: customer, large: true },
          { label: 'Tag', value: tag || '-', large: true },
          { label: 'Confirmation', value: confirmation || '-', large: false },
        ];

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
              width: 1.3,
              height: 26,
              displayValue: true,
              font: 'monospace',
              fontSize: 11,
              textMargin: 2,
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
      <div className={`thermalLabel thermalLabel--${type}`}>
        <div className="thermalLabel__top">
          <div className="thermalLabel__brandWrap">
            <img src="/wgbb-logo.png" alt="" className="thermalLabel__logo" />
            <div className="thermalLabel__brand">{brand}</div>
          </div>
          <div className="thermalLabel__type">{title}</div>
        </div>
        <div className="thermalLabel__body">
          {lines.map((line) => (
            <div key={line.label} className="thermalLabel__row">
              <div className="thermalLabel__label">{line.label}</div>
              <div className={`thermalLabel__value ${line.large ? 'isLarge' : ''}`}>{line.value}</div>
            </div>
          ))}
          {shouldShowBarcode ? (
            <div className="thermalLabel__barcodeWrap">
              <svg data-barcode role="img" aria-label="Tag barcode" />
            </div>
          ) : null}
        </div>
        <div className="thermalLabel__footer">{footer}</div>
      </div>

      <style jsx>{`
        .thermalLabelRoot {
          display: grid;
          place-items: center;
          min-height: 100vh;
          background: #fff;
          padding: 0.1in;
          box-sizing: border-box;
        }

        .thermalLabel {
          width: 4in;
          min-height: 2.35in;
          border: 2px solid #111;
          background: #fff;
          color: #111;
          box-sizing: border-box;
          padding: 0.12in 0.16in;
          display: grid;
          gap: 0.06in;
          font-family: Arial, Helvetica, sans-serif;
        }

        .thermalLabel--cape {
          min-height: 2.55in;
        }

        .thermalLabel__top {
          display: grid;
          gap: 0.05in;
          border-bottom: 2px solid #111;
          padding-bottom: 0.06in;
        }

        .thermalLabel__brandWrap {
          display: flex;
          align-items: center;
          gap: 0.1in;
        }

        .thermalLabel__logo {
          width: 0.42in;
          height: 0.42in;
          display: block;
          object-fit: contain;
        }

        .thermalLabel__brand {
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .thermalLabel__type {
          font-size: 17px;
          font-weight: 900;
        }

        .thermalLabel__body {
          display: grid;
          gap: 0.06in;
        }

        .thermalLabel__row {
          display: grid;
          gap: 1px;
        }

        .thermalLabel__label {
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .thermalLabel__value {
          font-size: 15px;
          font-weight: 700;
          line-height: 1.1;
          overflow-wrap: anywhere;
        }

        .thermalLabel__value.isLarge {
          font-size: 23px;
          font-weight: 900;
        }

        .thermalLabel__footer {
          border-top: 1px solid #111;
          padding-top: 0.05in;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.03em;
          text-transform: uppercase;
        }

        .thermalLabel__barcodeWrap {
          border-top: 1px solid #111;
          padding-top: 0.07in;
          margin-top: 0.02in;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 0.54in;
        }

        .thermalLabel__barcodeWrap :global(svg) {
          width: 100%;
          max-width: 3.5in;
          height: 0.56in;
          display: block;
        }

        @media print {
          @page {
            margin: 0.08in;
          }

          .thermalLabelRoot {
            padding: 0;
            min-height: auto;
          }

          .thermalLabel {
            border-width: 1.5px;
          }
        }
      `}</style>
    </div>
  );
}
