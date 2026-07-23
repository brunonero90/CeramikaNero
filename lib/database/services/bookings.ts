import { createAdminClient } from '@/lib/supabase/admin';

const selectBookingDetail = `
  id,
  booking_reference,
  status,
  quantity,
  unit_price_gross_grosz,
  total_price_gross_grosz,
  currency,
  customer_notes,
  internal_notes,
  source,
  terms_accepted_at,
  privacy_policy_version,
  expires_at,
  confirmed_at,
  cancelled_at,
  cancelled_by,
  cancellation_reason,
  moved_from_session_id,
  moved_to_session_id,
  created_at,
  updated_at,
  customer_profiles (first_name, last_name, email, phone, marketing_consent),
  workshop_sessions (
    id,
    starts_at,
    ends_at,
    timezone,
    capacity,
    reserved_count,
    location_name,
    location_address,
    workshops (id, title, slug, description)
  ),
  booking_participants (id, display_name, age, participant_type, accessibility_notes),
  payments (id, provider, status, amount_gross_grosz, currency, provider_checkout_id, provider_payment_id, paid_at, refunded_amount_grosz, failure_message)
`;

export async function getBookingByReference(reference: string) {
  const supabase = createAdminClient();
  return supabase
    .from('bookings')
    .select(selectBookingDetail)
    .eq('booking_reference', reference)
    .single();
}

export async function getBookingById(id: string) {
  const supabase = createAdminClient();
  return supabase
    .from('bookings')
    .select(selectBookingDetail)
    .eq('id', id)
    .single();
}

export async function getBookingCount(params?: {
  status?: string;
  paymentStatus?: string;
  source?: string;
  sessionId?: string;
  workshopId?: string;
  from?: string;
  to?: string;
  search?: string;
}) {
  const supabase = createAdminClient();
  let query = supabase
    .from('bookings')
    .select('*', { count: 'exact', head: true });

  if (params?.status) {
    query = query.eq('status', params.status);
  }
  if (params?.source) {
    query = query.eq('source', params.source);
  }
  if (params?.sessionId) {
    query = query.eq('workshop_session_id', params.sessionId);
  }
  if (params?.from) {
    query = query.gte('created_at', params.from);
  }
  if (params?.to) {
    query = query.lte('created_at', params.to);
  }
  if (params?.search) {
    const term = params.search.trim().toLowerCase();
    query = query.or(
      `booking_reference.ilike.%${term}%,customer_profiles.email.ilike.%${term}%,customer_profiles.first_name.ilike.%${term}%,customer_profiles.last_name.ilike.%${term}%`
    );
  }

  return query;
}

export async function getBookings(params?: {
  status?: string;
  paymentStatus?: string;
  source?: string;
  sessionId?: string;
  workshopId?: string;
  from?: string;
  to?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}) {
  const supabase = createAdminClient();
  let query = supabase.from('bookings').select(selectBookingDetail);

  if (params?.status) {
    query = query.eq('status', params.status);
  }
  if (params?.source) {
    query = query.eq('source', params.source);
  }
  if (params?.sessionId) {
    query = query.eq('workshop_session_id', params.sessionId);
  }
  if (params?.from) {
    query = query.gte('created_at', params.from);
  }
  if (params?.to) {
    query = query.lte('created_at', params.to);
  }
  if (params?.search) {
    const term = params.search.trim().toLowerCase();
    query = query.or(
      `booking_reference.ilike.%${term}%,customer_profiles.email.ilike.%${term}%,customer_profiles.first_name.ilike.%${term}%,customer_profiles.last_name.ilike.%${term}%`
    );
  }

  const sortColumn = params?.sortBy ?? 'created_at';
  const sortOrder = params?.sortOrder ?? 'desc';
  query = query.order(sortColumn, { ascending: sortOrder === 'asc' });

  const pageSize = params?.pageSize ?? 20;
  const page = params?.page ?? 1;
  query = query.range((page - 1) * pageSize, page * pageSize - 1);

  return query;
}

export async function getBookingEvents(bookingId: string) {
  const supabase = createAdminClient();
  return supabase
    .from('booking_events')
    .select('*')
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: false });
}

export async function getBookingEmails(bookingId: string) {
  const supabase = createAdminClient();
  return supabase
    .from('booking_emails')
    .select(
      'id, email_type, status, provider_message_id, error_message, sent_at, created_at'
    )
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: false });
}
