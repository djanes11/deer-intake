'use client';

import React, { useEffect, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';

type AnyRec = Record<string, any>;

export type ThermalLabelType = 'deer' | 'antler' | 'cape';
export type ThermalLabelPrintMode = ThermalLabelType | 'deer-antler';
type RenderLabelType = Exclude<ThermalLabelType, 'cape'>;

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

function normalizeLabelType(type: ThermalLabelType): RenderLabelType {
  return type === 'cape' ? 'antler' : type;
}

export default function ThermalLabelSheet({
  job,
  type,
  brandingName,
  brandingLogoUrl,
}: {
  job?: AnyRec | null;
  type: ThermalLabelPrintMode;
  brandingName?: string;
  brandingLogoUrl?: string;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [logoFailed, setLogoFailed] = useState(false);
  const labelTypes: RenderLabelType[] =
    type === 'deer-antler' ? ['deer', 'antler'] : [normalizeLabelType(type)];
  const brand =
    String(brandingName || '').trim() ||
    value(job, ['brandingName', 'processorName', 'processor_name', 'publicName', 'public_name']) ||
    'Wild Game Butcher Board';
  const logoUrl =
    String(brandingLogoUrl || '').trim() ||
    value(job, ['brandingLogoUrl', 'processorLogoUrl', 'logoUrl', 'logo_url']) ||
    '/wgbb-logo.png';
  const customer = value(job, ['customer', 'Customer', 'customerName', 'customer_name', 'Customer Name', 'fullName', 'Full Name']) || 'Unknown Customer';
  const confirmation = value(job, ['confirmation', 'Confirmation #', 'Confirmation', 'confirmationNumber', 'confirmation_number', 'Confirmation Number']);
  const phone = value(job, ['phone', 'Phone', 'Phone #', 'Phone Number', 'phoneNumber', 'customerPhone', 'customer_phone', 'Customer Phone']);
  const tag = value(job, ['tag', 'Tag', 'tagId', 'tag_id', 'tagNumber', 'tag_number', 'Tag Number']);
  const shouldShowBarcode = !!tag;

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
        nodes.forEach((el) => {
          try {
            while (el.firstChild) el.removeChild(el.firstChild);
            JsBarcode(el, tag, {
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

    drawAll();
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

  const renderLabel = (labelType: RenderLabelType, index: number) => {
    const title = labelType === 'antler' ? 'Antler Tag' : 'Deer Tag';
    const footer =
      labelType === 'antler'
        ? 'Attach to antlers'
        : 'Main deer tag';
    const customerSizeClass =
      customer.length > 40
        ? 'thermalLabel__fieldValue--tiny'
        : customer.length > 30
        ? 'thermalLabel__fieldValue--small'
        : '';
    const fields = [
      { label: 'Customer', value: customer, className: `thermalLabel__field--customer ${customerSizeClass}`.trim() },
      { label: 'Conf', value: confirmation || '-' },
      { label: 'Tag', value: tag || '-' },
      { label: 'Phone', value: phone || '-' },
    ];

    return (
      <div key={`${labelType}-${index}`} className="thermalLabelRoot">
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
          <div className="thermalLabel__details">
            {fields.map((field) => (
              <div key={field.label} className={`thermalLabel__field ${field.className || ''}`}>
                <div className="thermalLabel__label">{field.label}</div>
                <div className="thermalLabel__fieldValue">{field.value}</div>
              </div>
            ))}
          </div>
          {shouldShowBarcode ? (
            <div className="thermalLabel__barcodeWrap">
              <svg data-barcode role="img" aria-label="Tag barcode" />
            </div>
          ) : (
            <div className="thermalLabel__secondary">
              <div className="thermalLabel__label">No Barcode</div>
              <div>{tag || 'Missing tag'}</div>
            </div>
          )}
        </div>
        <div className="thermalLabel__footer">{footer}</div>
      </div>
      </div>
    );
  };

  return (
    <div className={`thermalLabelPrintJob ${labelTypes.length > 1 ? 'thermalLabelPrintJob--batch' : ''}`} ref={rootRef}>
      {labelTypes.map(renderLabel)}

      <style jsx>{`
        .thermalLabelPrintJob {
          display: block;
          background: #fff;
        }

        .thermalLabelRoot + .thermalLabelRoot {
          margin-top: 0.08in;
        }

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
          grid-template-rows: 0.2in minmax(0, 1fr) 0.1in;
          gap: 0.014in;
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
          padding-bottom: 0.012in;
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
          max-width: 1.62in;
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
          grid-template-columns: minmax(0, 2.12in) minmax(0, 1.18in);
          gap: 0.045in;
          align-items: stretch;
          min-height: 0;
        }

        .thermalLabel__details {
          display: grid;
          grid-template-rows: minmax(0, 1.35fr) repeat(3, minmax(0, 1fr));
          gap: 0.012in;
          min-width: 0;
          min-height: 0;
        }

        .thermalLabel__field {
          display: grid;
          grid-template-columns: 0.42in minmax(0, 1fr);
          align-items: baseline;
          gap: 0.03in;
          min-width: 0;
          min-height: 0;
        }

        .thermalLabel__field--customer {
          align-items: start;
        }

        .thermalLabel__label {
          font-size: 6.2px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          line-height: 1;
          white-space: nowrap;
        }

        .thermalLabel__fieldValue {
          min-width: 0;
          font-size: 8.3px;
          font-weight: 800;
          line-height: 1.04;
          overflow-wrap: anywhere;
        }

        .thermalLabel__field--customer .thermalLabel__fieldValue {
          font-size: 8.8px;
          font-weight: 900;
          line-height: 1;
        }

        .thermalLabel__field--customer.thermalLabel__fieldValue--small .thermalLabel__fieldValue {
          font-size: 7.4px;
          line-height: 1;
        }

        .thermalLabel__field--customer.thermalLabel__fieldValue--tiny .thermalLabel__fieldValue {
          font-size: 6.4px;
          line-height: 1;
        }

        .thermalLabel__field:not(.thermalLabel__field--customer) .thermalLabel__fieldValue {
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
          padding-top: 0.012in;
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
          max-width: 1.18in;
          height: 0.42in;
          display: block;
        }

        @media print {
          @page {
            size: 3.5in 1.125in;
            margin: 0;
          }

          .thermalLabelPrintJob {
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
          }

          .thermalLabelRoot + .thermalLabelRoot {
            margin-top: 0 !important;
          }

          .thermalLabelRoot {
            padding: 0;
            min-height: auto;
            width: 3.5in !important;
            height: 1.125in !important;
            overflow: hidden !important;
            break-after: page !important;
            page-break-after: always !important;
          }

          .thermalLabelRoot:last-of-type {
            break-after: auto !important;
            page-break-after: auto !important;
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
