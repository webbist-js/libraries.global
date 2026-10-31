# How the site is designed

Libraries Global is an open reference work with people around it. Its design should help you find a fact, understand what supports it and add something useful when the record is incomplete.

## A reference book you can work in

The light appearance borrows from printed reference books: a warm background, dark text, serif headings and indigo links. Longer reading needs comfortable line lengths and a clear rhythm. Working pages need labels, controls and enough structure to scan quickly.

We use the same underlying type and spacing rules across those tasks. The Journal has more room for stories and images. The Atlas gives space to maps and their controls. Staff pages put the record, the action and its status close together. Those differences should help explain the page's purpose.

Dark mode is being prepared as a second appearance. It will keep the hierarchy and character of the light design, with colours chosen for darker surfaces. It is not available as a site-wide control yet. [Colour and appearance](/knowledge/design-system/colour-and-appearance) explains the intended choices.

## Show what the record knows

A missing answer is not a negative answer. If a record says nothing about step-free access, the interface should show that the information is missing. It should not suggest that the building has no step-free entrance.

The same care applies to coverage. A gap on a map may be a gap in the index. Dates, sources and qualifications belong near the information they explain. We want a reader to be able to follow a claim back to its evidence, rather than treating a polished card as proof.

## Colour helps you recognise things

Library types use broad colour families. National, parliamentary and state libraries use purple; public, municipal and mobile libraries use green; academic libraries use blue. Special, monastic, archive, private and cultural libraries use rust, while digital and other categories use grey.

The type name stays visible alongside the colour. A map legend, tag or status should still make sense if you cannot distinguish the hues. In a dark appearance, the background and text pair may change while the category keeps its identity.

Avatar colours are personal choices. They are separate from the interface appearance and from any claim of staff authority.

## Consistency where it helps

Search, pagination, forms and menus should behave in familiar ways throughout the site. A shared component gives us one place to improve a label, a focus indicator or an error state.

We keep components specific when their job is specific. A map legend is different from a membership summary. Team membership, verification and access to a library must remain separately explained, even when their status labels share a visual pattern. Read more about [shared components and section identity](/knowledge/design-system/shared-components-and-section-identity).

## Access is part of the design work

Our target is WCAG 2.2 AA. Keyboard use, visible focus, meaningful headings, labelled controls and readable contrast belong in routine design reviews. Motion should respect a reader's preferences, and enlarging text should not hide the next action. These are requirements we work towards and test; this article is not a claim that every page has passed a complete assessment.

If something gets in the way, tell us what you were trying to do, the page and the browser or assistive technology involved. Avoid sending private account details. You can contact info@libraries.global or use the project's [GitHub issues](https://github.com/webbist-js/libraries.global/issues). The [accessible interaction guide](/knowledge/design-system/accessible-interface-interaction) describes the checks in more detail.

For implementation details, see [Working on the code](/knowledge/getting-started/working-on-the-code).
