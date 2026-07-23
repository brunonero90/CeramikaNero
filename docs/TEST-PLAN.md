# Test Plan

## Automated testing

### Unit tests

- Utility functions (`cn`, theme helpers, validation helpers).
- Server service logic (when services are implemented).

### Integration tests

- Theme persistence and hydration behaviour.
- Booking form validation and submission flow.
- Server Actions and database interactions.

### End-to-end tests

- Homepage renders in both themes.
- Navigation and mobile menu work on common viewports.
- Booking flow completes successfully (Stripe test mode).
- 404 page is displayed for unknown routes.

## Accessibility testing

- Keyboard navigation through header, mobile menu and theme switch.
- ARIA attributes and landmark regions.
- Color contrast checks for both themes.
- Screen reader flow for booking and navigation.
- `prefers-reduced-motion` disables animations.

## Visual regression

- Compare homepage in Atelier and Joyful modes.
- Compare mobile navigation at common widths.
- Check for layout shifts when fonts load.

## Manual checklist

- [ ] Homepage loads at desktop and mobile widths.
- [ ] Theme selection persists after reload.
- [ ] Theme switch is operable by keyboard.
- [ ] Mobile navigation opens and closes by keyboard and mouse.
- [ ] Reduced-motion setting disables transitions.
- [ ] All links have visible focus states.
- [ ] 404 page displays for unknown URLs.
- [ ] Loading state is visible when navigating slowly.
- [ ] Production build completes without errors.

## Tools

- Jest and React Testing Library for unit/integration tests.
- Playwright for end-to-end tests.
- ESLint and TypeScript for static analysis.
- Lighthouse and axe-core for accessibility checks.

## Decisions to clarify (TBD)

- TBD: Whether to set up a continuous integration runner before deployment.
- TBD: Which browsers and devices must be explicitly supported.
- TBD: Whether visual regression testing is required from the first release.
- TBD: Availability of Stripe test credentials for end-to-end payment tests.
