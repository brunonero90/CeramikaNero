import * as React from 'react';
import {
  AdminMeta,
  EmailLayout,
  PriceSummary,
} from '@/lib/email/components/EmailLayout';
import {
  OrderSummary,
  ProductDetails,
  WorkshopDetails,
} from '@/lib/email/components';
import { PrimaryButton } from '@/lib/email/components/PrimaryButton';
import { absoluteEmailUrl, formatMoneyPln } from '@/lib/email/format';
import { buildOrderPlainText } from '@/lib/email/text';
import type { EmailTemplateResult, OrderEmailContext } from '@/lib/email/types';

function greet(name: string): string {
  const n = name.trim();
  return n ? `Dzień dobry ${n},` : 'Dzień dobry,';
}

function firstWorkshop(ctx: OrderEmailContext) {
  return ctx.workshops?.[0] ?? null;
}

function OrderBody({ ctx }: { ctx: OrderEmailContext }) {
  const workshop = firstWorkshop(ctx);
  return (
    <>
      <OrderSummary
        orderReference={ctx.orderReference}
        items={ctx.items}
        bookingReferences={ctx.bookingReferences}
      />
      {workshop ? <WorkshopDetails workshop={workshop} /> : null}
      {ctx.workshops?.slice(1).map((w) => (
        <WorkshopDetails key={`${w.title}-${w.startsAt}`} workshop={w} />
      ))}
      <ProductDetails
        items={ctx.items}
        shippingAddress={ctx.shippingAddress}
        pickupNote={ctx.pickupNote}
        trackingReference={ctx.trackingReference}
      />
      <PriceSummary
        subtotalGrosz={ctx.subtotalGrosz}
        shippingGrosz={ctx.shippingGrosz}
        totalGrosz={ctx.totalGrosz}
        shippingPending={Boolean(ctx.shippingQuoteRequired)}
      />
    </>
  );
}

function pack(
  subject: string,
  preheader: string,
  react: React.ReactElement,
  text: string
): EmailTemplateResult {
  return { subject, preheader, react, text };
}

export function buildCustomerConfirmation(
  ctx: OrderEmailContext
): EmailTemplateResult {
  const shippingPending = Boolean(ctx.shippingQuoteRequired);
  const subject = `Potwierdzenie zamówienia ${ctx.orderReference} — Ceramika Nero`;
  const preheader = shippingPending
    ? 'Zapisaliśmy zamówienie. Koszt wysyłki potwierdzimy wkrótce.'
    : 'Dziękujemy — zapisaliśmy Twoje zamówienie.';
  const status = shippingPending
    ? 'Dziękujemy! Zamówienie zostało zapisane. Koszt wysyłki potwierdzimy osobno — wtedy prześlemy finalną kwotę.'
    : 'Dziękujemy! Twoje zamówienie zostało zapisane.';

  return pack(
    subject,
    preheader,
    <EmailLayout
      preview={preheader}
      siteUrl={ctx.siteUrl}
      greeting={greet(ctx.customerName)}
      bannerTitle="Zamówienie przyjęte"
      bannerTone={shippingPending ? 'warning' : 'success'}
      bannerBody={status}
      payment={ctx.payment}
    >
      <OrderBody ctx={ctx} />
    </EmailLayout>,
    buildOrderPlainText({
      greeting: greet(ctx.customerName),
      status: 'Zamówienie przyjęte',
      detail: status,
      ctx,
    })
  );
}

