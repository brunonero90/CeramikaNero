from pathlib import Path

path = Path('supabase/migrations/00000000000021_gift_voucher_integration.sql')
text = path.read_text()
old = "if v_order.selected_payment_method <> 'voucher' then"
new = "if v_order.selected_payment_method is distinct from 'voucher' then"
count = text.count(old)
if count != 1:
    raise SystemExit(f'Expected one null-unsafe payment-method comparison, found {count}')
path.write_text(text.replace(old, new, 1))
