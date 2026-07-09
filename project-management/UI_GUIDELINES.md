# UI Guidelines

## Design Direction

Finance AI should feel precise, calm, and operational. Accounting users need dense but readable information, predictable navigation, and clear review states rather than decorative marketing surfaces.

## Component Principles

- Use Tamagui primitives for consistent layout, spacing, and theming.
- Keep shared UI components domain-neutral inside `packages/ui`.
- Use feature-owned components when presentation depends on accounting behavior.
- Prefer clear status indicators, tables, charts, filters, and review queues for financial workflows.

## Mobile Experience

- Prioritize fast scanning of balances, exceptions, and review items.
- Keep actions explicit and reversible where financial data may change.
- Design chart areas with Victory Native XL once real reporting data exists.
- Keep text concise and avoid relying on color alone for state.

## Accessibility

Interactive elements should have clear labels, sufficient hit areas, and contrast appropriate for financial review work.
