import * as React from 'react';
import {
  AdminMeta,
  EmailLayout,
  PriceSummary,
} from '@/lib/email/components/EmailLayout';
import { WorkshopDetails, PrimaryButton } from '@/lib/email/components';
import { absoluteEmailUrl, formatMoneyPln } from '@/lib/email/format';
import { buildBookingPlainText } from '@/lib/email/text';
import type {
  BookingEmailContext,
  EmailTemplateResult,
} from '@/lib/email/types';
import { Link, Text } from '@/lib/email/react-email';
import { emailColors } from '@/lib/email/tokens';

function greet(name: string): string {
  const n = name.trim();
  return n ? `Dzień dobry ${n},` : 'Dzień dobry,';
}

function pack(
  subject: string,
  preheader: string,
  react: React.ReactElement,
  text: string
): EmailTemplateResult {
  return { subject, preheader, react, text };
}

function BookingBody({ ctx }: { ctx: BookingEmailContext }) {
  return (
    <>
      <WorkshopDetails
        workshop={{
          title: ctx.workshopTitle,
          startsAt: ctx.sessionStartsAt,
          location: ctx.sessionLocation,
          quantity: ctx.quantity,
          unitPriceGrosz: ctx.unitPriceGrosz,
          participants: ctx.participants,
        }}
      />
      <PriceSummary
        subtotalGrosz={ctx.totalGrosz}
        totalGrosz={ctx.totalGrosz}
      />
      {ctx.customerNotes ? (
        <Text
          style={{
            margin: '0 0 16px',
            fontSize: '13px',
            lineHeight: '20px',
            color: emailColors.muted,
          }}
        >
          Notatka: {ctx.customerNotes}
        </Text>
      ) : null}
      {ctx.cancellationUrl ? (
        <Text
          style={{
            margin: '0 0 16px',
            fontSize: '13px',
            lineHeight: '20px',
            color: emailColors.muted,
          }}
        >
          Możesz anulować rezerwację do 24 h przed warsztatem:{' '}
          <Link
            href={ctx.cancellationUrl}
            style={{ color: emailColors.accent }}
          >
            anuluj rezerwację
          </Link>
        </Text>
      ) : null}
    </>
  );
}

export function buildBookingConfirmation(
  ctx: BookingEmailContext
): EmailTemplateResult {
  const subject = `Potwierdzenie rezerwacji ${ctx.reference}`;
  const preheader = `${ctx.workshopTitle} — zapisaliśmy Twoje miejsce.`;
  const detail = `Twoja rezerwacja ${ctx.reference} została zapisana.`;

  return pack(
    subject,
    preheader,
    <EmailLayout
      preview={preheader}
      siteUrl={ctx.siteUrl}
      greeting={greet(ctx.customerName)}
      bannerTitle="Rezerwacja potwierdzona"
      bannerTone="success"
      bannerBody={detail}
      payment={ctx.payment}
    >
      <BookingBody ctx={ctx} />
    </EmailLayout>,
    buildBookingPlainText({
      greeting: greet(ctx.customerName),
      status: 'Rezerwacja potwierdzona',
      detail,
      ctx,
    })
  );
}

export function buildBookingCancellation(
  ctx: BookingEmailContext
): EmailTemplateResult {
  const subject = `Rezerwacja ${ctx.reference} została anulowana`;
  const preheader = `${ctx.workshopTitle} — rezerwacja anulowana.`;
  const detail = ctx.reason
    ? `Rezerwacja została anulowana. Powód: ${ctx.reason}`
    : 'Rezerwacja została anulowana.';

  return pack(
    subject,
    preheader,
    <EmailLayout
      preview={preheader}
      siteUrl={ctx.siteUrl}
      greeting={greet(ctx.customerName)}
      bannerTitle="Rezerwacja anulowana"
      bannerTone="neutral"
      bannerBody={detail}
      payment={{ mode: 'none' }}
    >
      <BookingBody
        ctx={{ ...ctx, cancellationUrl: null, payment: { mode: 'none' } }}
      />
    </EmailLayout>,
    buildBookingPlainText({
      greeting: greet(ctx.customerName),
      status: 'Rezerwacja anulowana',
      detail,
      ctx: { ...ctx, payment: { mode: 'none' }, cancellationUrl: null },
    })
  );
}