export function buildAdminNotification(
  ctx: OrderEmailContext
): EmailTemplateResult {
  const subject = `[Ceramika Nero] Nowe zamówienie ${ctx.orderReference}`;
  const preheader = `${ctx.customerName} · ${formatMoneyPln(ctx.totalGrosz)}`;
  const adminUrl = absoluteEmailUrl('/admin/zamowienia', ctx.siteUrl);

  return pack(
    subject,
    preheader,
    <EmailLayout
      preview={preheader}
      siteUrl={ctx.siteUrl}
      bannerTitle="Nowe zamówienie"
      bannerTone="info"
      bannerBody={`${ctx.orderReference} · ${formatMoneyPln(ctx.totalGrosz)}`}
      payment={ctx.payment}
      contactIntro="Panel administracyjny:"
    >
      <AdminMeta>
        {`Klient: ${ctx.customerName}\nE-mail: ${ctx.customerEmail}${
          ctx.customerPhone ? `\nTelefon: ${ctx.customerPhone}` : ''
        }${ctx.adminNotes ? `\nNotatka: ${ctx.adminNotes}` : ''}${
          ctx.shippingQuoteRequired ? '\nWymaga wyceny wysyłki' : ''
        }`}
      </AdminMeta>
      <OrderBody ctx={ctx} />
      <PrimaryButton href={adminUrl}>Otwórz w panelu</PrimaryButton>
    </EmailLayout>,
    buildOrderPlainText({
      greeting: 'Nowe zamówienie',
      status: ctx.orderReference,
      detail: `Klient: ${ctx.customerName} (${ctx.customerEmail})`,
      ctx,
    }) + `\n\nPanel: ${adminUrl}`
  );
}

export function buildShippingQuoteConfirmed(
  ctx: OrderEmailContext
): EmailTemplateResult {
  const subject = `Koszt wysyłki potwierdzony — ${ctx.orderReference}`;
  const preheader = `Finalna kwota: ${formatMoneyPln(ctx.totalGrosz)}`;
  const detail = `Potwierdzamy koszt wysyłki. Kwota do zapłaty: ${formatMoneyPln(ctx.totalGrosz)}.`;

  return pack(
    subject,
    preheader,
    <EmailLayout
      preview={preheader}
      siteUrl={ctx.siteUrl}
      greeting={greet(ctx.customerName)}
      bannerTitle="Wysyłka wyceniona"
      bannerTone="success"
      bannerBody={detail}
      payment={ctx.payment}
    >
      <OrderBody ctx={{ ...ctx, shippingQuoteRequired: false }} />
    </EmailLayout>,
    buildOrderPlainText({
      greeting: greet(ctx.customerName),
      status: 'Wysyłka wyceniona',
      detail,
      ctx: { ...ctx, shippingQuoteRequired: false },
    })
  );
}

export function buildPaymentReceived(
  ctx: OrderEmailContext
): EmailTemplateResult {
  const subject = `Płatność otrzymana — ${ctx.orderReference}`;
  const preheader = `Dziękujemy — otrzymaliśmy ${formatMoneyPln(ctx.totalGrosz)}.`;
  const detail =
    'Potwierdzamy otrzymanie płatności. Przygotujemy Twoje zamówienie dalej w pracowni.';

  return pack(
    subject,
    preheader,
    <EmailLayout
      preview={preheader}
      siteUrl={ctx.siteUrl}
      greeting={greet(ctx.customerName)}
      bannerTitle="Płatność potwierdzona"
      bannerTone="success"
      bannerBody={detail}
      payment={{ mode: 'none' }}
    >
      <OrderBody ctx={ctx} />
    </EmailLayout>,
    buildOrderPlainText({
      greeting: greet(ctx.customerName),
      status: 'Płatność potwierdzona',
      detail,
      ctx: { ...ctx, payment: { mode: 'none' } },
    })
  );
}

export function buildReadyForPickup(
  ctx: OrderEmailContext
): EmailTemplateResult {
  const subject = `Gotowe do odbioru — ${ctx.orderReference}`;
  const preheader = 'Twoje zamówienie czeka w pracowni.';
  const detail =
    ctx.pickupNote ??
    'Zamówienie jest gotowe do odbioru w pracowni przy ul. Podgórna 3, Suchy Las.';

  return pack(
    subject,
    preheader,
    <EmailLayout
      preview={preheader}
      siteUrl={ctx.siteUrl}
      greeting={greet(ctx.customerName)}
      bannerTitle="Gotowe do odbioru"
      bannerTone="success"
      bannerBody={detail}
      payment={{ mode: 'none' }}
    >
      <OrderBody ctx={ctx} />
    </EmailLayout>,
    buildOrderPlainText({
      greeting: greet(ctx.customerName),
      status: 'Gotowe do odbioru',
      detail,
      ctx: { ...ctx, payment: { mode: 'none' } },
    })
  );
}

