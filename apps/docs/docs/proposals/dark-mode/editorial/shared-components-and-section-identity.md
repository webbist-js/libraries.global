# Shared components and section identity

Libraries Global has an Atlas, a Journal, a Knowledge hub and working areas for contributors and library staff. They share a design system, while leaving room for the kind of work each section supports.

## Reuse the familiar mechanics

A search field should feel familiar when you move from a library list to a network page. Buttons, menus, form labels, pagination and feedback messages benefit from shared behaviour. Fixing the shared part can improve keyboard support or an error state in several places at once.

Shared parts also make a theme possible. A button should draw its colours from tested roles, rather than carrying a private copy of the palette. Light and Dark can then use the same component with different colour pairs. Dark mode is still being prepared; it is not a separate set of pages.

## Compose patterns around a purpose

Some reusable pieces are larger than an individual control. A workspace page header can combine a title, description, context and action. A form section can group a heading, fields and its feedback. An empty state can explain what is missing and offer an appropriate next step.

Those patterns need room for useful variation. An onboarding page may explain a process; a working list should bring the records into view quickly. Reusing the header structure does not require an oversized banner on every screen.

The best abstraction makes the common rules easier to see. A component with dozens of unrelated switches can hide those rules. We prefer smaller pieces composed into a page when its needs are different.

## Keep the specialist parts

A map legend, a discussion reply and an opening-hours table carry different meanings. They can reuse type, spacing, colours and control primitives without becoming one generic card.

Section identity follows that purpose. The Journal leaves room for images and longer reading. The Atlas gives priority to geography and the tools needed to understand it. Staff pages keep records, actions and access information close together.

Shared status styling needs particular care. Active Team membership describes an account entitlement. Verification describes a reviewed connection. Library access describes permission to manage particular records. Matching their shape is useful; merging their meaning would be misleading.

## What Storybook is for

Storybook is our working component library. It lets us inspect a control without navigating an entire account flow. The useful examples include long labels, empty results, errors, loading, keyboard focus and constrained widths, as well as the tidy default.

The development library already has appearance controls; dark mode has not shipped on the site yet. Stories render the actual shared components in both Light and Dark, including menus and dialogs that appear outside the immediate story container.

A component being imported somewhere is not proof that its states have been reviewed. A screenshot also cannot show every keyboard or screen-reader interaction. We use examples, interaction checks and page-level review together.

## Change once, check in context

When a shared part changes, it should be checked in the sections that use it. A smaller button may help a compact toolbar and make a touch action harder to select. A quiet divider may work on a reading page and disappear in a dense table.

The aim is fewer accidental differences and clearer purposeful ones. [How the site is designed](/knowledge/design-system/how-the-site-is-designed) describes the principles, and [accessible interfaces and interaction](/knowledge/design-system/accessible-interface-interaction) explains the checks that help make them practical.
