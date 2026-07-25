'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  authenticateLocalAdmin,
  clearLocalAdminSession,
  isLocalAdminAuthenticated,
} from '@/lib/booking/local-admin-auth';
import { isBookingLocalMode } from '@/lib/booking/local-mode';
import {
  ensureLocalBookingSeed,
  newLocalSessionId,
} from '@/lib/booking/local-seed';
import {
  cancelLocalSession,
  listLocalBookings,
  listLocalOutbox,
  listLocalSessions,
  updateLocalBookingStatus,
  upsertLocalSession,
} from '@/lib/booking/local-store';
import { workshops } from '@/lib/database/fixtures/data';

async function requireLocalAdmin() {
  if (!isBookingLocalMode()) {
    throw new Error('BOOKING_LOCAL_MODE is off');
  }
  if (!(await isLocalAdminAuthenticated())) {
    redirect('/admin/local');
  }
}

export async function localAdminLoginAction(formData: FormData): Promise<void> {
  if (!isBookingLocalMode()) {
    redirect('/admin/local?error=disabled');
  }
  const password = String(formData.get('password') ?? '');
  const ok = await authenticateLocalAdmin(password);
  if (!ok) {
    redirect('/admin/local?error=auth');
  }
  redirect('/admin/local/dashboard');
}

export async function localAdminLogoutAction(): Promise<void> {
  await clearLocalAdminSession();
  redirect('/admin/local');
}

export async function createLocalSessionAction(
  formData: FormData
): Promise<void> {
  await requireLocalAdmin();
  await ensureLocalBookingSeed();

  const workshopSlug = String(formData.get('workshopSlug') ?? '');
  const workshop = workshops.find((w) => w.slug === workshopSlug);
  if (!workshop) {
    redirect('/admin/local/dashboard?error=workshop');
  }

  const startsAtLocal = String(formData.get('startsAt') ?? '');
  const durationMinutes = Number(
    formData.get('durationMinutes') ?? workshop.defaultDurationMinutes
  );
  const capacity = Number(formData.get('capacity') ?? workshop.defaultCapacity);
  const priceGrossGrosz = Number(
    formData.get('priceGrossGrosz') ?? workshop.defaultPriceGrossGrosz
  );
  const published = formData.get('published') === 'on';

  if (!startsAtLocal) {
    redirect('/admin/local/dashboard?error=startsAt');
  }
  if (!Number.isFinite(capacity) || capacity < 1) {
    redirect('/admin/local/dashboard?error=capacity');
  }
  if (!Number.isFinite(priceGrossGrosz) || priceGrossGrosz < 0) {
    redirect('/admin/local/dashboard?error=price');
  }

  const startsAt = new Date(startsAtLocal).toISOString();
  const endsAt = new Date(
    new Date(startsAt).getTime() + durationMinutes * 60_000
  ).toISOString();
  if (new Date(endsAt) <= new Date(startsAt)) {
    redirect('/admin/local/dashboard?error=range');
  }

  await upsertLocalSession({
    id: newLocalSessionId(),
    workshopId: workshop.id,
    workshopTitle: `[TEST] ${workshop.title}`,
    workshopSlug: workshop.slug,
    startsAt,
    endsAt,
    timezone: 'Europe/Warsaw',
    capacity,
    priceGrossGrosz,
    currency: 'PLN',
    status: published ? 'scheduled' : 'draft',
    locationName: 'Suchy Las (TEST)',
    locationAddress: 'ul. Podgórna 3, Suchy Las',
    published,
    minimumAge: workshop.minimumAge,
    maximumAge: workshop.maximumAge,
  });

  revalidatePath('/admin/local/dashboard');
  revalidatePath('/kalendarz');
  revalidatePath('/');
  redirect('/admin/local/dashboard?created=1');
}

export async function cancelLocalSessionAction(
  formData: FormData
): Promise<void> {
  await requireLocalAdmin();
  const sessionId = String(formData.get('sessionId') ?? '');
  if (!sessionId) {
    redirect('/admin/local/dashboard?error=session');
  }
  await cancelLocalSession(sessionId);
  revalidatePath('/admin/local/dashboard');
  revalidatePath('/kalendarz');
  redirect('/admin/local/dashboard?cancelled=1');
}

export async function updateLocalBookingStatusAction(
  formData: FormData
): Promise<void> {
  await requireLocalAdmin();
  const bookingId = String(formData.get('bookingId') ?? '');
  const status = String(formData.get('status') ?? '') as
    'confirmed' | 'cancelled';
  const reason = String(formData.get('reason') ?? 'Anulowanie lokalne');
  if (!bookingId || (status !== 'confirmed' && status !== 'cancelled')) {
    redirect('/admin/local/dashboard?error=booking');
  }
  await updateLocalBookingStatus(bookingId, status, reason);
  revalidatePath('/admin/local/dashboard');
  revalidatePath('/kalendarz');
  redirect('/admin/local/dashboard?bookingUpdated=1');
}

export async function loadLocalAdminData() {
  await requireLocalAdmin();
  await ensureLocalBookingSeed();
  const [sessions, bookings, outbox] = await Promise.all([
    listLocalSessions({ includeUnpublished: true }),
    listLocalBookings(),
    listLocalOutbox(),
  ]);
  return { sessions, bookings, outbox, workshops };
}