export function buildOrderShipped(ctx: OrderEmailContext): EmailTemplateResult {
  const subject = `Wysłano — ${ctx.orderReference}`;
  const tracking = ctx.trackingReference?.trim();
  const preheader = tracking
    ? `Numer przesyłki: ${tracking}`
    : 'Twoje zamówienie zostało wysłane.';
  const detail = tracking
    ? `Zamówienie zostało nadane. Numer przesyłki: ${tracking}.`
    : 'Zamówienie zostało nadane. Gdy pojawi się numer śledzenia, damy znać.';

  return pack(
    subject,
    preheader,
    <EmailLayout
      preview={preheader}
      siteUrl={ctx.siteUrl}
      greeting={greet(ctx.customerName)}
      bannerTitle="Zamówienie wysłane"
      bannerTone="success"
      bannerBody={detail}
      payment={{ mode: 'none' }}
    >
      <OrderBody ctx={ctx} />
    </EmailLayout>,
    buildOrderPlainText({
      greeting: greet(ctx.customerName),
      status: 'Zamówienie wysłane',
      detail,
      ctx: { ...ctx, payment: { mode: 'none' } },
    })
  );
}

export function buildCancellation(ctx: OrderEmailContext): EmailTemplateResult {
  const subject = `Anulowano — ${ctx.orderReference}`;
  const preheader = 'Zamówienie zostało anulowane.';
  const detail = ctx.cancellationReason
    ? `Zamówienie zostało anulowane. Powód: ${ctx.cancellationReason}`
    : 'Zamówienie zostało anulowane. Jeśli to pomyłka — napisz do nas.';

  return pack(
    subject,
    preheader,
    <EmailLayout
      preview={preheader}
      siteUrl={ctx.siteUrl}
      greeting={greet(ctx.customerName)}
      bannerTitle="Zamówienie anulowane"
      bannerTone="neutral"
      bannerBody={detail}
      payment={{ mode: 'none' }}
    >
      <OrderBody ctx={ctx} />
    </EmailLayout>,
    buildOrderPlainText({
      greeting: greet(ctx.customerName),
      status: 'Zamówienie anulowane',
      detail,
      ctx: { ...ctx, payment: { mode: 'none' } },
    })
  );
}

export function buildAwaitingStripePayment(
  ctx: OrderEmailContext
): EmailTemplateResult {
  const subject = `Dokończ płatność — ${ctx.orderReference}`;
  const preheader = 'Twoje zamówienie czeka na opłacenie online.';
  const detail =
    'Zapisaliśmy zamówienie. Aby je potwierdzić, dokończ bezpieczną płatność online.';

  return pack(
    subject,
    preheader,
    <EmailLayout
      preview={preheader}
      siteUrl={ctx.siteUrl}
      greeting={greet(ctx.customerName)}
      bannerTitle="Czeka na płatność"
      bannerTone="warning"
      bannerBody={detail}
      payment={ctx.payment}
    >
      <OrderBody ctx={ctx} />
    </EmailLayout>,
    buildOrderPlainText({
      greeting: greet(ctx.customerName),
      status: 'Czeka na płatność',
      detail,
      ctx,
    })
  );
}

export function buildStripePaymentProcessing(
  ctx: OrderEmailContext
): EmailTemplateResult {
  const subject = `Płatność w trakcie — ${ctx.orderReference}`;
  const preheader = 'Otrzymaliśmy Twoją płatność i czekamy na potwierdzenie.';
  const detail =
    'Płatność jest przetwarzana. Nie musisz nic robić — wyślemy potwierdzenie, gdy środki zostaną zaksięgowane.';

  return pack(
    subject,
    preheader,
    <EmailLayout
      preview={preheader}
      siteUrl={ctx.siteUrl}
      greeting={greet(ctx.customerName)}
      bannerTitle="Płatność w trakcie realizacji"
      bannerTone="info"
      bannerBody={detail}
      payment={ctx.payment ?? { mode: 'processing' }}
    >
      <OrderBody ctx={ctx} />
    </EmailLayout>,
    buildOrderPlainText({
      greeting: greet(ctx.customerName),
      status: 'Płatność w trakcie realizacji',
      detail,
      ctx: {
        ...ctx,
        payment: ctx.payment ?? { mode: 'processing' },
      },
    })
  );
}

