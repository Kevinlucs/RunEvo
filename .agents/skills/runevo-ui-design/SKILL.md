---

name: runevo-ui-design
description: >
Designs, implements, reviews and refines RunEvo mobile interfaces using
DESIGN-REFERENCE as the primary visual source of truth. Use this skill whenever
creating or modifying screens, components, navigation, cards, modals, forms,
dashboards, workout interfaces, AI Coach interfaces, statistics, profile screens,
React Native UI, Expo UI, frontend styling, UX, animations, visual hierarchy,
responsive mobile layouts or any user-facing visual feature in RunEvo.
----------------------------------------------------------------------

# RunEvo UI Design Skill

## Mission

Build and maintain the RunEvo mobile interface while preserving one coherent,
recognizable and premium visual identity.

The application already has an established visual direction.

The agent must NOT independently reinvent that direction.

The primary visual source of truth is:

`DESIGN-REFERENCE/`

---

# 1. PRIMARY VISUAL AUTHORITY

Before creating, modifying, redesigning or reviewing ANY user-facing interface:

1. Inspect `DESIGN-REFERENCE/`.
2. Search for references related to the requested screen or feature.
3. Inspect existing RunEvo screens implementing similar concepts.
4. Inspect reusable components and existing design tokens.
5. Only then decide how the interface should be implemented.

`DESIGN-REFERENCE/` has higher visual authority than:

* generic UI trends
* default Material Design
* default iOS layouts
* generic fitness applications
* arbitrary AI-generated design
* personal stylistic preferences of the agent

Do not skip this step.

---

# 2. WHEN AN EXACT REFERENCE EXISTS

If `DESIGN-REFERENCE/` contains an image corresponding directly to the screen
being implemented, use it as the primary visual specification.

Study:

* screen structure
* hierarchy
* background
* colors
* typography
* font weights
* spacing
* horizontal margins
* vertical rhythm
* cards
* borders
* corner radius
* shadows
* gradients
* buttons
* icons
* charts
* navigation
* tabs
* badges
* progress indicators
* sheets
* modals
* information density
* whitespace
* visual emphasis

Reproduce the design direction as faithfully as technically reasonable.

Do not reinterpret an existing reference simply because another visual style
might also look good.

The objective is consistency with RunEvo.

---

# 3. WHEN NO EXACT REFERENCE EXISTS

If there is no image corresponding directly to the requested screen:

DO NOT invent an unrelated visual style.

Instead:

1. Inspect the entire relevant set of files in `DESIGN-REFERENCE/`.
2. Find the closest screen family.
3. Inspect existing implemented screens.
4. Identify recurring visual patterns.
5. Infer the RunEvo design language.
6. Compose the new screen using those same visual primitives.

For example:

If implementing a Garmin integration screen and there is no Garmin reference,
derive its appearance from existing:

* settings screens
* workout screens
* integration cards
* status components
* headers
* buttons
* badges
* modal patterns

The resulting screen must look as though it had always been part of RunEvo.

---

# 4. VISUAL DNA EXTRACTION

Continuously infer the RunEvo visual system from `DESIGN-REFERENCE/`.

Identify patterns involving:

## Colors

* primary colors
* secondary colors
* accent colors
* surface colors
* background colors
* success colors
* warning colors
* destructive colors
* muted colors

## Typography

* title hierarchy
* section headings
* body text
* captions
* metric values
* labels
* buttons

## Layout

* horizontal page margins
* vertical spacing
* section spacing
* card spacing
* safe areas
* content width
* alignment

## Components

* buttons
* cards
* workout cards
* metric cards
* inputs
* tabs
* progress indicators
* charts
* badges
* modals
* bottom sheets
* navigation
* headers
* empty states
* loading states

Reuse discovered patterns consistently.

---

# 5. CONSISTENCY OVER NOVELTY

RunEvo must feel like one product designed by one design team.

Avoid introducing:

* random card styles
* arbitrary spacing
* unrelated button styles
* random gradients
* excessive glassmorphism
* excessive shadows
* generic SaaS dashboards
* desktop layouts compressed into mobile screens
* inconsistent icons
* inconsistent typography
* unnecessary visual decoration
* generic AI-generated aesthetics

Do not make a screen different merely to make it interesting.

Consistency has priority over novelty.

---

# 6. CHECK THE CODEBASE BEFORE CREATING COMPONENTS

Before creating a new UI component:

1. Search the existing codebase.
2. Find similar components.
3. Determine whether one can be reused.
4. Extend existing components when appropriate.
5. Create a new component only when necessary.

Search especially for existing:

* Button
* Card
* Header
* WorkoutCard
* MetricCard
* Badge
* Tabs
* Modal
* BottomSheet
* Input
* Progress
* Navigation

Avoid duplicated components that differ only by a few styling values.

---

# 7. DESIGN SYSTEM

Prefer existing design tokens.

