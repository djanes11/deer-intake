import 'server-only';

import { NextResponse } from 'next/server';
import { requireStaffAccess } from '@/lib/staffAuth';
import { getStaffProcessorContext, isPlatformAdmin, type StaffProcessorContext } from '@/lib/staffContext';

export type ProcessorPermission =
  | 'view'
  | 'print'
  | 'edit_jobs'
  | 'update_status'
  | 'manage_settings'
  | 'manage_team'
  | 'manage_notifications';

export function hasProcessorPermission(
  context: Pick<StaffProcessorContext, 'role' | 'authType'>,
  permission: ProcessorPermission
) {
  switch (permission) {
    case 'view':
    case 'print':
      return true;
    case 'edit_jobs':
    case 'update_status':
      return context.role === 'admin' || context.role === 'staff';
    case 'manage_settings':
    case 'manage_team':
    case 'manage_notifications':
      return context.role === 'admin';
    default:
      return false;
  }
}

export async function requireProcessorPermission(req: Request, permission: ProcessorPermission) {
  const auth = await requireStaffAccess(req);
  if (!auth.ok) {
    return {
      denied: NextResponse.json({ ok: false, error: auth.error }, { status: auth.status }),
      context: null as StaffProcessorContext | null,
      platformAdmin: false,
    };
  }

  const [context, platformAdmin] = await Promise.all([
    getStaffProcessorContext(req),
    isPlatformAdmin(req),
  ]);

  if (platformAdmin && (permission === 'manage_team' || permission === 'manage_settings')) {
    return {
      denied: null as NextResponse | null,
      context,
      platformAdmin,
    };
  }

  if (!hasProcessorPermission(context, permission)) {
    return {
      denied: NextResponse.json(
        { ok: false, error: `You do not have permission to ${permission.replace(/_/g, ' ')}.` },
        { status: 403 }
      ),
      context,
      platformAdmin,
    };
  }

  return {
    denied: null as NextResponse | null,
    context,
    platformAdmin,
  };
}
