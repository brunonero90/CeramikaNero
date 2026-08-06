'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { useLocalCart } from '@/components/clone/local-cart';
import { submitCartOrder } from '@/lib/cart/checkout';
import {
  revalidateCartLines,
  type RevalidatedCart,
} from '@/lib/cart/revalidate';
import {
  validateVoucherForCheckout,
  type VoucherCheckoutPreview,
} from '@/lib/vouchers/checkout';
import { formatPrice } from '@/lib/utils/price';
import type { CartLine, CartLineWorkshop } from '@/lib/cart/types';

type Participant = {
  display_name: string;
  age: string;
  participant_type: 'adult' | 'child' | 'unspecified';
  accessibility_notes: string;
};

type PaymentOptions = {
  mode: 'manual' | 'stripe' | 'both' | 'unavailable';
  stripeAvailable: boolean;
  showMethodSelector: boolean;
};

function normalizeVoucherCode(code: string): string {
  return code.trim().replace(/\s+/g, '').toUpperCase();
}

function formatExpiry(value: string | null): string {
  if (!value) return 'bez terminu ważności';
  return new Intl.DateTimeFormat('pl-PL', {
    dateStyle: 'long',
    timeZone: 'Europe/Warsaw',
  }).format(new Date(value));
}

function formatFollowupDate(value: string): string {
  return new Intl.DateTimeFormat('pl-PL', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'Europe/Warsaw',
  }).format(new Date(value));
}

