import 'server-only';

import { headers } from 'next/headers';
import { requireStaffAccess } from '@/lib/staffAuth';
import { getStaffProcessorContext, isPlatformAdmin, type StaffProcessorContext } from '@/lib/staffContext';
import { hasProcessorPermission, type ProcessorPermission } from '@/lib/staffPermissions';

type ReportAccessResult =
  | { ok: true; processor: StaffProcessorContext; platformAdmin: boolean }
  | { ok: false; status: number; error: string };

async function currentRequest() {
  const h = await headers();
  return new Request('https://staff.local/reports', { headers: new Headers(h) });
}

export async function requireReportAccess(permission: ProcessorPermission = 'view'): Promise<ReportAccessResult> {
  const req = await currentRequest();
  const auth = await requireStaffAccess(req);
  if (!auth.ok) {
    return { ok: false, status: auth.status, error: auth.error };
  }

  const [processor, platformAdmin] = await Promise.all([
    getStaffProcessorContext(req),
    isPlatformAdmin(req),
  ]);

  if (!platformAdmin && !processor.role) {
    return { ok: false, status: 403, error: 'Staff access is required for this report.' };
  }

  if (!platformAdmin && !hasProcessorPermission(processor, permission)) {
    return {
      ok: false,
      status: 403,
      error: `You do not have permission to ${permission.replace(/_/g, ' ')}.`,
    };
  }

  return { ok: true, processor, platformAdmin };
}

export function ReportAccessDenied({ title, error }: { title: string; error: string }) {
  return (
    <main className="app-frame">
      <div className="card" style={{ padding: 18, display: 'grid', gap: 8 }}>
        <h1 style={{ margin: 0 }}>{title}</h1>
        <div style={{ color: '#475569' }}>{error}</div>
      </div>
    </main>
  );
}
