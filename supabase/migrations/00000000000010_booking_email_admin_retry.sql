-- Additive: admin notification email type + retry metadata for booking_emails.

alter table public.booking_emails
  drop constraint if exists booking_emails_email_type_check;

alter table public.booking_emails
  add constraint booking_emails_email_type_check
  check (
    email_type in (
      'confirmation',
      'cancellation',
      'refund',
      'manual_confirmation',
      'payment_problem',
      'admin_notification'
    )
  );

alter table public.booking_emails
  add column if not exists attempt_count integer not null default 0;

alter table public.booking_emails
  add column if not exists next_attempt_at timestamptz;

alter table public.booking_emails
  add column if not exists claimed_at timestamptz;

create index if not exists idx_booking_emails_retry
  on public.booking_emails (status, next_attempt_at)
  where status in ('pending', 'failed');

comment on column public.booking_emails.attempt_count is
  'Number of provider delivery attempts for this ledger row.';
comment on column public.booking_emails.next_attempt_at is
  'Earliest time a retry worker may claim this row again.';
comment on column public.booking_emails.claimed_at is
  'Set while a worker is actively sending; cleared on completion.';

-- Atomically claim retryable email rows (service role only).
create or replace function public.claim_booking_emails_for_dispatch(
  p_limit integer default 20,
  p_claim_seconds integer default 120
)
returns setof public.booking_emails
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := timezone('utc'::text, now());
begin
  if p_limit is null or p_limit < 1 then
    p_limit := 20;
  end if;
  if p_limit > 50 then
    p_limit := 50;
  end if;

  return query
  with candidates as (
    select e.id
    from public.booking_emails e
    where e.status in ('pending', 'failed')
      and e.attempt_count < 8
      and (
        e.next_attempt_at is null
        or e.next_attempt_at <= v_now
      )
      and (
        e.claimed_at is null
        or e.claimed_at < v_now - make_interval(secs => greatest(p_claim_seconds, 30))
      )
      and (
        e.error_message is null
        or e.error_message not ilike '%permanent%'
        or e.status = 'pending'
      )
    order by e.created_at asc
    limit p_limit
    for update skip locked
  ),
  claimed as (
    update public.booking_emails e
    set
      claimed_at = v_now,
      updated_at = v_now
    from candidates c
    where e.id = c.id
    returning e.*
  )
  select * from claimed;
end;
$$;

comment on function public.claim_booking_emails_for_dispatch(integer, integer) is
  'Claims a bounded batch of pending/failed booking emails for retry-safe dispatch.';

revoke all on function public.claim_booking_emails_for_dispatch(integer, integer) from public;
grant execute on function public.claim_booking_emails_for_dispatch(integer, integer) to service_role;
