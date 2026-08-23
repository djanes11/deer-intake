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
            const isAntlerBarcode = !!el.closest('.thermalLabel--antler');
            JsBarcode(el, tag, {
              format: 'CODE128',
              lineColor: '#111',
              width: isAntlerBarcode ? 1.45 : 2.3,
              height: isAntlerBarcode ? 84 : 96,
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

    if (labelType === 'antler') {
      const antlerFields = [
        { label: 'Customer', value: customer, className: `thermalLabel__antlerField--customer ${customerSizeClass}`.trim() },
        { label: 'Conf', value: confirmation || '-' },
        { label: 'Tag', value: tag || '-' },
        { label: 'Phone', value: phone || '-' },
      ];

      return (
        <div key={`${labelType}-${index}`} className="thermalLabelRoot thermalLabelRoot--antler">
          <div className="thermalLabel thermalLabel--antler">
            <div className="thermalLabel__antlerInfo">
              <div className="thermalLabel__antlerBrandRow">
                {!logoFailed && logoUrl ? (
                  <img src={logoUrl} alt="" className="thermalLabel__logo" onError={() => setLogoFailed(true)} />
                ) : (
                  <div className="thermalLabel__logoFallback">{brand.slice(0, 2).toUpperCase()}</div>
                )}
                <div className="thermalLabel__brand">{brand}</div>
              </div>
              <div className="thermalLabel__antlerTitle">Antler Tag</div>
              <div className="thermalLabel__antlerFields">
                {antlerFields.map((field) => (
                  <div key={field.label} className={`thermalLabel__antlerField ${field.className || ''}`}>
                    <div className="thermalLabel__antlerLabel">{field.label}</div>
                    <div className="thermalLabel__antlerValue">{field.value}</div>
                  </div>
                ))}
              </div>
              <div className="thermalLabel__antlerFooter">Keep with deer</div>
            </div>
            <div className="thermalLabel__cutLine"><span>Cut off barcode</span></div>
            {shouldShowBarcode ? (
              <div className="thermalLabel__barcodeWrap thermalLabel__barcodeWrap--antler">
                <svg data-barcode role="img" aria-label="Tag barcode" />
              </div>
            ) : (
              <div className="thermalLabel__secondary thermalLabel__secondary--antler">
                <div className="thermalLabel__label">No Barcode</div>
                <div>{tag || 'Missing tag'}</div>
              </div>
            )}
          </div>
        </div>
      );
    }

    return (
      <div key={`${labelType}-${index}`} className={`thermalLabelRoot thermalLabelRoot--${labelType}`}>
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
          width: 4in;
          height: 2.3125in;
          background: #fff;
          padding: 0;
          box-sizing: border-box;
          page: thermal-label;
        }

        .thermalLabel {
          width: 4in;
          height: 2.3125in;
          border: 1px solid #111;
          background: #fff;
          color: #111;
          box-sizing: border-box;
          padding: 0.075in 0.085in;
          display: grid;
          grid-template-rows: 0.31in minmax(0, 0.67in) minmax(0, 0.92in) 0.13in;
          gap: 0.035in;
          font-family: Arial, Helvetica, sans-serif;
          overflow: hidden;
        }

        .thermalLabel--antler {
          border-width: 1.5px;
          width: 2.3125in;
          height: 4in;
          padding: 0.08in;
          grid-template-rows: minmax(0, 1fr) 0.18in 0.72in;
          gap: 0.045in;
        }

        .thermalLabelRoot--antler {
          width: 2.3125in;
          height: 4in;
          page: thermal-label-antler;
        }

        .thermalLabel__antlerInfo {
          display: grid;
          grid-template-rows: 0.34in 0.28in minmax(0, 1fr) 0.16in;
          gap: 0.055in;
          min-height: 0;
          overflow: hidden;
        }

        .thermalLabel__antlerBrandRow {
          display: flex;
          align-items: center;
          gap: 0.055in;
          min-width: 0;
          border-bottom: 2px solid #111;
          padding-bottom: 0.035in;
        }

        .thermalLabel--antler .thermalLabel__brand {
          max-width: 1.8in;
          font-size: 8.8px;
        }

        .thermalLabel__antlerTitle {
          font-size: 21px;
          font-weight: 950;
          line-height: 0.95;
          text-transform: uppercase;
          letter-spacing: 0;
        }

        .thermalLabel__antlerFields {
          display: grid;
          grid-template-rows: minmax(0, 0.62in) repeat(3, minmax(0, 0.36in));
          gap: 0.055in;
          min-height: 0;
        }

        .thermalLabel__antlerField {
          min-width: 0;
          min-height: 0;
          display: grid;
          align-content: start;
          gap: 0.012in;
          border-bottom: 1px solid #111;
          padding-bottom: 0.025in;
        }

        .thermalLabel__antlerLabel {
          font-size: 9.2px;
          font-weight: 900;
          line-height: 1;
          text-transform: uppercase;
          letter-spacing: 0;
        }

        .thermalLabel__antlerValue {
          min-width: 0;
          font-size: 17px;
          font-weight: 900;
          line-height: 1.05;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .thermalLabel__antlerField--customer .thermalLabel__antlerValue {
          font-size: 20px;
          line-height: 1.02;
          white-space: normal;
          overflow-wrap: anywhere;
          max-height: 0.43in;
          overflow: hidden;
        }

        .thermalLabel__antlerField--customer.thermalLabel__fieldValue--small .thermalLabel__antlerValue {
          font-size: 17px;
        }

        .thermalLabel__antlerField--customer.thermalLabel__fieldValue--tiny .thermalLabel__antlerValue {
          font-size: 14px;
        }

        .thermalLabel__antlerFooter {
          font-size: 9.5px;
          font-weight: 900;
          line-height: 1;
          text-transform: uppercase;
          border-top: 2px solid #111;
          padding-top: 0.035in;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .thermalLabel__cutLine {
          display: flex;
          align-items: center;
          justify-content: center;
          border-top: 2px dotted #111;
          color: #111;
          font-size: 7.8px;
          font-weight: 900;
          line-height: 1;
          text-transform: uppercase;
          letter-spacing: 0;
          min-height: 0;
        }

        .thermalLabel__cutLine span {
          display: inline-block;
          background: #fff;
          padding: 0 0.04in;
          transform: translateY(-0.01in);
        }

        .thermalLabel__barcodeWrap--antler,
        .thermalLabel__secondary--antler {
          padding: 0.035in;
        }

        .thermalLabel__barcodeWrap--antler :global(svg) {
          max-width: 2.05in;
          height: 0.58in;
        }

        .thermalLabel__top {
          display: flex;
          min-width: 0;
          justify-content: space-between;
          align-items: center;
          gap: 0.08in;
          border-bottom: 2px solid #111;
          padding-bottom: 0.026in;
        }

        .thermalLabel__brandWrap {
          display: flex;
          align-items: center;
          gap: 0.06in;
          min-width: 0;
        }

        .thermalLabel__logo {
          width: 0.26in;
          height: 0.26in;
          display: block;
          object-fit: contain;
          flex: 0 0 auto;
        }

        .thermalLabel__logoFallback {
          width: 0.26in;
          height: 0.26in;
          display: grid;
          place-items: center;
          flex: 0 0 auto;
          border: 1px solid #111;
          font-size: 8px;
          font-weight: 900;
          line-height: 1;
        }

        .thermalLabel__brand {
          min-width: 0;
          max-width: 2.45in;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 9.8px;
          font-weight: 800;
          letter-spacing: 0;
          text-transform: uppercase;
          line-height: 1;
        }

        .thermalLabel__type {
          flex: 0 0 auto;
          font-size: 12px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0;
          line-height: 1;
        }

        .thermalLabel__body {
          display: block;
          min-height: 0;
        }

        .thermalLabel__details {
          display: grid;
          grid-template-columns: 1.25fr 0.95fr;
          gap: 0.035in 0.12in;
          min-width: 0;
          min-height: 0;
        }

        .thermalLabel__field {
          display: grid;
          grid-template-columns: 0.52in minmax(0, 1fr);
          align-items: baseline;
          gap: 0.045in;
          min-width: 0;
          min-height: 0;
        }

        .thermalLabel__field--customer {
          grid-column: 1 / -1;
          align-items: start;
          grid-template-columns: 0.74in minmax(0, 1fr);
        }

        .thermalLabel__label {
          font-size: 8.6px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0;
          line-height: 1;
          white-space: nowrap;
        }

        .thermalLabel__fieldValue {
          min-width: 0;
          font-size: 14.6px;
          font-weight: 800;
          line-height: 1.04;
          overflow-wrap: anywhere;
        }

        .thermalLabel__field--customer .thermalLabel__fieldValue {
          font-size: 19px;
          font-weight: 900;
          line-height: 1;
        }

        .thermalLabel__field--customer.thermalLabel__fieldValue--small .thermalLabel__fieldValue {
          font-size: 16px;
          line-height: 1;
        }

        .thermalLabel__field--customer.thermalLabel__fieldValue--tiny .thermalLabel__fieldValue {
          font-size: 13.4px;
          line-height: 1;
        }

        .thermalLabel__field:not(.thermalLabel__field--customer) .thermalLabel__fieldValue {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .thermalLabel__secondary {
          display: grid;
          align-content: center;
          font-size: 17px;
          font-weight: 800;
          line-height: 1.1;
        }

        .thermalLabel__footer {
          border-top: 2px solid #111;
          padding-top: 0.028in;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0;
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
          border: 2px solid #111;
          padding: 0.035in 0.04in;
          background: #fff;
        }

        .thermalLabel__barcodeWrap :global(svg) {
          width: 100%;
          max-width: 3.72in;
          height: 0.86in;
          display: block;
        }

        @media print {
          @page {
            size: 4in 2.3125in;
            margin: 0;
          }

          @page thermal-label {
            size: 4in 2.3125in;
            margin: 0;
          }

          @page thermal-label-antler {
            size: 2.3125in 4in;
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
            width: 4in !important;
            height: 2.3125in !important;
            overflow: hidden !important;
            break-after: page !important;
            page-break-after: always !important;
          }

          .thermalLabelRoot--antler {
            width: 2.3125in !important;
            height: 4in !important;
            page: thermal-label-antler;
          }

          .thermalLabelRoot:last-of-type {
            break-after: auto !important;
            page-break-after: auto !important;
          }

          .thermalLabel {
            width: 4in !important;
            height: 2.3125in !important;
            border-width: 1px;
            box-shadow: none !important;
          }

          .thermalLabel--antler {
            width: 2.3125in !important;
            height: 4in !important;
            border-width: 1px;
          }
        }
      `}</style>
    </div>
  );
}
