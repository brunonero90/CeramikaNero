# Ceramika Nero — Privacy and Data Handling

This document describes how personal data is handled by the booking and payment system.

## What personal data is collected

### Purchaser

| Field                  | Purpose                                    | Retention                                            |
| ---------------------- | ------------------------------------------ | ---------------------------------------------------- |
| First name             | Communication, identification              | Until booking lifecycle + reasonable business period |
| Last name              | Communication, identification              | Until booking lifecycle + reasonable business period |
| Email                  | Booking confirmation, cancellation, refund | Until booking lifecycle + reasonable business period |
| Phone                  | Operational contact and support            | Until booking lifecycle + reasonable business period |
| Marketing consent      | Consent for future marketing               | Until consent is withdrawn                           |
| Consent timestamp      | Proof of consent                           | Until consent record is deleted                      |
| Privacy policy version | Proof of which policy was accepted         | Until consent record is deleted                      |

### Participants

| Field               | Purpose                            | Retention                                            |
| ------------------- | ---------------------------------- | ---------------------------------------------------- |
| Display name        | Workshop attendance list           | Until booking lifecycle + reasonable business period |
| Age                 | Validate workshop age requirements | Until booking lifecycle + reasonable business period |
| Accessibility notes | Provide reasonable accommodations  | Until booking lifecycle + reasonable business period |

### Not collected

- Dates of birth
- Home addresses
- ID numbers
- Payment card numbers (handled by Stripe)
- Passwords or Auth accounts for guests

## Who can access booking data

- The customer: only through secure, scoped links (Stripe Checkout Session ID or validated reference).
- Studio owner and managers: full operational access via the admin panel.
- Editors: no access to bookings or payments.
- The public: no access to any booking, payment or customer data.
- Stripe: processes payment information; the system only sends safe identifiers in metadata.
- Resend: handles email delivery; the system only sends necessary content (no unnecessary participant data).

## Stripe data flow

- The browser is redirected to Stripe Checkout. Card data is entered on Stripe's hosted page.
- The application stores only the Stripe Checkout Session ID, Payment Intent ID, amount, currency and status.
- Stripe metadata contains only: booking UUID, booking reference, payment ID, environment marker.
- No participant names, ages, phone numbers or emails are sent to Stripe metadata.

## Resend data flow

- Resend receives the recipient email, subject, plain-text and HTML content.
- Emails contain the booking reference, workshop/session details, Europe/Warsaw time, location, participant count, amount and cancellation link.
- Resend message IDs are stored for delivery tracking.
- Resend API keys and full email contents are never logged.

## Cookies and tracking

- Guest checkout does not create a Supabase Auth account and therefore does not store authentication cookies.
- Rate limiting uses a hash of the IP/email, not the raw IP address, where possible. Raw IPs are not retained longer than the rate-limit window.
- No personal data is placed in analytics events.

## Marketing consent

- Marketing consent is optional and unchecked by default.
- It is separate from the required booking terms/privacy consent.
- Consent is recorded with a timestamp and the relevant privacy policy version.
- Withdrawing consent must be handled by contacting the studio.

## Data retention and deletion

- This phase does not automatically delete financial or booking records.
- A future anonymisation process should:
  - Remove or hash names, emails and phone numbers after the statutory retention period.
  - Preserve booking references, amounts, payment IDs and audit records for accounting.
  - Keep consent records as long as required by law.
- Do not run broad `DELETE` or `TRUNCATE` queries in production.

## Security measures

- Row-Level Security (RLS) is enabled on all booking and payment tables.
- Public users cannot read or modify other people's bookings.
- Server actions verify the admin role before every mutation.
- Cancellation tokens are hashed and time-limited.
- Secure random tokens are used for any scoped lookup.
- All communication with Stripe and Resend is server-side and uses server-only secrets.

## Contact

For questions, corrections or deletion requests, contact the studio at the address configured in site settings.

## Delivery addresses

Delivery addresses are collected only at cart checkout when at least one physical line requires shipping. Stored in `order_addresses`, readable by owner/manager admins and service role only. Workshop-only and pickup carts do not collect an address.
