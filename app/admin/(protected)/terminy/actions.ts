'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireAnyRole } from '@/lib/admin/auth';
import { recordAuditEvent } from '@/lib/admin/audit';
import { sessionInputSchema } from '@/lib/admin/schemas';
import {
  localDateTimeToUtc,
  DEFAULT_ADMIN_TIMEZONE,
} from '@/lib/admin/timezones';
import type { SessionStatus } from '@/lib/database/types';

type SessionInput = z.infer<typeof sessionInputSchema>;

export type SessionActionState =
  | { ok: true; id: string; message: string }
  | { ok: false; errors: Record<string, string>; formError?: string };

const sessionFormInputSchema = z.object({
  workshopId: z.string().uuid(),
  instructorId: z.string().uuid().optional().nullable(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  timezone: z.string().min(1).max(100),
  capacity: z.number().int().min(1),
  priceGrossPln: z.number().nonnegative(),
  locationName: z.string().max(300).optional().nullable(),
  locationAddress: z.string().max(500).optional().nullable(),
  status: z.enum(['draft', 'scheduled', 'sold_out', 'cancelled', 'completed']),
  bookingOpensDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  bookingOpensTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .optional()
    .nullable(),
  bookingClosesDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  bookingClosesTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .optional()
    .nullable(),
  externalBookingUrl: z.string().url().max(2000).optional().nullable(),
});

function toIsoUtc(
  date: string,
  time: string,
  timezone: string
): { ok: true; iso: string } | { ok: false; error: string } {
  const result = localDateTimeToUtc(date, time, timezone);
  if (!result.ok) {
    return {
      ok: false,
      error:
        result.error === 'invalid'
          ? 'Wybrana godzina nie istnieje (przejście na czas letni).'
          : 'Godzina jest niejednoznaczna (przejście na czas zimowy).',
    };
  }
  return { ok: true, iso: result.utc.toISOString() };
}

async function validateSessionForm(
  supabase: Awaited<ReturnType<typeof createClient>>,
  formData: FormData,
  existingId?: string
): Promise<
  | { ok: true; data: SessionInput }
  | { ok: false; errors: Record<string, string>; formError?: string }
> {
  const formParsed = sessionFormInputSchema.safeParse({
    workshopId: formData.get('workshopId'),
    instructorId: formData.get('instructorId') || null,
    date: formData.get('date'),
    startTime: formData.get('startTime'),
    endTime: formData.get('endTime'),
    timezone: formData.get('timezone') || DEFAULT_ADMIN_TIMEZONE,
    capacity: Number(formData.get('capacity') || 0),
    priceGrossPln: Number(formData.get('priceGrossPln') || 0),
    locationName: formData.get('locationName') || null,
    locationAddress: formData.get('locationAddress') || null,
    status: formData.get('status'),
    bookingOpensDate: formData.get('bookingOpensDate') || null,
    bookingOpensTime: formData.get('bookingOpensTime') || null,
    bookingClosesDate: formData.get('bookingClosesDate') || null,
    bookingClosesTime: formData.get('bookingClosesTime') || null,
    externalBookingUrl: formData.get('externalBookingUrl') || null,
  });

  if (!formParsed.success) {
    const errors: Record<string, string> = {};
    formParsed.error.issues.forEach((issue) => {
      errors[issue.path.join('.')] = issue.message;
    });
    return { ok: false, errors };
  }

  const f = formParsed.data;

  const starts = toIsoUtc(f.date, f.startTime, f.timezone);
  const ends = toIsoUtc(f.date, f.endTime, f.timezone);
  if (!starts.ok || !ends.ok) {
    const errors: Record<string, string> = {};
    if (!starts.ok) errors.startsAt = starts.error;
    if (!ends.ok) errors.endsAt = ends.error;
    return { ok: false, errors };
  }

  let bookingOpensAt: string | null = null;
  if (f.bookingOpensDate && f.bookingOpensTime) {
    const opens = toIsoUtc(f.bookingOpensDate, f.bookingOpensTime, f.timezone);
    if (!opens.ok) {
      return { ok: false, errors: { bookingOpensAt: opens.error } };
    }
    bookingOpensAt = opens.iso;
  }

  let bookingClosesAt: string | null = null;
  if (f.bookingClosesDate && f.bookingClosesTime) {
    const closes = toIsoUtc(
      f.bookingClosesDate,
      f.bookingClosesTime,
      f.timezone
    );
    if (!closes.ok) {
      return { ok: false, errors: { bookingClosesAt: closes.error } };
    }
    bookingClosesAt = closes.iso;
  }

  const parsed = sessionInputSchema.safeParse({
    workshopId: f.workshopId,
    instructorId: f.instructorId,
    startsAt: starts.iso,
    endsAt: ends.iso,
    timezone: f.timezone,
    capacity: f.capacity,
    priceGrossPln: f.priceGrossPln,
    locationName: f.locationName,
    locationAddress: f.locationAddress,
    status: f.status,
    bookingOpensAt,
    bookingClosesAt,
    externalBookingUrl: f.externalBookingUrl,
  });

  if (!parsed.success) {
    const errors: Record<string, string> = {};
    parsed.error.issues.forEach((issue) => {
      errors[issue.path.join('.')] = issue.message;
    });
    return { ok: false, errors };
  }

  const data = parsed.data;

  const { data: workshop } = await supabase
    .from('workshops')
    .select('id, status, archived_at')
    .eq('id', data.workshopId)
    .maybeSingle();
  if (!workshop) {
    return { ok: false, errors: { workshopId: 'Warsztat nie istnieje.' } };
  }
  if (workshop.status === 'archived' || workshop.archived_at) {
    return {
      ok: false,
      errors: {
        workshopId:
          'Nie można przypisać terminu do zarchiwizowanego warsztatu.',
      },
    };
  }

  if (data.instructorId) {
    const { data: instructor } = await supabase
      .from('instructors')
      .select('id, is_active')
      .eq('id', data.instructorId)
      .maybeSingle();
    if (!instructor) {
      return {
        ok: false,
        errors: { instructorId: 'Instruktor nie istnieje.' },
      };
    }
    if (!instructor.is_active && new Date(data.startsAt) > new Date()) {
      return {
        ok: false,
        errors: {
          instructorId:
            'Nieaktywny instruktor nie może prowadzić przyszłego terminu.',
        },
      };
    }
  }

  if (existingId) {
    const { data: existing } = await supabase
      .from('workshop_sessions')
      .select('reserved_count, status')
      .eq('id', existingId)
      .single();
    if (existing) {
      if (data.capacity < existing.reserved_count) {
        return {
          ok: false,
          errors: {
            capacity:
              'Liczba miejsc nie może być mniejsza niż liczba rezerwacji.',
          },
        };
      }
      if (
        (existing.status === 'cancelled' || existing.status === 'completed') &&
        (data.status === 'scheduled' || data.status === 'sold_out') &&
        new Date(data.startsAt) < new Date()
      ) {
        return {
          ok: false,
          errors: {
            status:
              'Nie można przywrócić przeszłego terminu do statusu nadchodzącego.',
          },
        };
      }
    }
  }

  return { ok: true, data };
}

function buildSessionInsert(data: SessionInput) {
  return {
    workshop_id: data.workshopId,
    instructor_id: data.instructorId,
    starts_at: data.startsAt,
    ends_at: data.endsAt,
    timezone: data.timezone,
    capacity: data.capacity,
    price_gross_grosz: data.priceGrossPln,
    location_name: data.locationName,
    location_address: data.locationAddress,
    status: data.status,
    booking_opens_at: data.bookingOpensAt,
    booking_closes_at: data.bookingClosesAt,
    external_booking_url: data.externalBookingUrl,
  };
}

export async function createSessionAction(
  _prevState: SessionActionState | undefined,
  formData: FormData
): Promise<SessionActionState> {
  const admin = await requireAnyRole(['manager']);
  const supabase = await createClient();

  const validated = await validateSessionForm(supabase, formData);
  if (!validated.ok) return validated;
  const data = validated.data;

  const { data: inserted, error } = await supabase
    .from('workshop_sessions')
    .insert(buildSessionInsert(data))
    .select('id')
    .single();

  if (error || !inserted) {
    return {
      ok: false,
      formError: 'Nie udało się utworzyć terminu.',
      errors: {},
    };
  }

  await recordAuditEvent(supabase, {
    actorUserId: admin.userId,
    actorRole: admin.role,
    action: 'create_session',
    entityType: 'session',
    entityId: inserted.id,
    summary: `Created session for workshop ${data.workshopId}`,
    changedFields: { starts_at: data.startsAt, status: data.status },
  });

  revalidatePath('/admin/terminy');
  revalidatePath('/warsztaty');
  return { ok: true, id: inserted.id, message: 'Termin został utworzony.' };
}

export async function updateSessionAction(
  id: string,
  _prevState: SessionActionState | undefined,
  formData: FormData
): Promise<SessionActionState> {
  const admin = await requireAnyRole(['manager']);
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from('workshop_sessions')
    .select('id')
    .eq('id', id)
    .maybeSingle();
  if (!existing) {
    return { ok: false, formError: 'Termin nie istnieje.', errors: {} };
  }

  const validated = await validateSessionForm(supabase, formData, id);
  if (!validated.ok) return validated;
  const data = validated.data;

  const { error } = await supabase
    .from('workshop_sessions')
    .update(buildSessionInsert(data))
    .eq('id', id);

  if (error) {
    return {
      ok: false,
      formError: 'Nie udało się zaktualizować terminu.',
      errors: {},
    };
  }

  await recordAuditEvent(supabase, {
    actorUserId: admin.userId,
    actorRole: admin.role,
    action: 'update_session',
    entityType: 'session',
    entityId: id,
    summary: `Updated session ${id}`,
    changedFields: { starts_at: data.startsAt, status: data.status },
  });

  revalidatePath('/admin/terminy');
  revalidatePath('/warsztaty');
  return { ok: true, id, message: 'Termin został zaktualizowany.' };
}

export async function duplicateSessionAction(
  id: string
): Promise<SessionActionState> {
  const admin = await requireAnyRole(['manager']);
  const supabase = await createClient();

  const { data: session } = await supabase
    .from('workshop_sessions')
    .select('*')
    .eq('id', id)
    .single();
  if (!session) {
    return { ok: false, formError: 'Termin nie istnieje.', errors: {} };
  }

  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const starts = new Date(new Date(session.starts_at).getTime() + weekMs);
  const ends = new Date(new Date(session.ends_at).getTime() + weekMs);
  const opens = session.booking_opens_at
    ? new Date(new Date(session.booking_opens_at).getTime() + weekMs)
    : null;
  const closes = session.booking_closes_at
    ? new Date(new Date(session.booking_closes_at).getTime() + weekMs)
    : null;

  // Detect accidental same-slot duplicates before insert.
  const { count: clashCount } = await supabase
    .from('workshop_sessions')
    .select('*', { count: 'exact', head: true })
    .eq('workshop_id', session.workshop_id)
    .eq('starts_at', starts.toISOString())
    .neq('status', 'cancelled');
  if ((clashCount ?? 0) > 0) {
    return {
      ok: false,
      formError:
        'Istnieje już termin tego warsztatu w tym samym czasie (+7 dni). Zmień datę ręcznie.',
      errors: {},
    };
  }

  const insertPayload: Record<string, unknown> = {
    workshop_id: session.workshop_id,
    instructor_id: session.instructor_id,
    starts_at: starts.toISOString(),
    ends_at: ends.toISOString(),
    timezone: session.timezone,
    capacity: session.capacity,
    reserved_count: 0,
    price_gross_grosz: session.price_gross_grosz,
    location_name: session.location_name,
    location_address: session.location_address,
    status: 'draft' as SessionStatus,
    booking_opens_at: opens?.toISOString() ?? null,
    booking_closes_at: closes?.toISOString() ?? null,
    external_booking_url: session.external_booking_url,
  };
  if ('venue_key' in session) {
    insertPayload.venue_key = session.venue_key;
  }

  const { data: inserted, error } = await supabase
    .from('workshop_sessions')
    .insert(insertPayload as never)
    .select('id')
    .single();

  if (error || !inserted) {
    return {
      ok: false,
      formError: 'Nie udało się zduplikować terminu.',
      errors: {},
    };
  }

  await recordAuditEvent(supabase, {
    actorUserId: admin.userId,
    actorRole: admin.role,
    action: 'duplicate_session',
    entityType: 'session',
    entityId: inserted.id,
    summary: `Duplicated session from ${id} (+7 days, draft)`,
  });

  revalidatePath('/admin/terminy');
  revalidatePath(`/admin/terminy/${inserted.id}`);
  return {
    ok: true,
    id: inserted.id,
    message: 'Utworzono szkic terminu na +7 dni. Sprawdź datę przed publikacją.',
  };
}