export function buildPaymentFailed(
  ctx: OrderEmailContext
): EmailTemplateResult {
  const subject = `Płatność nieudana — ${ctx.orderReference}`;
  const preheader =
    'Nie udało się dokończyć płatności. Możesz spróbować ponownie.';
  const detail =
    'Płatność nie została zakończona. Jeśli chcesz dokończyć zamówienie, spróbuj ponownie lub skontaktuj się z nami.';

  return pack(
    subject,
    preheader,
    <EmailLayout
      preview={preheader}
      siteUrl={ctx.siteUrl}
      greeting={greet(ctx.customerName)}
      bannerTitle="Płatność nieudana"
      bannerTone="danger"
      bannerBody={detail}
      payment={ctx.payment}
    >
      <OrderBody ctx={ctx} />
    </EmailLayout>,
    buildOrderPlainText({
      greeting: greet(ctx.customerName),
      status: 'Płatność nieudana',
      detail,
      ctx,
    })
  );
}

export function buildCheckoutExpired(
  ctx: OrderEmailContext
): EmailTemplateResult {
  const subject = `Czas na płatność minął — ${ctx.orderReference}`;
  const preheader =
    'Sesja płatności wygasła. Możemy pomóc z nowym zamówieniem.';
  const detail =
    'Czas na dokończenie płatności minął, więc zamówienie nie zostało potwierdzone. Napisz do nas, jeśli chcesz złożyć je ponownie.';

  return pack(
    subject,
    preheader,
    <EmailLayout
      preview={preheader}
      siteUrl={ctx.siteUrl}
      greeting={greet(ctx.customerName)}
      bannerTitle="Czas na płatność minął"
      bannerTone="neutral"
      bannerBody={detail}
      payment={{ mode: 'none' }}
    >
      <OrderBody ctx={ctx} />
    </EmailLayout>,
    buildOrderPlainText({
      greeting: greet(ctx.customerName),
      status: 'Czas na płatność minął',
      detail,
      ctx: { ...ctx, payment: { mode: 'none' } },
    })
  );
}

export function buildRefundInitiated(
  ctx: OrderEmailContext
): EmailTemplateResult {
  const amount =
    typeof ctx.refundAmountGrosz === 'number'
      ? formatMoneyPln(ctx.refundAmountGrosz)
      : formatMoneyPln(ctx.totalGrosz);
  const subject = `Zwrot w drodze — ${ctx.orderReference}`;
  const preheader = `Rozpoczęliśmy zwrot ${amount}.`;
  const detail = `Rozpoczęliśmy zwrot środków (${amount}). Zwykle pojawiają się na koncie w ciągu kilku dni roboczych.`;

  return pack(
    subject,
    preheader,
    <EmailLayout
      preview={preheader}
      siteUrl={ctx.siteUrl}
      greeting={greet(ctx.customerName)}
      bannerTitle="Zwrot w trakcie"
      bannerTone="info"
      bannerBody={detail}
      payment={{ mode: 'none' }}
    >
      <OrderBody ctx={ctx} />
    </EmailLayout>,
    buildOrderPlainText({
      greeting: greet(ctx.customerName),
      status: 'Zwrot w trakcie',
      detail,
      ctx: { ...ctx, payment: { mode: 'none' } },
    })
  );
}

