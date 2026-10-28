# Frontend design system

## Identity

Original text-based 789 NETWORK SOLUTIONS wordmark. Navy navigation, electric-blue primary actions, neutral light surfaces, semantic muted status colors. No copied BulkVS artwork or proprietary layout. Fonts: Figtree for interface typography; Source Code Pro for identifiers/code. Font loading uses Google Fonts CSS with sans-serif fallbacks.

## Tokens and composition

The implemented tokens live in `web/app/globals.css` and `web/tailwind.config.ts`: background, foreground, primary, secondary, muted text, border, card, sidebar, success, warning, danger, radius, shadows, layout dimensions, motion and z-index. Dark mode overrides the semantic tokens and defaults to the user's system preference. The in-app toggle persists via next-themes.

- Dense, left-aligned enterprise navigation with grouped workspace, billing and developer links.
- Four overview metric cards, traffic chart, service status, recent CDR table and useful navigation actions.
- Faint single-hue chart fill only; no full-page gradient.
- Shadcn primitives and Lucide icons. Existing JavaScript primitives are wrapped by typed TypeScript application exports in `components/ui/index.tsx`; application pages/components/data are TypeScript.
- React Query for API state; Zustand stores access JWT only in memory, never localStorage.
- Preview fixture mode is a build-time choice, not an API error fallback.
- Explicit skeleton/error/empty/unavailable states. Disabled buttons have explanations rather than simulated success.
- Data-testid identifiers on core controls, dialogs, metrics and tables; keyboard-compatible Radix dialogs/selects.
- CSS breakpoints adapt dashboard grids, sidebar/mobile menu and forms. Reduced-motion preference suppresses transitions.

## Disclosures

Every portal route displays DEMO MODE with no-call/no-payment wording. Public pages display the same development boundary. Managed preview pages explicitly say read-only. Draft policies are marked drafts. Planned modules use phase labels and never look like live operational capabilities.
