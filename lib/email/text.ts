import {
  formatBankAccountGrouped,
  formatMoneyPln,
  formatWarsawDate,
  getEmailSiteUrl,
  absoluteEmailUrl,
} from '@/lib/email/format';
import { EMAIL_BRAND_NAME } from '@/lib/email/tokens';
import type {
  BookingEmailContext,
  EmailLineItem,
  OrderEmailContext,
  PaymentInstructionsMode,
  WorkshopDetail,
} from '@/lib/email/types';
import { siteContact } from '@/lib/fixtures/navigation';

function lines(...parts: Array<string | null | undefined | false>): string {
  return parts
    .filter((p): p is string => Boolean(p && String(p).length))
    .join('\n');
}

function paymentText(payment?: PaymentInstructionsMode | null): string {
  if (!payment || payment.mode === 'none') return '';
  if (payment.mode === 'shipping_pending') {
    return lines(
      'Płatność po wycenie wysyłki',
      payment.message ??
        'Koszt wysyłki potwierdzimy osobno. Prosimy nie przelewać środków, dopóki nie otrzymasz finalnej kwoty.'
    );
  }
  if (payment.mode === 'processing') {
    return lines(
      'Płatność w trakcie realizacji',
      payment.message ??
        'Oczekujemy na potwierdzenie płatności. Nie musisz nic robić — damy znać, gdy wszystko będzie gotowe.'
    );
  }
  if (payment.mode === 'stripe_pay_cta') {
    const amount =
      typeof payment.amountGrosz === 'number'
        ? formatMoneyPln(payment.amountGrosz)
        : null;
    return lines(
      'Płatność online',
      amount ? `Kwota: ${amount}` : null,
      `Opłać: ${payment.payUrl}`
    );
  }
  const d = payment.details;
  return lines(
    'Dane do przelewu',
    `Odbiorca: ${d.recipient}`,
    `Numer konta: ${formatBankAccountGrouped(d.accountNumber)}`,
    d.bankName ? `Bank: ${d.bankName}` : null,
    `Tytuł: ${d.title}`,
    `Kwota: ${formatMoneyPln(d.amountGrosz)}`,
    d.deadlineNote,
    d.extraInstructions
  );
}

function itemsText(items: EmailLineItem[]): string {
  if (!items.length) return '';
  return items
    .map((i) => {
      const extra = [i.fulfillmentLabel, i.meta].filter(Boolean).join(' · ');
      return `• ${i.title}${i.quantity > 1 ? ` × ${i.quantity}` : ''} — ${formatMoneyPln(i.lineTotalGrosz)}${extra ? ` (${extra})` : ''}`;
    })
    .join('\n');
}

function workshopText(w: WorkshopDetail): string {
  const parts = [
    w.title,
    formatWarsawDate(w.startsAt),
    w.location ? `Miejsce: ${w.location}` : null,
    `Liczba miejsc: ${w.quantity}`,
    typeof w.unitPriceGrosz === 'number'
      ? `Cena za miejsce: ${formatMoneyPln(w.unitPriceGrosz)}`
      : null,
  ];
  if (w.participants?.length) {
    parts.push('Uczestnicy:');
    for (const [i, p] of w.participants.entries()) {
      parts.push(
        `${i + 1}. ${p.displayName?.trim() || 'Uczestnik'}${p.age != null ? ` (${p.age} l.)` : ''}`
      );
    }
  }
  return lines(...parts);
}

function contactText(siteUrl?: string | null): string {
  const base = getEmailSiteUrl(siteUrl);
  return lines(
    'Kontakt',
    `${siteContact.email} · ${siteContact.phoneDisplay}`,
    absoluteEmailUrl('/kontakt', base),
    `Regulamin: ${absoluteEmailUrl('/regulamin', base)}`,
    `Polityka prywatności: ${absoluteEmailUrl('/polityka-prywatnosci', base)}`,
    '',
    EMAIL_BRAND_NAME
  );
}

function priceText(ctx: {
  subtotalGrosz: number;
  shippingGrosz?: number | null;
  totalGrosz: number;
  shippingPending?: boolean;
}): string {
  return lines(
    `Suma pozycji: ${formatMoneyPln(ctx.subtotalGrosz)}`,
    ctx.shippingPending
      ? 'Wysyłka: do potwierdzenia'
      : typeof ctx.shippingGrosz === 'number'
        ? `Wysyłka: ${formatMoneyPln(ctx.shippingGrosz)}`
        : null,
    `Razem: ${formatMoneyPln(ctx.totalGrosz)}`
  );
}

export function buildOrderPlainText(input: {
  greeting: string;
  status: string;
  detail?: string;
  ctx: OrderEmailContext;
}): string {
  const { ctx } = input;
  const workshops = (ctx.workshops ?? [])
    .map((w) => workshopText(w))
    .filter(Boolean)
    .join('\n\n');

  return lines(
    input.greeting,
    '',
    input.status,
    input.detail,
    '',
    `Zamówienie: ${ctx.orderReference}`,
    ctx.bookingReferences?.length
      ? `Rezerwacje: ${ctx.bookingReferences.join(', ')}`
      : null,
    '',
    itemsText(ctx.items),
    workshops ? `\n${workshops}` : null,
    '',
    priceText({
      subtotalGrosz: ctx.subtotalGrosz,
      shippingGrosz: ctx.shippingGrosz,
      totalGrosz: ctx.totalGrosz,
      shippingPending: ctx.shippingQuoteRequired,
    }),
    ctx.trackingReference ? `Numer przesyłki: ${ctx.trackingReference}` : null,
    ctx.cancellationReason ? `Powód: ${ctx.cancellationReason}` : null,
    typeof ctx.refundAmountGrosz === 'number'
      ? `Kwota zwrotu: ${formatMoneyPln(ctx.refundAmountGrosz)}`
      : null,
    '',
    paymentText(ctx.payment),
    '',
    contactText(ctx.siteUrl)
  );
}

export function buildBookingPlainText(input: {
  greeting: string;
  status: string;
  detail?: string;
  ctx: BookingEmailContext;
}): string {
  const { ctx } = input;
  return lines(
    input.greeting,
    '',
    input.status,
    input.detail,
    '',
    `Rezerwacja: ${ctx.reference}`,
    workshopText({
      title: ctx.workshopTitle,
      startsAt: ctx.sessionStartsAt,
      location: ctx.sessionLocation,
      quantity: ctx.quantity,
      unitPriceGrosz: ctx.unitPriceGrosz,
      participants: ctx.participants,
    }),
    '',
    `Razem: ${formatMoneyPln(ctx.totalGrosz)}`,
    ctx.reason ? `Powód: ${ctx.reason}` : null,
    typeof ctx.refundAmountGrosz === 'number'
      ? `Kwota zwrotu: ${formatMoneyPln(ctx.refundAmountGrosz)}`
      : null,
    ctx.cancellationUrl ? `Anulowanie: ${ctx.cancellationUrl}` : null,
    '',
    paymentText(ctx.payment),
    '',
    contactText(ctx.siteUrl)
  );
}