export function buildRefundCompleted(
  ctx: OrderEmailContext
): EmailTemplateResult {
  const amount =
    typeof ctx.refundAmountGrosz === 'number'
      ? formatMoneyPln(ctx.refundAmountGrosz)
      : formatMoneyPln(ctx.totalGrosz);
  const subject = `Zwrot zakończony — ${ctx.orderReference}`;
  const preheader = `Zwrot ${amount} został zrealizowany.`;
  const detail = `Zwrot ${amount} został zakończony. Środki powinny być już widoczne lub pojawią się wkrótce, zależnie od banku.`;

  return pack(
    subject,
    preheader,
    <EmailLayout
      preview={preheader}
      siteUrl={ctx.siteUrl}
      greeting={greet(ctx.customerName)}
      bannerTitle="Zwrot zakończony"
      bannerTone="success"
      bannerBody={detail}
      payment={{ mode: 'none' }}
    >
      <OrderBody ctx={ctx} />
    </EmailLayout>,
    buildOrderPlainText({
      greeting: greet(ctx.customerName),
      status: 'Zwrot zakończony',
      detail,
      ctx: { ...ctx, payment: { mode: 'none' } },
    })
  );
}

export function buildRefundFailed(ctx: OrderEmailContext): EmailTemplateResult {
  const subject = `Problem ze zwrotem — ${ctx.orderReference}`;
  const preheader =
    'Nie udało się automatycznie zakończyć zwrotu. Jesteśmy w kontakcie.';
  const detail =
    'Wystąpił problem przy zwrocie środków. Skontaktujemy się z Tobą, aby dokończyć sprawę ręcznie.';

  return pack(
    subject,
    preheader,
    <EmailLayout
      preview={preheader}
      siteUrl={ctx.siteUrl}
      greeting={greet(ctx.customerName)}
      bannerTitle="Potrzebujemy chwili więcej"
      bannerTone="warning"
      bannerBody={detail}
      payment={{ mode: 'none' }}
    >
      <OrderBody ctx={ctx} />
    </EmailLayout>,
    buildOrderPlainText({
      greeting: greet(ctx.customerName),
      status: 'Problem ze zwrotem',
      detail,
      ctx: { ...ctx, payment: { mode: 'none' } },
    })
  );
}

export function buildAdminPaymentProblem(
  ctx: OrderEmailContext
): EmailTemplateResult {
  const subject = `[Ceramika Nero] Problem z płatnością — ${ctx.orderReference}`;
  const preheader = `${ctx.customerEmail} · ${formatMoneyPln(ctx.totalGrosz)}`;
  const adminUrl = absoluteEmailUrl('/admin/zamowienia', ctx.siteUrl);

  return pack(
    subject,
    preheader,
    <EmailLayout
      preview={preheader}
      siteUrl={ctx.siteUrl}
      bannerTitle="Problem z płatnością"
      bannerTone="danger"
      bannerBody="Wymaga sprawdzenia w panelu."
      payment={ctx.payment}
    >
      <AdminMeta>
        {`Zamówienie: ${ctx.orderReference}\nKlient: ${ctx.customerName}\nE-mail: ${ctx.customerEmail}${
          ctx.adminNotes ? `\nNotatka: ${ctx.adminNotes}` : ''
        }`}
      </AdminMeta>
      <OrderBody ctx={ctx} />
      <PrimaryButton href={adminUrl}>Otwórz w panelu</PrimaryButton>
    </EmailLayout>,
    buildOrderPlainText({
      greeting: 'Problem z płatnością',
      status: ctx.orderReference,
      detail: `Klient: ${ctx.customerName} (${ctx.customerEmail})`,
      ctx,
    }) + `\n\nPanel: ${adminUrl}`
  );
}

export function buildManualTransferRequested(
  ctx: OrderEmailContext
): EmailTemplateResult {
  const subject = `Prośba o przelew — ${ctx.orderReference}`;
  const preheader = `Przelej ${formatMoneyPln(ctx.totalGrosz)} z tytułem zamówienia.`;
  const detail =
    'Prosimy o przelew na konto pracowni. Po zaksięgowaniu potwierdzimy płatność wiadomością.';

  return pack(
    subject,
    preheader,
    <EmailLayout
      preview={preheader}
      siteUrl={ctx.siteUrl}
      greeting={greet(ctx.customerName)}
      bannerTitle="Prosimy o przelew"
      bannerTone="warning"
      bannerBody={detail}
      payment={ctx.payment}
    >
      <OrderBody ctx={ctx} />
    </EmailLayout>,
    buildOrderPlainText({
      greeting: greet(ctx.customerName),
      status: 'Prosimy o przelew',
      detail,
      ctx,
    })
  );
}