export function CheckoutPageClient({
  paymentOptions,
}: {
  paymentOptions: PaymentOptions;
}) {
  const { lines, clear, ready } = useLocalCart();
  const [validated, setValidated] = useState<RevalidatedCart | null>(null);
  const [isPending, startTransition] = useTransition();
  const [voucherChecking, startVoucherTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  const [submissionKey] = useState(() => {
    const storageKey = 'ceramika-checkout-submission-key';
    if (typeof window === 'undefined') return crypto.randomUUID();
    const existing = window.sessionStorage.getItem(storageKey);
    if (existing) return existing;
    const created = crypto.randomUUID();
    window.sessionStorage.setItem(storageKey, created);
    return created;
  });
  const [paymentMethod, setPaymentMethod] = useState<
    'stripe' | 'bank_transfer'
  >(
    paymentOptions.mode === 'manual' || !paymentOptions.stripeAvailable
      ? 'bank_transfer'
      : 'stripe'
  );

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [participantsBySession, setParticipantsBySession] = useState<
    Record<string, Participant[]>
  >({});
  const [followupByPrimary, setFollowupByPrimary] = useState<
    Record<string, string>
  >({});

  const [hasVoucher, setHasVoucher] = useState(false);
  const [voucherProvider, setVoucherProvider] = useState('auto');
  const [voucherCode, setVoucherCode] = useState('');
  const [voucherPreview, setVoucherPreview] =
    useState<VoucherCheckoutPreview | null>(null);
  const [validatedVoucherCode, setValidatedVoucherCode] = useState('');
  const [voucherError, setVoucherError] = useState<string | null>(null);

  const [recipientName, setRecipientName] = useState('');
  const [street, setStreet] = useState('');
  const [street2, setStreet2] = useState('');
  const [postal, setPostal] = useState('');
  const [city, setCity] = useState('');

  const needsShipping = useMemo(
    () =>
      (validated?.lines ?? lines).some(
        (line) =>
          (line.type === 'physical_product' ||
            line.type === 'studio_service') &&
          line.fulfillment === 'shipping' &&
          ('requiresShipping' in line ? line.requiresShipping : true)
      ),
    [validated, lines]
  );

  const expandedLines = useMemo<CartLine[]>(() => {
    if (!validated) return [];
    const result: CartLine[] = [];
    for (const line of validated.lines) {
      if (
        line.type !== 'workshop_session' ||
        (!line.offersFollowupSession && !line.requiresFollowupSession)
      ) {
        result.push(line);
        continue;
      }
      const selected = (line.followupOptions ?? []).find(
        (option) => option.sessionId === followupByPrimary[line.sessionId]
      );
      if (!selected) {
        result.push({ ...line, linkRole: 'primary' });
        continue;
      }
      const groupKey = `${line.sessionId}:${selected.sessionId}`;
      result.push({ ...line, linkRole: 'primary', linkGroupKey: groupKey });
      const followup: CartLineWorkshop = {
        type: 'workshop_session',
        key: `followup:${line.sessionId}:${selected.sessionId}`,
        sessionId: selected.sessionId,
        workshopId: selected.workshopId,
        workshopSlug: selected.workshopSlug,
        workshopTitle: selected.workshopTitle,
        startsAt: selected.startsAt,
        timezone: selected.timezone,
        venueKey: selected.venueKey,
        locationName: selected.locationName,
        locationAddress: selected.locationAddress,
        quantity: line.quantity,
        unitPriceHintGrosz: selected.unitPriceGrosz,
        linkRole: 'followup',
        linkedPrimarySessionId: line.sessionId,
        linkGroupKey: groupKey,
      };
      result.push(followup);
    }
    return result;
  }, [validated, followupByPrimary]);

  const followupComplete = useMemo(
    () =>
      (validated?.lines ?? []).every(
        (line) =>
          line.type !== 'workshop_session' ||
          !line.requiresFollowupSession ||
          Boolean(followupByPrimary[line.sessionId])
      ),
    [validated, followupByPrimary]
  );

  const checkoutSubtotalGrosz = useMemo(
    () =>
      expandedLines.reduce(
        (sum, line) => sum + line.unitPriceHintGrosz * line.quantity,
        0
      ),
    [expandedLines]
  );

  const voucherEligibleCart = useMemo(
    () =>
      followupComplete &&
      expandedLines.length > 0 &&
      expandedLines.every((line) => line.type === 'workshop_session'),
    [expandedLines, followupComplete]
  );

  const voucherFullyPays = voucherPreview?.amountDueGrosz === 0;
  const paymentUnavailable =
    paymentOptions.mode === 'unavailable' && !voucherFullyPays;

  useEffect(() => {
    if (!ready || redirecting) return;
    startTransition(async () => {
      const result = await revalidateCartLines(lines);
      setValidated(result);
      const next: Record<string, Participant[]> = {};
      for (const line of result.lines) {
        if (line.type !== 'workshop_session') continue;
        next[line.sessionId] = Array.from({ length: line.quantity }, () => ({
          display_name: '',
          age: '',
          participant_type: 'unspecified' as const,
          accessibility_notes: '',
        }));
      }
      setParticipantsBySession(next);
      const followups: Record<string, string> = {};
      for (const line of result.lines) {
        if (
          line.type === 'workshop_session' &&
          (line.offersFollowupSession || line.requiresFollowupSession)
        ) {
          followups[line.sessionId] = '';
        }
      }
      setFollowupByPrimary(followups);
      setVoucherPreview(null);
      setValidatedVoucherCode('');
      setVoucherError(null);
    });
  }, [ready, lines, redirecting]);

  function updateParticipant(
    sessionId: string,
    index: number,
    field: keyof Participant,
    value: string
  ) {
    setParticipantsBySession((previous) => {
      const list = [...(previous[sessionId] ?? [])];
      list[index] = { ...list[index], [field]: value };
      return { ...previous, [sessionId]: list };
    });
  }

  function resetVoucherValidation() {
    setVoucherPreview(null);
    setValidatedVoucherCode('');
    setVoucherError(null);
  }

  function checkVoucher() {
    if (!validated?.canCheckout) {
      setVoucherError('Najpierw popraw niedostępne pozycje w koszyku.');
      return;
    }
    if (!followupComplete) {
      setVoucherError('Wybierz obowiązkowy termin drugiego etapu warsztatu.');
      return;
    }
    if (!voucherEligibleCart) {
      setVoucherError('Bon można wykorzystać wyłącznie na warsztaty.');
      return;
    }
    const normalized = normalizeVoucherCode(voucherCode);
    if (normalized.length < 4) {
      setVoucherError('Wpisz kod bonu.');
      return;
    }

    startVoucherTransition(async () => {
      setVoucherError(null);
      const result = await validateVoucherForCheckout({
        code: normalized,
        providerCode: voucherProvider,
        purchaserEmail: email || null,
        lines: expandedLines,
      });
      if (!result.ok) {
        setVoucherPreview(null);
        setValidatedVoucherCode('');
        setVoucherError(result.error);
        return;
      }
      setVoucherPreview(result.voucher);
      setValidatedVoucherCode(normalized);
    });
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!validated?.canCheckout) {
      setError('Koszyk zawiera niedostępne pozycje.');
      return;
    }
    if (!followupComplete) {
      setError(
        'Wybierz obowiązkowy termin szkliwienia przed złożeniem rezerwacji.'
      );
      return;
    }
    if (paymentUnavailable) {
      setError(
        'Płatności są tymczasowo niedostępne. Bon musi pokrywać całą kwotę.'
      );
      return;
    }
    if (hasVoucher) {
      const normalized = normalizeVoucherCode(voucherCode);
      if (!voucherPreview || validatedVoucherCode !== normalized) {
        setError('Sprawdź bon przed złożeniem rezerwacji.');
        return;
      }
    }
    if (!terms) {
      setError('Zaakceptuj regulamin i politykę prywatności.');
      return;
    }

    startTransition(async () => {
      setError(null);
      const checkoutParticipants: Record<string, Participant[]> = {};
      for (const line of validated.lines) {
        if (line.type !== 'workshop_session') continue;
        const source = participantsBySession[line.sessionId] ?? [];
        const participants = source.map((participant, index) => {
          if (line.participantAudience === 'adult') {
            return {
              ...participant,
              display_name:
                index === 0
                  ? `${firstName} ${lastName}`.trim()
                  : participant.display_name,
              age: '',
              participant_type: 'adult' as const,
            };
          }
          if (line.participantAudience === 'child') {
            return { ...participant, participant_type: 'child' as const };
          }
          return participant;
        });
        checkoutParticipants[line.sessionId] = participants;
        const selectedFollowup = followupByPrimary[line.sessionId];
        if (selectedFollowup) {
          checkoutParticipants[selectedFollowup] = participants.map(
            (participant) => ({
              ...participant,
            })
          );
        }
      }

      const result = await submitCartOrder({
        purchaserFirstName: firstName,
        purchaserLastName: lastName,
        purchaserEmail: email,
        purchaserPhone: phone,
        customerNotes: notes,
        marketingConsent: marketing,
        termsAccepted: true as const,
        privacyPolicyVersion: '1.0',
        submissionKey,
        participantsBySession: checkoutParticipants,
        voucherCode:
          hasVoucher && voucherPreview
            ? normalizeVoucherCode(voucherCode)
            : null,
        voucherProviderCode:
          hasVoucher && voucherPreview ? voucherPreview.providerCode : null,
        paymentMethod:
          paymentOptions.mode === 'both'
            ? paymentMethod
            : paymentOptions.mode === 'stripe'
              ? 'stripe'
              : 'bank_transfer',
        shipping: needsShipping
          ? {
              recipient_name: recipientName,
              street_line1: street,
              street_line2: street2 || null,
              postal_code: postal,
              city,
              country: 'PL' as const,
              phone: phone || null,
            }
          : null,
        lines: validated.lines,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setRedirecting(true);
      window.sessionStorage.removeItem('ceramika-checkout-submission-key');
      const destination = result.checkoutUrl
        ? result.checkoutUrl
        : result.publicLookupToken
          ? `/zamowienie/${encodeURIComponent(result.publicLookupToken)}`
          : (() => {
              const params = new URLSearchParams({
                reference: result.orderReference,
                total: String(result.totalGrossGrosz),
              });
              if (result.bookingReferences.length) {
                params.set('bookings', result.bookingReferences.join(','));
              }
              if (result.shippingQuoteRequired) {
                params.set('shipping_quote', '1');
              }
              if (result.voucherAppliedGrosz) {
                params.set('voucher', String(result.voucherAppliedGrosz));
              }
              return `/cart/sukces?${params.toString()}`;
            })();

      clear();
      window.location.assign(destination);
    });
  }

  if (redirecting) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="text-2xl font-semibold">Zamówienie</h1>
        <p className="mt-4 text-text-muted">
          Zamówienie przyjęte — przekierowujemy do potwierdzenia…
        </p>
      </main>
    );
  }

  if (ready && lines.length === 0) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="text-2xl font-semibold">Zamówienie</h1>
        <p className="mt-4 text-text-muted">Koszyk jest pusty.</p>
        <Link href="/cart" className="mt-4 inline-block underline">
          Wróć do koszyka
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-12 md:px-6">
      <h1 className="font-heading text-3xl font-semibold">Zamówienie</h1>
      <p className="mt-2 text-sm text-text-muted">
        {voucherFullyPays
          ? 'Bon pokrywa całą kwotę. Rezerwacja zostanie potwierdzona bez dodatkowej płatności.'
          : paymentOptions.mode === 'unavailable'
            ? 'Płatności są tymczasowo niedostępne. Możesz użyć bonu pokrywającego całą kwotę.'
            : paymentOptions.mode === 'stripe' && paymentOptions.stripeAvailable
              ? 'Po złożeniu zamówienia przejdziesz do bezpiecznej płatności online (karta, BLIK, Przelewy24).'
              : paymentOptions.showMethodSelector
                ? 'Wybierz metodę płatności. Kwoty i dostępność weryfikujemy po stronie serwera.'
                : 'Składasz zamówienie z płatnością przelewem bankowym.'}
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-6">
        {paymentOptions.showMethodSelector && !voucherFullyPays ? (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Metoda płatności</h2>
            <label className="flex items-start gap-3 text-sm">
              <input
                type="radio"
                name="paymentMethod"
                className="mt-1"
                checked={paymentMethod === 'stripe'}
                onChange={() => setPaymentMethod('stripe')}
              />
              <span>
                <strong>Płatność online</strong>
                <span className="block text-text-muted">
                  Karta, BLIK lub Przelewy24 przez Stripe.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-3 text-sm">
              <input
                type="radio"
                name="paymentMethod"
                className="mt-1"
                checked={paymentMethod === 'bank_transfer'}
                onChange={() => setPaymentMethod('bank_transfer')}
              />
              <span>
                <strong>Przelew bankowy</strong>
                <span className="block text-text-muted">
                  Otrzymasz dane do przelewu w e-mailu.
                </span>
              </span>
            </label>
          </section>
        ) : null}

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Dane kupującego</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              Imię
              <input
                required
                autoComplete="given-name"
                className="mt-1 w-full border px-3 py-2"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
              />
            </label>
            <label className="text-sm">
              Nazwisko
              <input
                required
                autoComplete="family-name"
                className="mt-1 w-full border px-3 py-2"
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
              />
            </label>
          </div>
          <label className="block text-sm">
            E-mail
            <input
              required
              type="email"
              autoComplete="email"
              className="mt-1 w-full border px-3 py-2"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label className="block text-sm">
            Telefon
            <input
              required
              type="tel"
              autoComplete="tel"
              className="mt-1 w-full border px-3 py-2"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
          </label>
        </section>

        {(validated?.lines ?? [])
          .filter((line) => line.type === 'workshop_session')
          .map((line) => {
            if (line.type !== 'workshop_session') return null;
            const participants = participantsBySession[line.sessionId] ?? [];
            const adult = line.participantAudience === 'adult';
            if (adult && line.quantity === 1) {
              return (
                <section
                  key={line.key}
                  className="space-y-2 rounded border p-3"
                >
                  <h2 className="text-lg font-semibold">
                    Uczestnik — {line.workshopTitle}
                  </h2>
                  <p className="text-sm text-text-muted">
                    Użyjemy imienia i nazwiska z danych kupującego. Nie musisz
                    wpisywać ich drugi raz.
                  </p>
                  <label className="block text-sm">
                    Ważne informacje organizacyjne / potrzeby dostępności
                    <textarea
                      className="mt-1 w-full border px-3 py-2"
                      rows={2}
                      maxLength={500}
                      value={participants[0]?.accessibility_notes ?? ''}
                      onChange={(event) =>
                        updateParticipant(
                          line.sessionId,
                          0,
                          'accessibility_notes',
                          event.target.value
                        )
                      }
                    />
                    <span className="mt-1 block text-xs text-text-muted">
                      Podaj tylko informacje potrzebne do organizacji warsztatu.
                      Nie wysyłaj diagnoz ani numerów dokumentów.
                    </span>
                  </label>
                </section>
              );
            }
            return (
              <section key={line.key} className="space-y-3">
                <h2 className="text-lg font-semibold">
                  {adult ? 'Pozostali uczestnicy' : 'Uczestnicy'} —{' '}
                  {line.workshopTitle}
                </h2>
                {adult ? (
                  <>
                    <p className="text-sm text-text-muted">
                      Pierwsze miejsce przypisujemy osobie kupującej. Podaj
                      tylko pozostałych uczestników.
                    </p>
                    <div className="rounded border p-3">
                      <p className="mb-2 text-sm font-medium">
                        Osoba kupująca: {firstName || '—'} {lastName || ''}
                      </p>
                      <label className="block text-sm">
                        Ważne informacje organizacyjne / potrzeby dostępności
                        <textarea
                          className="mt-1 w-full border px-3 py-2"
                          rows={2}
                          maxLength={500}
                          value={participants[0]?.accessibility_notes ?? ''}
                          onChange={(event) =>
                            updateParticipant(
                              line.sessionId,
                              0,
                              'accessibility_notes',
                              event.target.value
                            )
                          }
                        />
                        <span className="mt-1 block text-xs text-text-muted">
                          Podaj tylko informacje potrzebne do organizacji
                          warsztatu. Nie wysyłaj diagnoz ani numerów dokumentów.
                        </span>
                      </label>
                    </div>
                  </>
                ) : null}
                {participants.map((participant, index) => {
                  if (adult && index === 0) return null;
                  const child =
                    line.participantAudience === 'child' ||
                    (line.participantAudience === 'mixed' &&
                      participant.participant_type === 'child');
                  return (
                    <div
                      key={`${line.sessionId}-${index}`}
                      className="grid gap-2 border p-3 sm:grid-cols-2"
                    >
                      {line.participantAudience === 'mixed' ? (
                        <label className="text-sm">
                          Uczestnik
                          <select
                            required
                            className="mt-1 w-full border px-3 py-2"
                            value={participant.participant_type}
                            onChange={(event) =>
                              updateParticipant(
                                line.sessionId,
                                index,
                                'participant_type',
                                event.target.value
                              )
                            }
                          >
                            <option value="unspecified">Wybierz</option>
                            <option value="adult">Dorosły</option>
                            <option value="child">Dziecko</option>
                          </select>
                        </label>
                      ) : null}
                      <label className="text-sm">
                        Imię uczestnika
                        <input
                          required
                          className="mt-1 w-full border px-3 py-2"
                          value={participant.display_name}
                          onChange={(event) =>
                            updateParticipant(
                              line.sessionId,
                              index,
                              'display_name',
                              event.target.value
                            )
                          }
                        />
                      </label>
                      {line.collectParticipantAge && child ? (
                        <label className="text-sm">
                          Wiek dziecka
                          <input
                            type="number"
                            min={line.minimumAge ?? 0}
                            max={line.maximumAge ?? 17}
                            required
                            className="mt-1 w-full border px-3 py-2"
                            value={participant.age}
                            onChange={(event) =>
                              updateParticipant(
                                line.sessionId,
                                index,
                                'age',
                                event.target.value
                              )
                            }
                          />
                        </label>
                      ) : null}
                      <label className="text-sm sm:col-span-2">
                        Ważne informacje organizacyjne / potrzeby dostępności
                        <textarea
                          className="mt-1 w-full border px-3 py-2"
                          rows={2}
                          maxLength={500}
                          value={participant.accessibility_notes}
                          onChange={(event) =>
                            updateParticipant(
                              line.sessionId,
                              index,
                              'accessibility_notes',
                              event.target.value
                            )
                          }
                        />
                      </label>
                    </div>
                  );
                })}
              </section>
            );
          })}

        {(validated?.lines ?? [])
          .filter(
            (line) =>
              line.type === 'workshop_session' &&
              (line.offersFollowupSession || line.requiresFollowupSession)
          )
          .map((line) =>
            line.type === 'workshop_session' ? (
              <section
                key={`followup-picker-${line.sessionId}`}
                className="space-y-3 rounded border border-accent-primary/30 bg-surface-raised p-4"
              >
                <h2 className="text-lg font-semibold">
                  {line.requiresFollowupSession
                    ? 'Drugi etap — szkliwienie'
                    : 'Opcjonalne szkliwienie'}
                </h2>
                <p className="text-sm text-text-muted">
                  {line.requiresFollowupSession
                    ? 'Ten warsztat wymaga drugiego spotkania. Zarezerwujemy tę samą liczbę miejsc w obu terminach w jednym zamówieniu.'
                    : 'Możesz od razu zarezerwować późniejszy termin szkliwienia albo wrócić do tego później.'}
                </p>
                <label className="block text-sm">
                  Wybierz termin szkliwienia
                  <select
                    required
                    className="mt-1 w-full border px-3 py-2"
                    value={followupByPrimary[line.sessionId] ?? ''}
                    onChange={(event) => {
                      setFollowupByPrimary((previous) => ({
                        ...previous,
                        [line.sessionId]: event.target.value,
                      }));
                      resetVoucherValidation();
                    }}
                  >
                    <option value="">
                      {line.requiresFollowupSession
                        ? 'Wybierz termin'
                        : 'Nie rezerwuję teraz'}
                    </option>
                    {(line.followupOptions ?? []).map((option) => (
                      <option key={option.sessionId} value={option.sessionId}>
                        {formatFollowupDate(option.startsAt)} ·{' '}
                        {option.workshopTitle} ·{' '}
                        {option.unitPriceGrosz > 0
                          ? formatPrice(option.unitPriceGrosz * line.quantity)
                          : 'w cenie'}
                      </option>
                    ))}
                  </select>
                </label>
                {!line.requiresFollowupSession &&
                (line.followupOptions ?? []).length === 0 ? (
                  <p className="text-sm text-text-muted">
                    Obecnie nie ma dostępnych terminów szkliwienia. Możesz
                    zarezerwować pierwszy etap bez drugiego spotkania.
                  </p>
                ) : null}
              </section>
            ) : null
          )}

        <section className="space-y-3 rounded border border-surface-subtle bg-surface-raised p-4">
          <label className="flex items-start gap-3 text-sm font-medium">
            <input
              type="checkbox"
              className="mt-1"
              checked={hasVoucher}
              disabled={!voucherEligibleCart}
              onChange={(event) => {
                setHasVoucher(event.target.checked);
                if (!event.target.checked) {
                  setVoucherCode('');
                  resetVoucherValidation();
                }
              }}
            />
            <span>
              Mam bon upominkowy
              {!voucherEligibleCart ? (
                <span className="block font-normal text-text-muted">
                  Bony można obecnie stosować tylko do warsztatów.
                </span>
              ) : null}
            </span>
          </label>

          {hasVoucher ? (
            <div className="space-y-3">
              <label className="block text-sm">
                Wystawca bonu
                <select
                  className="mt-1 w-full border px-3 py-2"
                  value={voucherProvider}
                  onChange={(event) => {
                    setVoucherProvider(event.target.value);
                    resetVoucherValidation();
                  }}
                >
                  <option value="auto">Rozpoznaj automatycznie</option>
                  <option value="ceramika_nero">Ceramika Nero</option>
                  <option value="prezent_marzen">Prezent Marzeń</option>
                </select>
              </label>
              <div className="flex gap-2">
                <label className="min-w-0 flex-1 text-sm">
                  Kod bonu
                  <input
                    className="mt-1 w-full border px-3 py-2 font-mono uppercase"
                    value={voucherCode}
                    autoComplete="off"
                    onChange={(event) => {
                      setVoucherCode(event.target.value);
                      resetVoucherValidation();
                    }}
                    onBlur={() => {
                      if (
                        normalizeVoucherCode(voucherCode).length >= 4 &&
                        !voucherPreview &&
                        !voucherChecking
                      ) {
                        checkVoucher();
                      }
                    }}
                  />
                </label>
                <button
                  type="button"
                  disabled={voucherChecking || !voucherCode.trim()}
                  onClick={checkVoucher}
                  className="self-end border border-accent-primary px-4 py-2 text-sm font-semibold text-accent-primary disabled:opacity-50"
                >
                  {voucherChecking ? 'Sprawdzanie…' : 'Sprawdź bon'}
                </button>
              </div>

              {voucherError ? (
                <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-800">
                  {voucherError}
                </p>
              ) : null}

              {voucherPreview ? (
                <div className="space-y-1 rounded bg-green-50 px-3 py-3 text-sm text-green-950">
                  <p className="font-semibold">Bon został zastosowany</p>
                  <p>
                    {voucherPreview.providerName} · {voucherPreview.maskedCode}
                  </p>
                  {voucherPreview.description ? (
                    <p>{voucherPreview.description}</p>
                  ) : null}
                  <p>Ważny: {formatExpiry(voucherPreview.validUntil)}</p>
                  {voucherPreview.allowedWorkshopTypes.length ? (
                    <p>
                      Ograniczenia:{' '}
                      {voucherPreview.allowedWorkshopTypes.join(', ')}
                    </p>
                  ) : (
                    <p>Bez ograniczeń typu warsztatu.</p>
                  )}
                  <p>
                    Dostępne saldo:{' '}
                    {formatPrice(voucherPreview.remainingValueGrosz)}
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}
        </section>

        {needsShipping ? (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Adres dostawy</h2>
            <p className="text-sm text-text-muted">
              Wymagany, ponieważ koszyk zawiera produkt z wysyłką do domu.
            </p>
            <label className="block text-sm">
              Odbiorca
              <input
                required
                className="mt-1 w-full border px-3 py-2"
                value={recipientName}
                onChange={(event) => setRecipientName(event.target.value)}
              />
            </label>
            <label className="block text-sm">
              Ulica i numer
              <input
                required
                className="mt-1 w-full border px-3 py-2"
                value={street}
                onChange={(event) => setStreet(event.target.value)}
              />
            </label>
            <label className="block text-sm">
              Numer mieszkania (opcjonalnie)
              <input
                className="mt-1 w-full border px-3 py-2"
                value={street2}
                onChange={(event) => setStreet2(event.target.value)}
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                Kod pocztowy
                <input
                  required
                  className="mt-1 w-full border px-3 py-2"
                  value={postal}
                  onChange={(event) => setPostal(event.target.value)}
                />
              </label>
              <label className="text-sm">
                Miasto
                <input
                  required
                  className="mt-1 w-full border px-3 py-2"
                  value={city}
                  onChange={(event) => setCity(event.target.value)}
                />
              </label>
            </div>
            <p className="text-sm text-amber-900">
              Wysyłka na terenie Polski. Koszt dostawy — wycena przed
              płatnością.
            </p>
          </section>
        ) : null}

        <label className="block text-sm">
          Uwagi
          <textarea
            className="mt-1 w-full border px-3 py-2"
            rows={3}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </label>

        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={terms}
            onChange={(event) => setTerms(event.target.checked)}
            required
          />
          <span>
            Akceptuję{' '}
            <Link href="/regulamin" className="underline">
              regulamin
            </Link>{' '}
            i{' '}
            <Link href="/polityka-prywatnosci" className="underline">
              politykę prywatności
            </Link>
            .
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={marketing}
            onChange={(event) => setMarketing(event.target.checked)}
          />
          <span>Chcę otrzymywać informacje o warsztatach (opcjonalnie).</span>
        </label>

        <div className="space-y-2 rounded border border-surface-subtle bg-surface-raised p-4 text-sm">
          <p className="flex justify-between gap-3">
            <span>Suma pozycji</span>
            <span className="font-semibold">
              {formatPrice(checkoutSubtotalGrosz)}
            </span>
          </p>
          {voucherPreview ? (
            <p className="flex justify-between gap-3 text-green-800">
              <span>Bon {voucherPreview.maskedCode}</span>
              <span>−{formatPrice(voucherPreview.applicableGrosz)}</span>
            </p>
          ) : null}
          {needsShipping ? (
            <>
              <p className="flex justify-between gap-3 text-amber-900">
                <span>Wysyłka</span>
                <span>do potwierdzenia</span>
              </p>
              <p className="text-amber-900">
                Koszt wysyłki zostanie potwierdzony przed płatnością.
              </p>
            </>
          ) : (
            <p className="flex justify-between gap-3 text-base font-semibold">
              <span>
                {voucherFullyPays ? 'Pozostało do zapłaty' : 'Do zapłaty'}
              </span>
              <span>
                {formatPrice(
                  voucherPreview?.amountDueGrosz ?? checkoutSubtotalGrosz
                )}
              </span>
            </p>
          )}
        </div>

        {error ? (
          <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={
            isPending ||
            voucherChecking ||
            !validated?.canCheckout ||
            !followupComplete ||
            paymentUnavailable
          }
          className="w-full bg-accent-primary px-4 py-3 text-sm font-semibold text-white disabled:bg-gray-400"
        >
          {isPending
            ? 'Składanie zamówienia…'
            : voucherFullyPays
              ? 'Potwierdź rezerwację z bonem'
              : 'Złóż zamówienie i rezerwację'}
        </button>
      </form>
    </main>
  );
}
