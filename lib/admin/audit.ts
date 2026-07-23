import { createClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AdminRole, Database } from '@/lib/database/types';

type AuditEntityType =
  | 'category'
  | 'workshop'
  | 'session'
  | 'instructor'
  | 'page'
  | 'blog_post'
  | 'gallery_item'
  | 'media_asset'
  | 'site_setting'
  | 'redirect'
  | 'admin_user'
  | 'auth';

export type AuditEventInput = {
  actorUserId: string;
  actorRole: AdminRole;
  action: string;
  entityType: AuditEntityType;
  entityId?: string | null;
  summary: string;
  changedFields?: Record<string, unknown> | null;
  requestMetadata?: Record<string, unknown> | null;
};

/**
 * Append an administrative audit record. This is best-effort: failures are
 * logged but not thrown, so a successful business operation is not rolled
 * back because of an audit-log insertion problem.
 */
export async function recordAuditEvent(
  supabase: SupabaseClient<Database>,
  input: AuditEventInput
): Promise<void> {
  const { error } = await supabase.from('admin_audit_log').insert({
    actor_user_id: input.actorUserId,
    actor_role: input.actorRole,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    summary: input.summary,
    changed_fields: input.changedFields ?? null,
    request_metadata: input.requestMetadata ?? null,
  });

  if (error) {
    console.error('Audit log insert failed:', error.message);
  }
}

/**
 * Convenience helper that records an audit event using the current server
 * client. The caller must provide the actor details from a verified session.
 */
export async function recordAuditEventWithCurrentClient(
  input: AuditEventInput
): Promise<void> {
  const supabase = createClient();
  return recordAuditEvent(supabase, input);
}
