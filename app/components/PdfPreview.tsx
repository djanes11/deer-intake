// app/components/PdfPreview.tsx
'use client';

import { useEffect, useState } from 'react';

type Props = {
  /** Base URL to the PDF (e.g. /api/stateform/render?dry=1) */
  src: string;
  /** Bump this to force reload (cache-bust) */
  refreshKey?: number;
  /** Extra tailwind classes for sizing (height/width) */
  className?: string;
};

export default function PdfPreview({ src, refreshKey = 0, className }: Props) {
  // Keep a stable initial value for SSR, then cache-bust on the client
  const [url, setUrl] = useState(src);
  useEffect(() => {
    setUrl(`${src}${src.includes('?') ? '&' : '?'}_=${Date.now()}-${refreshKey}`);
  }, [src, refreshKey]);

  return (
    <object data={url} type="application/pdf" className={className}>
      <div className="p-4 text-sm">
        PDF preview not supported.{' '}
        <a className="underline" href={url} target="_blank" rel="noreferrer">
          Open in new tab
        </a>
        .
      </div>
    </object>
  );
}
