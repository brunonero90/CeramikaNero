-- Ceramika Nero — migration-first rollout compatibility for included follow-ups.
-- Apply after migration 32 and before deploying the matching checkout UI.

create or replace function public.submit_cart_order_v6(
  p_idempotency_key text,
  p_customer_email text,
  p_customer_first_name text,
  p_customer_last_name text,
  p_customer_phone text,
  p_customer_notes text,
  p_marketing_consent boolean,
  p_terms_accepted_at timestamptz,
  p_privacy_policy_version text,
  p_lines jsonb,
  p_shipping_address jsonb,
  p_source text,
  p_selected_payment_method text,
  p_voucher_code text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_line jsonb;
  v_primary_included boolean;
  v_normalized_lines jsonb := '[]'::jsonb;
begin
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' then
    raise exception 'Cart lines must be an array';
  end if;

  for v_line in select value from jsonb_array_elements(p_lines)
  loop
    if v_line->>'type' = 'workshop_session'
       and nullif(v_line->>'link_role', '') is null then
      v_line := jsonb_set(
        v_line,
        '{link_role}',
        to_jsonb('primary'::text),
        true
      );
    end if;

    -- The previously deployed checkout does not send included_followup yet.
    -- Derive it from the locked server-side primary workshop configuration so
    -- migration 32 can safely be applied before the matching frontend deploy.
    if v_line->>'type' = 'workshop_session'
       and v_line->>'link_role' = 'followup'
       and not (v_line ? 'included_followup') then
      select coalesce(workshop.followup_included_in_price, false)
        into v_primary_included
      from jsonb_array_elements(p_lines) primary_line
      join public.workshop_sessions session
        on session.id = nullif(primary_line->>'session_id', '')::uuid
      join public.workshops workshop
        on workshop.id = session.workshop_id
      where primary_line->>'type' = 'workshop_session'
        and coalesce(primary_line->>'link_role', 'primary') <> 'followup'
        and primary_line->>'session_id' = v_line->>'linked_primary_session_id'
      limit 1;

      v_line := jsonb_set(
        v_line,
        '{included_followup}',
        to_jsonb(coalesce(v_primary_included, false)),
        true
      );
    end if;

    v_normalized_lines := v_normalized_lines || jsonb_build_array(v_line);
  end loop;

  return public.submit_cart_order_v5(
    p_idempotency_key,
    p_customer_email,
    p_customer_first_name,
    p_customer_last_name,
    p_customer_phone,
    p_customer_notes,
    p_marketing_consent,
    p_terms_accepted_at,
    p_privacy_policy_version,
    v_normalized_lines,
    p_shipping_address,
    p_source,
    p_selected_payment_method,
    p_voucher_code
  );
end;
$$;

revoke all on function public.submit_cart_order_v6(
  text, text, text, text, text, text, boolean, timestamptz,
  text, jsonb, jsonb, text, text, text
) from public, anon, authenticated;
grant execute on function public.submit_cart_order_v6(
  text, text, text, text, text, text, boolean, timestamptz,
  text, jsonb, jsonb, text, text, text
) to service_role;

comment on function public.submit_cart_order_v6(
  text, text, text, text, text, text, boolean, timestamptz,
  text, jsonb, jsonb, text, text, text
) is
  'Normalizes link roles and derives included follow-up pricing from server configuration for migration-first rollout compatibility.';
