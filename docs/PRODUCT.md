# Ceramika Nero — Product Overview

## Mission

Replace the Wix-based website of Ceramika Nero, a ceramics and art studio in
Suchy Las, Poland, with a custom Next.js application that supports online
workshop discovery, booking and payment.

## Target audience

- Parents looking for creative activities for children.
- Adults interested in beginner and advanced ceramic workshops.
- Families and groups celebrating birthdays or events.
- Companies seeking team-building workshops.
- Collectors and visitors browsing the gallery and blog.

## Primary language

Polish is the website’s primary language. All UI copy, metadata, error messages
and transactional emails are authored in Polish first.

## Visual modes

The site offers two complete visual themes selectable from the header. Both
modes display the same content and functionality.

1. **Atelier** — elegant, warm and artisanal. Cream, terracotta, dark umber and
   muted sage. Editorial serif headings, refined spacing and understated
   animation.
2. **Joyful** — creative, colourful and family-friendly. Cream, clay red, sage,
   butter yellow and ink. Friendly expressive headings, organic shapes and
   playful but professional animation.

## Top-level sections

- **Warsztaty** — list of available workshops and events.
- **Dla dzieci** — workshops aimed at children.
- **Dla dorosłych** — workshops aimed at adults.
- **Grupy i firmy** — private group and corporate events.
- **Galeria** — portfolio of studio works.
- **Blog** — articles, tips and studio news.

## Core actions

- Browse workshops by category, date and audience.
- View workshop details and available slots.
- Book a workshop and pay online.
- Contact the studio for private events.
- Subscribe to a newsletter (future phase).

## Key user journeys

1. Visitor lands on homepage, chooses a theme, browses workshops and books a slot.
2. Parent visits "Dla dzieci", selects a workshop, fills child details and pays.
3. Company representative requests a quote for a group event.
4. Returning visitor logs in to view past bookings.

## Commerce scope (current)

- Unified cart for fixed-price workshop sessions and Glina Box physical products
  (plus optional studio firing/glazing add-on).
- Mixed checkout creates an `orders` aggregate with linked `bookings` rows.
- Card payment (Stripe) is **not** activated yet — bank-transfer / studio
  confirmation wording only.
- Enquiry-only offers stay on contact/enquiry flows and must not enter the cart.

## Non-goals (historical — superseded where noted)

- ~~Supabase integration, authentication and database.~~ (done)
- Stripe checkout and payments.
- Resend email integration.
- Wix content migration.
- Production deployment and DNS cutover.
- Admin dashboard.
- Newsletter or marketing automation.

## Decisions to clarify (TBD)

- TBD: Exact workshop categories, audience age ranges and pricing model.
- TBD: Whether the site should support English or other languages in the future.
- TBD: Gift cards, memberships or subscription plans.
- TBD: Blog authoring workflow and comment moderation.
- TBD: Gallery image licensing and download behaviour.
