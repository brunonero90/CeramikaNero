import { siteContact } from '@/lib/fixtures/navigation';
import type { PublicSiteSettings } from '@/lib/database/domain';

export type PublicContactDisplay = {
  brand: string;
  addressLine: string;
  email: string;
  phoneDisplay: string;
  phoneHref: string;
  whatsappUrl: string;
  whatsappWithMessage: string;
  facebookUrl: string;
  instagramUrl: string;
  deliveryQuoteWording: string;
  bankTransferInstructions: string;
  publicNotice: string;
};

const WHATSAPP_MESSAGE = encodeURIComponent(
  'Dzień dobry, chciałabym/chciałbym zapytać o warsztaty Ceramika Nero.'
);

function digitsFromPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('48') && digits.length >= 11) return digits;
  if (digits.length === 9) return `48${digits}`;
  return digits || '48532279101';
}

function phoneHrefFromDisplay(phone: string): string {
  const digits = digitsFromPhone(phone);
  return `tel:+${digits}`;
}

function formatPhoneDisplay(phone: string): string {
  const trimmed = phone.trim();
  if (!trimmed) return siteContact.phoneDisplay;
  const digits = digitsFromPhone(trimmed);
  if (digits.startsWith('48') && digits.length === 11) {
    const local = digits.slice(2);
    return `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
  }
  return trimmed;
}

export function contactDisplayFromSettings(
  settings: PublicSiteSettings | null | undefined
): PublicContactDisplay {
  const phoneDisplay = formatPhoneDisplay(
    settings?.studioPhone || siteContact.phoneDisplay
  );
  const phoneHref = phoneHrefFromDisplay(
    settings?.studioPhone || siteContact.phoneDisplay
  );
  const whatsappBase =
    settings?.whatsappUrl?.trim() ||
    `https://wa.me/${digitsFromPhone(phoneDisplay)}`;
  const whatsappUrl = whatsappBase.replace(/\?.*$/, '');
  const whatsappWithMessage = `${whatsappUrl}?text=${WHATSAPP_MESSAGE}`;

  return {
    brand: settings?.studioName || siteContact.brand,
    addressLine: settings?.studioAddress || siteContact.addressLine,
    email: settings?.studioEmail || siteContact.email,
    phoneDisplay,
    phoneHref,
    whatsappUrl,
    whatsappWithMessage,
    facebookUrl: settings?.facebookUrl?.trim() || siteContact.facebookUrl,
    instagramUrl: settings?.instagramUrl?.trim() || siteContact.instagramUrl,
    deliveryQuoteWording:
      settings?.deliveryQuoteWording ||
      'Koszt wysyłki zostanie potwierdzony przed płatnością.',
    bankTransferInstructions: settings?.bankTransferInstructions || '',
    publicNotice: settings?.publicNotice?.trim() || '',
  };
}