export function buildBookingRefund(
  ctx: BookingEmailContext
): EmailTemplateResult {
  const amount =
    typeof ctx.refundAmountGrosz === 'number'
      ? formatMoneyPln(ctx.refundAmountGrosz)
      : formatMoneyPln(ctx.totalGrosz);
  const subject = `Zwrot za rezerwację ${ctx.reference}`;
  const preheader = `Zwrot ${amount} jest w drodze.`;
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
      <BookingBody ctx={{ ...ctx, payment: { mode: 'none' } }} />
    </EmailLayout>,
    buildBookingPlainText({
      greeting: greet(ctx.customerName),
      status: 'Zwrot w trakcie',
      detail,
      ctx: { ...ctx, payment: { mode: 'none' } },
    })
  );
}

export function buildBookingManualConfirmation(
  ctx: BookingEmailContext
): EmailTemplateResult {
  const subject = `Potwierdzenie rezerwacji ${ctx.reference}`;
  const preheader = 'Potwierdzamy Twoją rezerwację warsztatu.';
  const detail = `Potwierdzamy rezerwację ${ctx.reference} na warsztat „${ctx.workshopTitle}".`;

  return pack(
    subject,
    preheader,
    <EmailLayout
      preview={preheader}
      siteUrl={ctx.siteUrl}
      greeting={greet(ctx.customerName)}
      bannerTitle="Rezerwacja potwierdzona"
      bannerTone="success"
      bannerBody={detail}
      payment={ctx.payment}
    >
      <BookingBody ctx={ctx} />
    </EmailLayout>,
    buildBookingPlainText({
      greeting: greet(ctx.customerName),
      status: 'Rezerwacja potwierdzona',
      detail,
      ctx,
    })
  );
}

export function buildBookingPaymentProblem(
  ctx: BookingEmailContext
): EmailTemplateResult {
  const subject = `Problem z płatnością — ${ctx.reference}`;
  const preheader =
    'Potrzebujemy chwili, aby dokończyć płatność za rezerwację.';
  const detail =
    'Wystąpił problem z płatnością za rezerwację. Możesz spróbować ponownie lub napisać do nas — pomożemy.';

  return pack(
    subject,
    preheader,
    <EmailLayout
      preview={preheader}
      siteUrl={ctx.siteUrl}
      greeting={greet(ctx.customerName)}
      bannerTitle="Problem z płatnością"
      bannerTone="warning"
      bannerBody={detail}
      payment={ctx.payment}
    >
      <BookingBody ctx={ctx} />
    </EmailLayout>,
    buildBookingPlainText({
      greeting: greet(ctx.customerName),
      status: 'Problem z płatnością',
      detail,
      ctx,
    })
  );
}

export function buildBookingAdminNotification(
  ctx: BookingEmailContext
): EmailTemplateResult {
  const subject = `Nowa rezerwacja ${ctx.reference} — ${ctx.workshopTitle}`;
  const preheader = `${ctx.customerName} · ${formatMoneyPln(ctx.totalGrosz)}`;
  const adminUrl = absoluteEmailUrl('/admin/rezerwacje', ctx.siteUrl);

  return pack(
    subject,
    preheader,
    <EmailLayout
      preview={preheader}
      siteUrl={ctx.siteUrl}
      bannerTitle="Nowa rezerwacja"
      bannerTone="info"
      bannerBody={`${ctx.reference} · ${ctx.workshopTitle}`}
      payment={ctx.payment}
    >
      <AdminMeta>
        {`Klient: ${ctx.customerName}\nE-mail: ${ctx.customerEmail}${
          ctx.customerPhone ? `\nTelefon: ${ctx.customerPhone}` : ''
        }${ctx.customerNotes ? `\nNotatka: ${ctx.customerNotes}` : ''}`}
      </AdminMeta>
      <BookingBody ctx={ctx} />
      <PrimaryButton href={adminUrl}>Otwórz w panelu</PrimaryButton>
    </EmailLayout>,
    buildBookingPlainText({
      greeting: 'Nowa rezerwacja',
      status: ctx.reference,
      detail: `Klient: ${ctx.customerName} (${ctx.customerEmail})`,
      ctx,
    }) + `\n\nPanel: ${adminUrl}`
  );
}
