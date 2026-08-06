import { siteContact } from '@/lib/fixtures/navigation';
import { formatPrice } from '@/lib/utils/price';

export type BookingEmailTemplateContext = {
  reference: string;
  workshopTitle: string;
  sessionStartsAt: string;
  sessionLocation: string;
  quantity: number;
  unitPriceGrossGrosz: number;
  totalGrossGrosz: number;
  customerEmail: string;
  customerName: string;
  customerPhone?: string | null;
  customerNotes?: string | null;
  participants: { display_name: string | null; age: number | null }[];
  cancellationUrl?: string;
  siteUrl: string;
};

export function formatWarsawDate(iso: string): string {
  return new Intl.DateTimeFormat('pl-PL', {
    timeZone: 'Europe/Warsaw',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

function participantList(ctx: BookingEmailTemplateContext): string {
  return ctx.participants
    .map(
      (p, i) =>
        `${i + 1}. ${p.display_name ?? 'Uczestnik'}${p.age ? ` (${p.age} l.)` : ''}`
    )
    .join('\n');
}

function legalLinks(siteUrl: string): string {
  const base = siteUrl.replace(/\/$/, '');
  return `${base}/regulamin · ${base}/polityka-prywatnosci`;
}

export function buildCustomerConfirmationEmail(
  ctx: BookingEmailTemplateContext
) {
  const date = formatWarsawDate(ctx.sessionStartsAt);
  const unit = formatPrice(ctx.unitPriceGrossGrosz);
  const total = formatPrice(ctx.totalGrossGrosz);
  const participants = participantList(ctx);
  const subject = `Potwierdzenie rezerwacji ${ctx.reference}`;

  const html = `
    <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; color: #222;">
      <h1 style="font-size: 22px;">Potwierdzenie rezerwacji</h1>
      <p>Dzień dobry ${ctx.customerName},</p>
      <p>Twoja rezerwacja <strong>${ctx.reference}</strong> została zapisana.</p>
      <h2 style="font-size: 18px;">Szczegóły warsztatu</h2>
      <p>
        <strong>${ctx.workshopTitle}</strong><br>
        Data i godzina (Europe/Warsaw): ${date}<br>
        Liczba miejsc: ${ctx.quantity}<br>
        Cena za miejsce: ${unit}<br>
        Razem: ${total}
      </p>
      ${ctx.sessionLocation ? `<p>Miejsce: ${ctx.sessionLocation}</p>` : ''}
      <h2 style="font-size: 18px;">Uczestnicy</h2>
      <p>${participants.replace(/\n/g, '<br>')}</p>
      <h2 style="font-size: 18px;">Płatność</h2>
      <p>
        Prosimy o przelew na konto:<br>
        <strong>${siteContact.bankAccount}</strong><br>
        Odbiorca: ${siteContact.brand}<br>
        Tytuł: ${ctx.reference}
      </p>
      <p>
        Kontakt: <a href="mailto:${siteContact.email}">${siteContact.email}</a>
        · tel. ${siteContact.phoneDisplay}
      </p>
      ${
        ctx.cancellationUrl
          ? `<p><a href="${ctx.cancellationUrl}">Anuluj rezerwację</a> (możliwe do 24 h przed warsztatem)</p>`
          : ''
      }
      <p style="font-size: 12px; color: #666;">Informacje prawne: ${legalLinks(ctx.siteUrl)}</p>
      <p>Do zobaczenia!<br>${siteContact.brand}</p>
    </div>
  `;

  const text = [
    `Potwierdzenie rezerwacji ${ctx.reference}`,
    '',
    `Dzień dobry ${ctx.customerName},`,
    '',
    `Twoja rezerwacja ${ctx.reference} została zapisana.`,
    '',
    `Warsztat: ${ctx.workshopTitle}`,
    `Data (Europe/Warsaw): ${date}`,
    `Liczba miejsc: ${ctx.quantity}`,
    `Cena za miejsce: ${unit}`,
    `Razem: ${total}`,
    ctx.sessionLocation ? `Miejsce: ${ctx.sessionLocation}` : '',
    '',
    'Uczestnicy:',
    participants,
    '',
    'Płatność przelewem:',
    siteContact.bankAccount,
    `Odbiorca: ${siteContact.brand}`,
    `Tytuł: ${ctx.reference}`,
    '',
    `Kontakt: ${siteContact.email}, tel. ${siteContact.phoneDisplay}`,
    ctx.cancellationUrl ? `Anuluj: ${ctx.cancellationUrl}` : '',
    `Prawne: ${legalLinks(ctx.siteUrl)}`,
    '',
    `Do zobaczenia!`,
    siteContact.brand,
  ]
    .filter((line) => line !== '')
    .join('\n');

  return { subject, html, text };
}

export function buildReminderEmail(ctx: BookingEmailTemplateContext) {
  const date = formatWarsawDate(ctx.sessionStartsAt);
  const subject = `Przypomnienie: ${ctx.workshopTitle} już jutro`;
  const participants = participantList(ctx);
  const html = `
    <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; color: #222;">
      <h1 style="font-size: 22px;">Warsztat już jutro</h1>
      <p>Dzień dobry ${ctx.customerName},</p>
      <p>Przypominamy o rezerwacji <strong>${ctx.reference}</strong>.</p>
      <p><strong>${ctx.workshopTitle}</strong><br>Termin: ${date}<br>Miejsce: ${ctx.sessionLocation || '—'}</p>
      <p>Uczestnicy:<br>${participants.replace(/\n/g, '<br>')}</p>
      <p>Do zobaczenia!<br>${siteContact.brand}</p>
    </div>
  `;
  const text = [
    'Warsztat już jutro',
    `Rezerwacja: ${ctx.reference}`,
    `Warsztat: ${ctx.workshopTitle}`,
    `Termin: ${date}`,
    `Miejsce: ${ctx.sessionLocation || '—'}`,
    'Uczestnicy:',
    participants,
    'Do zobaczenia!',
    siteContact.brand,
  ].join('\n');
  return { subject, html, text };
}

export function buildAdminNotificationEmail(ctx: BookingEmailTemplateContext) {
  const date = formatWarsawDate(ctx.sessionStartsAt);
  const total = formatPrice(ctx.totalGrossGrosz);
  const adminBase = ctx.siteUrl.replace(/\/$/, '');
  const subject = `Nowa rezerwacja ${ctx.reference} — ${ctx.workshopTitle}`;

  const html = `
    <div style="font-family: system-ui, sans-serif; max-width: 640px; margin: 0 auto;">
      <h1 style="font-size: 20px;">Nowa rezerwacja</h1>
      <p><strong>Numer:</strong> ${ctx.reference}</p>
      <p><strong>Warsztat:</strong> ${ctx.workshopTitle}<br>
      <strong>Termin:</strong> ${date}<br>
      <strong>Miejsce:</strong> ${ctx.sessionLocation || '—'}</p>
      <p><strong>Klient:</strong> ${ctx.customerName}<br>
      <strong>E-mail:</strong> ${ctx.customerEmail}<br>
      <strong>Telefon:</strong> ${ctx.customerPhone || '—'}</p>
      <p><strong>Liczba miejsc:</strong> ${ctx.quantity}<br>
      <strong>Razem:</strong> ${total}</p>
      ${ctx.customerNotes ? `<p><strong>Notatka:</strong> ${ctx.customerNotes}</p>` : ''}
      <p>Panel: <a href="${adminBase}/admin/rezerwacje">${adminBase}/admin/rezerwacje</a></p>
    </div>
  `;

  const text = [
    `Nowa rezerwacja ${ctx.reference}`,
    `Warsztat: ${ctx.workshopTitle}`,
    `Termin: ${date}`,
    `Miejsce: ${ctx.sessionLocation || '—'}`,
    `Klient: ${ctx.customerName}`,
    `E-mail: ${ctx.customerEmail}`,
    `Telefon: ${ctx.customerPhone || '—'}`,
    `Miejsca: ${ctx.quantity}`,
    `Razem: ${total}`,
    ctx.customerNotes ? `Notatka: ${ctx.customerNotes}` : '',
    `Admin: ${adminBase}/admin/rezerwacje`,
  ]
    .filter(Boolean)
    .join('\n');

  return { subject, html, text };
}

export function buildCancellationEmail(
  ctx: BookingEmailTemplateContext,
  reason?: string
) {
  const date = formatWarsawDate(ctx.sessionStartsAt);
  const amount = formatPrice(ctx.totalGrossGrosz);
  const base = ctx.siteUrl.replace(/\/$/, '');
  const contactUrl = `${base}/kontakt`;
  const subject = `Rezerwacja ${ctx.reference} została anulowana`;

  const html = `
    <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; color: #222;">
      <h1 style="font-size: 22px;">Rezerwacja anulowana</h1>
      <p>Dzień dobry ${ctx.customerName},</p>
      <p>Rezerwacja <strong>${ctx.reference}</strong> na warsztat <strong>${ctx.workshopTitle}</strong> (${date}) została anulowana.</p>
      <p>Kwota: ${amount}</p>
      ${reason ? `<p>Powód: ${reason}</p>` : ''}
      <p>W przypadku zwrotu środki pojawią się na koncie w ciągu kilku dni roboczych.</p>
      <p>Pytania: <a href="${contactUrl}">${contactUrl}</a></p>
      <p style="font-size: 12px; color: #666;">Informacje prawne: ${legalLinks(ctx.siteUrl)}</p>
      <p>${siteContact.brand}</p>
    </div>
  `;

  const text = [
    `Rezerwacja anulowana`,
    '',
    `Dzień dobry ${ctx.customerName},`,
    '',
    `Rezerwacja ${ctx.reference} na ${ctx.workshopTitle} (${date}) została anulowana.`,
    `Kwota: ${amount}`,
    reason ? `Powód: ${reason}` : '',
    'W przypadku zwrotu środki pojawią się na koncie w ciągu kilku dni roboczych.',
    `Kontakt: ${contactUrl}`,
    `Prawne: ${legalLinks(ctx.siteUrl)}`,
    '',
    siteContact.brand,
  ]
    .filter((line) => line !== '')
    .join('\n');

  return { subject, html, text };
}

export function getBookingAdminEmail(): string | null {
  const value = process.env.BOOKING_ADMIN_EMAIL?.trim();
  return value || null;
}

export function getPublicSiteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ||
    'https://ceramikanero.pl'
  );
}
