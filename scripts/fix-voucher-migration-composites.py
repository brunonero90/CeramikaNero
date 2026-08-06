from pathlib import Path

path = Path('supabase/migrations/00000000000021_gift_voucher_integration.sql')
text = path.read_text()

replacements = [
    (
        """  select v, p into v_voucher, v_provider
  from public.gift_vouchers v
  join public.gift_voucher_providers p on p.code = v.provider_code
  where v.code_hash = public.voucher_code_hash(p_code)
    and p.is_active = true;

  if not found then raise exception 'Voucher not found'; end if;""",
        """  select * into v_voucher
  from public.gift_vouchers
  where code_hash = public.voucher_code_hash(p_code);

  if not found then raise exception 'Voucher not found'; end if;

  select * into v_provider
  from public.gift_voucher_providers
  where code = v_voucher.provider_code
    and is_active = true;

  if not found then raise exception 'Voucher provider is unavailable'; end if;""",
    ),
    (
        """    select v, p into v_voucher, v_provider
    from public.gift_vouchers v
    join public.gift_voucher_providers p on p.code = v.provider_code
    where v.id = v_existing_redemption.voucher_id;
    if v_voucher.code_hash <> public.voucher_code_hash(p_voucher_code) then""",
        """    select * into v_voucher
    from public.gift_vouchers
    where id = v_existing_redemption.voucher_id;
    if not found then raise exception 'Voucher not found'; end if;

    select * into v_provider
    from public.gift_voucher_providers
    where code = v_voucher.provider_code;
    if not found then raise exception 'Voucher provider is unavailable'; end if;

    if v_voucher.code_hash <> public.voucher_code_hash(p_voucher_code) then""",
    ),
    (
        """  select v, p into v_voucher, v_provider
  from public.gift_vouchers v
  join public.gift_voucher_providers p on p.code = v.provider_code
  where v.code_hash = public.voucher_code_hash(p_voucher_code)
    and p.is_active = true
  for update of v;

  if not found then raise exception 'Voucher not found'; end if;""",
        """  select * into v_voucher
  from public.gift_vouchers
  where code_hash = public.voucher_code_hash(p_voucher_code)
  for update;

  if not found then raise exception 'Voucher not found'; end if;

  select * into v_provider
  from public.gift_voucher_providers
  where code = v_voucher.provider_code
    and is_active = true;

  if not found then raise exception 'Voucher provider is unavailable'; end if;""",
    ),
]

for old, new in replacements:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'Expected exactly one migration block, found {count}')
    text = text.replace(old, new, 1)

path.write_text(text)
