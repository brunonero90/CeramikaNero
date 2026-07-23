# Design System

## Design tokens

All visual values are stored as CSS custom properties in `app/globals.css` and
mapped to Tailwind utilities in the `@theme inline` block.

### Color tokens

| Token                | Atelier reference    | Joyful reference   |
| -------------------- | -------------------- | ------------------ |
| `--surface-bg`       | #faf7f2 (cream)      | #fff8f0 (cream)    |
| `--surface-raised`   | #ffffff              | #ffffff            |
| `--surface-subtle`   | #e6dccf (sand)       | #f5d87c (butter)   |
| `--text-primary`     | #3e2723 (umber)      | #2a2a2a (ink)      |
| `--text-muted`       | #6b5b55              | #5c5c5c            |
| `--accent-primary`   | #c67b5c (terracotta) | #d45d48 (clay red) |
| `--accent-secondary` | #8a9a84 (sage)       | #7fa68c (sage)     |
| `--accent-highlight` | #e6dccf              | #f5d87c            |

### Typography

| Theme   | Heading font       | Body font |
| ------- | ------------------ | --------- |
| Atelier | Cormorant Garamond | Inter     |
| Joyful  | Quicksand          | Nunito    |

Utility classes: `font-heading`, `font-body`.

### Radii

| Theme   | Small | Medium | Large |
| ------- | ----- | ------ | ----- |
| Atelier | 6px   | 10px   | 16px  |
| Joyful  | 10px  | 16px   | 24px  |

Utility classes: `rounded-sm`, `rounded-md`, `rounded-lg`.

### Shadows

Shadows are subtle, warm-tinted and increase in depth for `sm`, `md`, `lg`.
Utility classes: `shadow-sm`, `shadow-md`, `shadow-lg`.

### Transitions

| Theme   | Fast  | Base  | Slow  |
| ------- | ----- | ----- | ----- |
| Atelier | 150ms | 250ms | 450ms |
| Joyful  | 200ms | 300ms | 500ms |

Easing: Atelier uses `cubic-bezier(0.4, 0, 0.2, 1)`; Joyful uses a bouncy
`cubic-bezier(0.34, 1.56, 0.64, 1)`.

Utility classes: `transition-fast`, `transition-base`, `transition-slow`.

## Component principles

- Buttons use rounded corners, visible focus rings and clear hover states.
- Navigation links use muted text that darkens on hover.
- Cards sit on a raised surface with a soft shadow.
- Focus states use `focus-visible:ring-2` and `focus-visible:ring-offset-2` for
  keyboard visibility.

## Accessibility

- All interactive elements have focus indicators.
- Theme switch uses `aria-pressed` and an `aria-label`.
- Mobile navigation uses `aria-expanded`, `aria-controls` and closes on `Escape`.
- `prefers-reduced-motion` disables transitions and animations.
- Polish `lang="pl"` is set on the document.

## Responsive breakpoints

The layout uses Tailwind’s default breakpoints: `sm`, `md`, `lg`, `xl`.
Mobile navigation is shown below `lg`.

## Decisions to clarify (TBD)

- TBD: Final colour values from Ceramika Nero brand guidelines.
- TBD: Whether to add a dark mode or high-contrast variant.
- TBD: Whether to introduce additional accent colours for seasonal campaigns.
- TBD: Final font weights and additional type scales (display, caption, etc.).
