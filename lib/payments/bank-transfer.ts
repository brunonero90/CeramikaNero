import 'server-only';
import { createCartAdminClient } from '@/lib/supabase/cart-admin';
import type { PublicSiteSettings } from '@/lib/database/domain';

export type BankTransferConfig = {
  enabled: boolean;
  recipient: string;
  accountNumber: string;
  bankName: string | null;
  titleTemplate: string;
  deadlineNote: string | null;
  /** Free-form supplemental note from legacy setting (optional). */
  extraInstructions: string | null;
};

export type BankTransferConfigResult =
  | { ok: true; config: BankTransferConfig }
  | { ok: false; error: string; config: BankTransferConfig };

const DEFAULT_TITLE_TEMPLATE = '{{order_reference}}';

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeAccountNumber(raw: string): string {
  return raw.replace(/[\s-]/g, '').toUpperCase();
}

function groupPolishAccount(account: string): string {
  const compact = normalizeAccountNumber(account);
  if (!/^\d{26}$/.test(compact) && !/^PL\d{26}$/.test(compact)) {
    return account.trim();
  }
  const digits = compact.startsWith('PL') ? compact.slice(2) : compact;
  const parts = [
    digits.slice(0, 2),
    digits.slice(2, 6),
    digits.slice(6, 10),
    digits.slice(10, 14),
    digits.slice(14, 18),
    digits.slice(18, 22),
    digits.slice(22, 26),
  ];
  return compact.startsWith('PL') ? `PL ${parts.join(' ')}` : parts.join(' ');
}

export function parseBankTransferConfig(
  settings: PublicSiteSettings | null | undefined,
  rawRows?: Array<{ key: string; value: unknown }>
): BankTransferConfig {
  const get = (key: string): string => {
    if (rawRows) {
      const found = rawRows.find((r) => r.key === key);
      return asString(found?.value);
    }
    return '';
  };

  const enabledRaw = get('bank_transfer_enabled');
  const enabled =
    enabledRaw === ''
      ? true
      : enabledRaw === 'true' || enabledRaw === '1' || enabledRaw === 'yes';

  const recipient =
    get('bank_transfer_recipient') || settings?.studioName?.trim() || '';
  const accountNumber = get('bank_transfer_account');
  const bankName = get('bank_transfer_bank_name') || null;
  const titleTemplate =
    get('bank_transfer_title_template') || DEFAULT_TITLE_TEMPLATE;
  const deadlineNote = get('bank_transfer_deadline_note') || null;
  const extra =
    settings?.bankTransferInstructions?.trim() &&
    !settings.bankTransferInstructions.includes('potwierdzimy po ustaleniu')
      ? settings.bankTransferInstructions.trim()
      : get('bank_transfer_instructions') || null;

  return {
    enabled,
    recipient,
    accountNumber,
    bankName: bankName || null,
    titleTemplate,
    deadlineNote: deadlineNote || null,
    extraInstructions: extra || null,
  };
}

export function validateBankTransferConfig(
  config: BankTransferConfig
): BankTransferConfigResult {
  if (!config.enabled) {
    return {
      ok: false,
      error: 'Przelew bankowy jest wyłączony w ustawieniach.',
      config,
    };
  }
  if (!config.recipient) {
    return {
      ok: false,
      error:
        'Brak odbiorcy przelewu. Uzupełnij „Odbiorca przelewu” w ustawieniach admina.',
      config,
    };
  }
  const compact = normalizeAccountNumber(config.accountNumber);
  if (!compact) {
    return {
      ok: false,
      error:
        'Brak numeru konta. Uzupełnij numer konta bankowego w ustawieniach admina.',
      config,
    };
  }
  if (!/^(PL)?\d{26}$/.test(compact)) {
    return {
      ok: false,
      error:
        'Numer konta bankowego jest nieprawidłowy (wymagane 26 cyfr lub PL + 26 cyfr).',
      config,
    };
  }
  return { ok: true, config };
}

export function buildTransferTitle(
  template: string,
  orderReference: string
): string {
  return (
    template
      .replace(/\{\{\s*order_reference\s*\}\}/gi, orderReference)
      .replace(/\{\{\s*reference\s*\}\}/gi, orderReference)
      .trim() || orderReference
  );
}

export function formatBankAccountForDisplay(accountNumber: string): string {
  return groupPolishAccount(accountNumber);
}

export async function loadBankTransferConfig(): Promise<BankTransferConfigResult> {
  const supabase = createCartAdminClient();
  const { data, error } = await supabase
    .from('site_settings')
    .select('key, value');

  if (error) {
    console.error('bank transfer settings load failed', error.message);
    return {
      ok: false,
      error: 'Nie udało się odczytać konfiguracji przelewu.',
      config: {
        enabled: false,
        recipient: '',
        accountNumber: '',
        bankName: null,
        titleTemplate: DEFAULT_TITLE_TEMPLATE,
        deadlineNote: null,
        extraInstructions: null,
      },
    };
  }

  const rows = (data ?? []) as Array<{ key: string; value: unknown }>;
  const studioName = asString(rows.find((r) => r.key === 'studio_name')?.value);
  const legacyInstructions = asString(
    rows.find((r) => r.key === 'bank_transfer_instructions')?.value
  );

  const config = parseBankTransferConfig(
    {
      studioName: studioName || 'Ceramika Nero',
      studioAddress: '',
      studioEmail: '',
      studioPhone: '',
      whatsappUrl: '',
      facebookUrl: '',
      instagramUrl: '',
      bankTransferInstructions: legacyInstructions,
      bankTransferEnabled: true,
      bankTransferRecipient: '',
      bankTransferAccount: '',
      bankTransferBankName: '',
      bankTransferTitleTemplate: DEFAULT_TITLE_TEMPLATE,
      bankTransferDeadlineNote: '',
      deliveryQuoteWording: '',
      publicNotice: '',
      bookingCtaLabel: '',
      defaultSeoTitle: '',
      defaultSeoDescription: '',
    },
    rows
  );

  return validateBankTransferConfig(config);
}

export type TransferInstructionsView = {
  amountLabel: string;
  recipient: string;
  accountNumberDisplay: string;
  bankName: string | null;
  transferTitle: string;
  deadlineNote: string | null;
  extraInstructions: string | null;
};
