---
trigger: always_on
---

# RunEvo Design Reference

For every task involving UI, UX, frontend, React Native, Expo,
screens, components, styling, layout, navigation, animations,
cards, modals, forms or any user-facing interface:

You MUST inspect the project's `DESIGN-REFERENCE/` directory
before making visual decisions.

`DESIGN-REFERENCE/` is the primary visual source of truth for RunEvo.

If an exact screen reference exists:
- follow that reference as the primary visual specification.

If no exact reference exists:
- inspect related references;
- identify recurring visual patterns;
- inspect similar existing RunEvo screens;
- inspect reusable components;
- infer the established RunEvo visual language;
- create the new interface using that same visual identity.

Never create an unrelated visual style when the existing references
provide enough information to infer the correct design direction.

Before creating new components, inspect the existing codebase for
reusable RunEvo components and design tokens.

Visual decision priority:

1. DESIGN-REFERENCE/
2. Direct RunEvo screen reference
3. Related RunEvo references
4. Existing implemented RunEvo screens
5. Existing reusable RunEvo components
6. Existing RunEvo design system
7. Closest related feature
8. Expo / React Native mobile UX best practices
9. Platform conventions
10. New visual invention

Consistency with RunEvo has priority over novelty.