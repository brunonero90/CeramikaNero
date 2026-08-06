-- Ceramika Nero — charge the configured price of the selected glazing session.
-- Apply after migration 33.
--
-- A later Glina do Wina event is still offered as an optional glazing visit,
-- but it is a separately priced reservation. Checkout reads the selected
-- session's own price and adds it to the order, Stripe/voucher amount and
-- refund ledger while preserving independent capacity and booking links.

update public.workshops
set followup_included_in_price = false,
    updated_at = timezone('utc'::text, now())
where slug in ('glina-do-wina', 'glinadowina')
   or lower(trim(title)) = 'glina do wina';

comment on column public.workshops.followup_included_in_price is
  'When true, a validated linked follow-up reserves capacity but contributes zero to the order total. Glina do Wina uses false so each selected session keeps its configured price.';
