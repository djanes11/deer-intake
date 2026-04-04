'use client';

import React from 'react';

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
  const brand = brandingName || 'Wild Game Butcher Board';
  const customer = value(job, ['customer', 'Customer', 'customer_name', 'Customer Name']) || 'Unknown Customer';
  const confirmation = value(job, ['confirmation', 'Confirmation #', 'Confirmation', 'confirmationNumber']);
  const phone = value(job, ['phone', 'Phone', 'Phone Number', 'phoneNumber']);
  const tag = value(job, ['tag', 'Tag', 'tag_id', 'tagId']);

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

  return (
    <div className="thermalLabelRoot">
      <div className={`thermalLabel thermalLabel--${type}`}>
        <div className="thermalLabel__top">
          <div className="thermalLabel__brandWrap">
            <img src="/wgbb-logo.svg" alt="" className="thermalLabel__logo" />
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
          width: 0.34in;
          height: 0.34in;
          display: block;
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
