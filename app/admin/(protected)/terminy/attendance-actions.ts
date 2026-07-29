'use server';

import { revalidatePath } from 'next/cache';
import { requireAnyRole } from '@/lib/admin/auth';
import { recordAuditEventWithCurrentClient } from '@/lib/admin/audit';
import {
  rpcCompleteAttendanceReview,
  rpcMarkRemainingNoShows,
  rpcSetParticipantAttendance,
} from '@/lib/admin/session-cockpit';
import type { AttendanceStatus } from '@/lib/admin/session-roster';

export async function setAttendanceAction(input: {
  participantId: string;
  sessionId: string;
  status: AttendanceStatus;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = await requireAnyRole(['owner', 'manager']);
  const result = await rpcSetParticipantAttendance({
    participantId: input.participantId,
    status: input.status,
    actorUserId: admin.userId,
  });
  if (!result.ok) return result;

  await recordAuditEventWithCurrentClient({
    actorUserId: admin.userId,
    actorRole: admin.role,
    action: 'attendance.update',
    entityType: 'participant',
    entityId: input.participantId,
    summary: `Attendance set to ${input.status}`,
    changedFields: { status: input.status, sessionId: input.sessionId },
  });

  revalidatePath(`/admin/terminy/${input.sessionId}`);
  revalidatePath('/admin/dzisiaj');
  return { ok: true };
}

export async function markRemainingNoShowsAction(input: {
  sessionId: string;
}): Promise<{ ok: true; marked: number } | { ok: false; error: string }> {
  const admin = await requireAnyRole(['owner', 'manager']);
  const result = await rpcMarkRemainingNoShows({
    sessionId: input.sessionId,
    actorUserId: admin.userId,
  });
  if (!result.ok) return result;

  await recordAuditEventWithCurrentClient({
    actorUserId: admin.userId,
    actorRole: admin.role,
    action: 'attendance.bulk_no_show',
    entityType: 'session',
    entityId: input.sessionId,
    summary: `Marked remaining as no-show (${result.marked})`,
    changedFields: { marked: result.marked },
  });

  revalidatePath(`/admin/terminy/${input.sessionId}`);
  revalidatePath('/admin/dzisiaj');
  return result;
}

export async function completeAttendanceReviewAction(input: {
  sessionId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = await requireAnyRole(['owner', 'manager']);
  const result = await rpcCompleteAttendanceReview({
    sessionId: input.sessionId,
    actorUserId: admin.userId,
  });
  if (!result.ok) return result;

  await recordAuditEventWithCurrentClient({
    actorUserId: admin.userId,
    actorRole: admin.role,
    action: 'attendance.review_complete',
    entityType: 'session',
    entityId: input.sessionId,
    summary: 'Session attendance review completed',
  });

  revalidatePath(`/admin/terminy/${input.sessionId}`);
  revalidatePath('/admin/dzisiaj');
  return { ok: true };
}
