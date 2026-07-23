# Architecture

## Stack

- **Framework:** Next.js with App Router.
- **Language:** TypeScript in strict mode.
- **Styling:** Tailwind CSS for layout and utilities, CSS custom properties for
  theming.
- **Deployment target:** Netlify (static export / standalone build).
- **Future data:** Supabase (PostgreSQL, auth, storage).
- **Future payments:** Stripe.
- **Future email:** Resend.

## Project structure

```
app/                  # App Router routes and boundaries
components/
  layout/             # Header, Footer, MobileNavigation, ThemeSwitch
  ui/                 # Reusable UI primitives (Button, etc.)
lib/
  fixtures/           # Temporary display data, clearly marked
  services/           # Server-side data access and integrations
  theme/              # Theme provider, theme script and utilities
  types/                # Domain TypeScript types
  utils/                # Small helper utilities
  validation/           # Input validation schemas (future)
public/               # Static assets
```

## App Router conventions

- Route segments are created as folders with a `page.tsx`.
- Loading states use `loading.tsx`.
- Error boundaries use `error.tsx` and `global-error.tsx`.
- The root `layout.tsx` loads fonts, injects the theme script and wraps the
  application in `ThemeProvider`.

## Server / client boundaries

- Layout and page components are server components by default.
- Interactive components use the `"use client"` directive at the top of the file.
- Theme switching, mobile navigation and error boundaries are client
  components.
- Server-side data services will be added under `lib/services` once Supabase is
  configured.

## Theme system

- Theme tokens are stored as CSS custom properties in `app/globals.css`.
- Themes are scoped with `[data-theme="atelier"]` and `[data-theme="joyful"]`.
- An inline script in `lib/theme/theme-script.tsx` restores the user’s choice
  before first paint to avoid flashing.
- `ThemeProvider` exposes `setTheme` and `setSuggestedTheme` for manual and
  category-suggested themes without overriding user preference.

## State management

- No global state library is required in this phase.
- Theme state is managed via React Context.
- Server state will be handled by Supabase once connected.

## Security considerations

- Supabase Row Level Security will restrict access to user data and bookings.
- Stripe webhook endpoints must validate signatures.
- API keys are stored only in environment variables and never committed.
- Form validation will be implemented before any user input is persisted.

## Decisions to clarify (TBD)

- TBD: Whether to use Next.js middleware for route protection or Supabase SSR
  helpers.
- TBD: Caching strategy for workshop pages and time-to-live values.
- TBD: How to handle image uploads and asset storage (Supabase Storage vs.
  external CDN).
- TBD: Whether to implement a public API or keep data access internal to
  server components and Server Actions.
