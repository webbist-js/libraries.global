# Accessible interfaces and interaction

Libraries Global should work for people using different screens, input methods and assistive technologies. Our target is WCAG 2.2 AA. This guide describes the design requirements and testing approach; it is not a completed conformance report.

## Reading and finding your place

Headings should describe the page and its sections in a meaningful order. A larger visual heading does not automatically need a higher heading level. Links need names that make sense in context, and images need useful alternative text when they carry information.

Text must remain readable against its actual background. We check ordinary text, smaller metadata, links, form values and error messages in each supported appearance. A good contrast score for a headline does not establish that the whole page is readable.

Dark mode is forthcoming. It will be checked alongside Light, including menus, sheets and messages that appear after an action. Neither appearance can stand in for the other in testing.

## Keyboard and touch

You should be able to reach and use controls with a keyboard and see where focus is. Menus and dialogs need predictable opening, closing and focus return. Sticky bars and drawers must not cover the control you are using.

Small controls need enough space to select reliably. WCAG 2.2 includes a 24 CSS-pixel minimum target-size criterion with specific exceptions; our design aim for primary touch controls is 44 CSS pixels. We also review the space between nearby actions.

A control's icon supplements its name. A sun or moon alone does not explain whether it describes the current appearance or the action you are about to take. The planned appearance menu will name Light, Dark and System explicitly.

## Forms and changes

Labels must attach to the actual input. Help and error messages should be associated with the field they explain. When an action saves, fails or needs another step, the message should be available to assistive technology as well as visible on screen.

Loading should not erase a button's accessible name. A disabled action should not be the only explanation of what is required. Password managers and paste are part of usable authentication, rather than obstacles to design around.

## Enlarged text and other preferences

We review text resizing, high zoom, narrow layouts and text-spacing changes. The page should preserve ordinary content and actions rather than hiding them when space becomes tight. Maps and complex tables may need two-dimensional navigation, but their surrounding instructions and controls still need to work.

Reduced-motion and forced-colour preferences need deliberate testing. Theme changes should not trigger an elaborate animation. Focus indicators and selected states must survive high-contrast settings.

## Data and honest status

Colour cannot be the only way to recognise a category, result or warning. Maps need clear legends; charts need labels and an alternative reading where necessary. Unknown information should be described as unknown.

Team membership, verification and library-management permission remain distinct. An accessible label is useful only if it accurately describes the state.

## Checking and reporting

Automated checks help catch recurring problems. They sit alongside manual keyboard, screen-reader, zoom and real-device checks. We use [WCAG 2.2](https://www.w3.org/TR/WCAG22/) as the reference and track limitations rather than treating a passing scan as certification.

For current commitments and reporting routes, see the [accessibility statement](/legal/accessibility). A useful report includes the page, the task, what happened and your browser or assistive technology. Please leave out passwords, payment information and other private account details.
