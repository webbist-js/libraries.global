# Colour and appearance

Colour gives Libraries Global a recognisable character and helps organise information. It must also leave text, controls and important states clear enough to use.

## Light, Dark and System

Dark mode is coming as part of the interface overhaul. The site-wide appearance controls have not shipped yet. The intended choices are Light, Dark and System, accessible from the header and account settings.

Light keeps the warm reading surface and dark ink. Dark uses deep indigo surfaces and lighter text. System follows the appearance preference reported by your browser, which often reflects your device setting. It will not guess from your location or the time of day.

Choosing Light or Dark will override System until you change the choice again. Choosing System will keep following the browser as its preference changes. A saved System choice is different from saving whichever appearance happened to be active at the time.

The planned controls will work for visitors without an account. A browser choice will stay on that browser where storage is available. Signed-in readers will also be able to save an account preference. If saving fails, the interface should say so rather than suggesting that the choice has reached every device.

## Colours have jobs

The page canvas, a raised panel, ordinary text, a link and a focus indicator need different colour roles. A pale violet that reads well on a dark panel may disappear against a light page. A button needs a tested text-and-background pair of its own.

We define those roles in the shared theme so an improvement reaches the places that use it. Interactive states matter too: hover, focus, selected, loading, invalid and disabled. Checking a static screenshot is only the beginning.

Our contrast target follows [WCAG 2.2](https://www.w3.org/TR/WCAG22/): at least 4.5:1 for ordinary text and 3:1 for large text. Essential control boundaries and graphical information have their own contrast requirements. Quiet decoration does not have the same job as the outline that lets you find an input.

## Meaning survives a change of appearance

Library types keep their broad colour families and written names. Status messages need words or icons as well as colour. “Waiting for verification” and “Membership active” describe different facts, even if both appear in small rounded labels.

Photos should retain their original colours. Maps, charts and illustrations need their own review: labels, selected areas and data categories must remain legible, with legends and other ways to understand the information where needed. Simply inverting an image would change the evidence as well as its appearance.

Your avatar colour is also separate from the interface theme. Changing the reading surface should not change your public identity.

## Preference, rather than a prescription

Different readers prefer different appearances in different situations. We are adding a choice, without claiming that one theme is universally healthier or more accessible. Contrast, focus, zoom, motion and clear language still need attention in both.

See [How the site is designed](/knowledge/design-system/how-the-site-is-designed) for the wider principles and [accessible interfaces and interaction](/knowledge/design-system/accessible-interface-interaction) for the checks behind the rollout.
