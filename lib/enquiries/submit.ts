'use server';

import 'server-only';
import { z } from 'zod';
import { createHash, randomBytes } from 'node:crypto';
import { createCartAdminClient } from '@/lib/supabase/cart-admin';
import {
  checkBookingRateLimit,
  getRateLimitKeys,
} from '@/lib/booking/rate-limit';

const enquirySchema = z.object({
  offerKey: z.string().max(120).optional().nullable(),
  offerTitle: z.string().max(200).optional().nullable(),
  customerName: z.string().min(2).max(120),
  customerEmail: z.string().email().max(200),
  customerPhone: z.string().max(40).optional().nullable(),
  preferredContact: z
    .enum(['email', 'phone', 'whatsapp'])
    .optional()
    .nullable(),
  eventType: z.string().max(120).optional().nullable(),
  participantCount: z.number().int().positive().max(500).optional().nullable(),
  preferredDateText: z.string().max(200).optional().nullable(),
  message: z.string().min(10).max(4000),
  privacyAccepted: z.literal(true),
  marketingConsent: z.boolean().default(false),
  /** Honeypot — must stay empty */
  companyWebsite: z.string().max(0).optional().nullable(),
});

export type SubmitEnquiryResult =
  { ok: true; reference: string } | { ok: false; error: string };

function enquiryReference(): string {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `ZAP-${stamp}-${randomBytes(3).toString('hex').toUpperCase()}`;
}

export async function submitEnquiry(
  input: z.infer<typeof enquirySchema>
): Promise<SubmitEnquiryResult> {
  const parsed = enquirySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Sprawdź poprawność formularza.' };
  }

  const data = parsed.data;
  if (data.companyWebsite) {
    // Silent success for bots
    return { ok: true, reference: enquiryReference() };
  }

  const { ipKey, secondaryKey } = await getRateLimitKeys({
    sessionId: 'enquiry',
    email: data.customerEmail,
  });
  const limit = await checkBookingRateLimit(ipKey, secondaryKey);
  if (!limit.success) {
    return {
      ok: false,
      error: 'Zbyt wiele prób. Spróbuj ponownie za chwilę.',
    };
  }

  const reference = enquiryReference();
  const supabase = createCartAdminClient();

  const { data: row, error } = await supabase
    .from('enquiries')
    .insert({
      reference,
      status: 'new',
      offer_key: data.offerKey || null,
      offer_title: data.offerTitle || null,
      customer_name: data.customerName.trim(),
      customer_email: data.customerEmail.trim().toLowerCase(),
      customer_phone: data.customerPhone?.trim() || null,
      preferred_contact: data.preferredContact || null,
      event_type: data.eventType || null,
      participant_count: data.participantCount ?? null,
      preferred_date_text: data.preferredDateText || null,
      message: data.message.trim(),
      privacy_accepted_at: new Date().toISOString(),
      marketing_consent: data.marketingConsent,
      source: 'website',
    })
    .select('id')
    .maybeSingle();

  if (error || !row) {
    console.error('enquiry insert failed', {
      code: error?.code,
      // fingerprint only — no PII
      fingerprint: createHash('sha256')
        .update(data.customerEmail.trim().toLowerCase())
        .digest('hex')
        .slice(0, 12),
    });
    return {
      ok: false,
      error:
        'Nie udało się wysłać zapytania. Spróbuj ponownie lub napisz e-mail.',
    };
  }

  await supabase.from('enquiry_events').insert({
    enquiry_id: row.id,
    event_type: 'created',
    actor_type: 'customer',
    metadata: { offer_key: data.offerKey || null },
  });

  const adminEmail = process.env.BOOKING_ADMIN_EMAIL?.trim();
  if (adminEmail) {
    try {
      const { deliverBookingEmail } =
        await import('@/lib/booking/email-transport');
      const text = [
        `Nowe zapytanie ${reference}`,
        data.offerTitle || data.offerKey
          ? `Oferta: ${data.offerTitle || data.offerKey}`
          : null,
        `Od: ${data.customerName}`,
        `E-mail: ${data.customerEmail}`,
        data.customerPhone ? `Telefon: ${data.customerPhone}` : null,
        '',
        data.message,
      ]
        .filter(Boolean)
        .join('\n');
      await deliverBookingEmail({
        bookingId: row.id,
        type: 'enquiry_admin_notification',
        to: adminEmail,
        subject: `Nowe zapytanie ${reference}`,
        text,
        html: `<pre style="font-family:sans-serif;white-space:pre-wrap">${text
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')}</pre>`,
      });
    } catch (err) {
      console.error('enquiry admin notify failed', err);
    }
  }

  return { ok: true, reference };
}