Before hardcoding visual values, search for:

* theme files
* color tokens
* spacing tokens
* typography tokens
* radius tokens
* shadow definitions
* common component styles

If repeated visual values exist but are not centralized, consider creating
appropriate reusable tokens without performing unnecessary architectural rewrites.

The design system should emerge from RunEvo's established visual language.

---

# 8. MOBILE FIRST

RunEvo is a mobile application.

Never treat it as a responsive desktop website.

Always consider:

* touch ergonomics
* thumb reach
* touch target dimensions
* SafeArea
* keyboard behavior
* scroll behavior
* screen height
* screen width
* Android navigation
* iOS safe areas
* one-handed usage
* accessibility
* device variations

Interfaces must work naturally on real phones.

---

# 9. ANDROID AND IOS

Maintain the same RunEvo identity across Android and iOS.

Use native platform behavior where appropriate without destroying RunEvo's
visual identity.

Priority:

1. `DESIGN-REFERENCE/`
2. Existing RunEvo visual language
3. Existing RunEvo components
4. RunEvo design system
5. Mobile UX best practices
6. Platform-specific conventions

---

# 10. SCREEN FAMILIES

Screens belonging to the same feature family must share visual grammar.

## Training

Maintain consistency among:

* workout cards
* workout details
* pace indicators
* training zones
* workout progress
* planned vs completed workouts

## AI Coach

Maintain consistency among:

* analysis cards
* recommendations
* conversation patterns
* training insights
* adjustment messages

## Statistics

Maintain consistency among:

* metric cards
* graphs
* period selectors
* progression indicators

## Profile and Settings

Maintain consistency among:

* setting rows
* account cards
* integrations
* selectors
* section headers

Never redesign each screen independently.

---

# 11. VISUAL IMPLEMENTATION PROCESS

For every significant UI task:

## Phase 1: Understand

Read the user's requirement.

Do not start coding immediately.

## Phase 2: Inspect DESIGN-REFERENCE

Inspect:

`DESIGN-REFERENCE/`

Locate exact and related visual references.

## Phase 3: Inspect existing implementation

Search for:

* related screens
* reusable components
* existing styles
* design tokens
* navigation patterns

## Phase 4: Infer

Determine the visual rules required by the new screen.

## Phase 5: Plan

Define the component structure before implementation.

## Phase 6: Implement

Build the screen using reusable React Native/Expo components and existing
RunEvo primitives.

## Phase 7: Visual Review

After implementation, compare the result again against:

* `DESIGN-REFERENCE/`
* related RunEvo screens
* existing components
* design-system patterns

Correct visible inconsistencies before declaring the task complete.

---

# 12. VISUAL VALIDATION

When screenshots or simulator access are available, visually inspect the actual
rendered screen.

Do not consider a UI implementation successful merely because:

* TypeScript compiles
* Expo starts
* there are no runtime errors
* components render

A UI task is complete only when both:

FUNCTIONAL IMPLEMENTATION

and

VISUAL CONSISTENCY

have been validated.

---

# 13. DO NOT MODIFY BUSINESS LOGIC UNNECESSARILY

When performing a UI task, avoid unrelated modifications to:

* AI Coach algorithms
* training generation
* workout calculations
* authentication
* Supabase
* database schema
* APIs
* Garmin synchronization
* Strava synchronization
* subscriptions
* payments
* analytics

Preserve existing functionality unless the requested task explicitly requires
business-logic modifications.

---

# 14. UI REVIEW MODE

When asked to review a RunEvo screen, compare it against `DESIGN-REFERENCE/`.

Classify findings as:

## Critical

Problems affecting usability, navigation or comprehension.

## Important

Meaningful inconsistencies in hierarchy, layout, spacing or visual language.

## Polish

Minor refinements that improve perceived quality.

Prefer targeted improvements rather than unnecessary redesigns.

---

# 15. NO GENERIC AI UI

Never default automatically to:

* huge gradient cards
* excessive rounded containers
* random floating pills
* unnecessary blur
* glassmorphism everywhere
* giant hero sections
* generic fintech styling
* generic health dashboard styling
* generic SaaS layouts

RunEvo should have its own identity.

`DESIGN-REFERENCE/` defines that identity.

---

# 16. FINAL DECISION HIERARCHY

Whenever there is uncertainty about how something should look, use exactly this
decision hierarchy:

`DESIGN-REFERENCE/`

↓

Direct RunEvo screen reference

↓

Related RunEvo screen references

↓

Existing implemented RunEvo screens

↓

Existing reusable components

↓

Existing RunEvo design system

↓

Closest feature family

↓

Expo / React Native mobile UX best practices

↓

Platform-specific conventions

↓

Only then create a new visual solution

Never reverse this hierarchy.

The goal is not merely to produce attractive interfaces.

The goal is to produce interfaces that unmistakably belong to RunEvo.
