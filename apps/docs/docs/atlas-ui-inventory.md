---
title: Atlas interface inventory
description: Explore, Inspect, map controls, responsive layouts and analysis interaction rules.
---

Atlas uses Explore to find records and choose layers, and Inspect to read a record or analyse an enabled layer. The global site header remains shared site UI.

## Workspace surfaces

| Surface           | Content                                                                    | Behaviour                                                                                                  |
| ----------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Explore           | Search, Filters, Layers and Feedback                                       | 400 px on wide desktop; a 72 px labelled rail when collapsed.                                              |
| Inspect           | Selected library, selected mobile stop and enabled analytical layers       | One tabbed 360 px panel. Only the active tab is visible.                                                   |
| Minimized Inspect | Compact summaries for the same tabs                                        | Keeps layers, calculations, local settings and scroll positions. Each button has its full title and scope. |
| Map controls      | Zoom, location and 2D/Globe                                                | Move alongside Inspect without covering it. Location failure has a dismissible message.                    |
| Map toolbar       | Map key, active-layer shortcuts, current result count and Map/List         | Shortcuts open the corresponding Inspect view. Detailed legends describe all active layers.                |
| Mobile workspace  | Persistent Explore/Inspect and Map/List navigation above a resizable sheet | Search, Filters and Layers remain reachable while an analysis is active.                                   |

Desktop uses 16 px outer gaps. On a narrow desktop, opening Inspect collapses Explore unless the reader explicitly opened it; opening Explore minimizes Inspect. List view retains access to Explore.

The phone sheet supports peek, half and full heights, with a labelled size button. It accounts for the bottom safe area. Inspect navigation and the analysis footer remain outside the scrolling body. A separate Map key control remains available over the phone map.

## Explore

Search retains recent records, library/stop/place results, mobile-visit presets and the contribution prompt. Searching does not change a service calculation's origin.

Filters retain service/network membership, library types, opening conditions, operator, services/accessibility, founding-year range and mobile-stop frequency/live-sharing criteria. Feature choices require every selected feature to be recorded. Missing hours or features remain unknown. Population layers do not change with library filters.

The library service picker searches on the server, with country and region facets and cursor pagination. Selecting a service determines the reporting area automatically and fits the service's bounds once. Panning, tab changes and minimizing do not repeat that fit.

Service, library type, opening and recorded features remain visible. Less-used operator, founding-year, event, catalogue and mobile-stop options sit under More filters. The feature preview prioritizes available accessibility, computer and Wi-Fi records; selected features remain visible when the preview closes.

The filter footer keeps separate library and stop counts and Show results available. A zero-match selection remains a zero; it is not presented as missing population or a loading result. The existing loosening suggestions and Clear filters recovery remain available.

Layers has one grouped catalogue, without a duplicate Active layers list:

- Locations: library locations, mobile library routes and recorded closures.
- Library characteristics: opening hours, accessibility, record completeness and the unavailable Founded year visualization.
- Patterns and distribution: library density and events-feed density.
- Access and coverage: library access, Reach, and unavailable residents-beyond-reach/service-coverage layers.
- Reference geography: population, deprivation, households without a car, and unavailable transit/schools layers.

An enabled analytical layer has an Open action and a current selection summary. About remains a separate disclosure, including for Reach. Unavailable layers retain disabled switches and Coming soon labels; paying does not enable them.

The existing rules still apply: one heat visualization, one pin style and one area background. Reach can overlay one background. Dependent layers keep library locations enabled and explain why its switch is locked. Replacing an exclusive layer offers Undo. Turn all off clears layers; it does not close a selected record, and Undo restores the previous set.

## Inspect navigation and selection

The selected library and selected stop are independent of the active analysis tab. Opening an analysis preserves the selected record. Opening a library during service Reach opens the record without changing the service's calculation.

Inspect includes these analytical views when their layers are enabled:

| View                     | Main content                                                                                  | Settings and footer                                                                                             |
| ------------------------ | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Reach                    | Selected-time coverage/residents, journey bands or cumulative totals, community context       | Scope, service/origin, travel mode, filters and calculation controls; shading, methods and supported downloads. |
| Library access           | Selected area, rates, Overview, Explore and paged Compare                                     | Metric, area level, library types and comparison scope; shading, provenance and CSV.                            |
| Population               | Selected area average or selected grid cell, source year and legend                           | Automatic/country/region/local/grid detail and country; shading and sources.                                    |
| Deprivation              | Selected small-area value/rank within a named national edition                                | Nation/edition and area picker; shading and sources.                                                            |
| Households without a car | Household share and household denominator                                                     | Edition and area picker; shading and sources.                                                                   |
| Accessibility            | Confirmed/total coverage, feature selection, recorded/both/unconfirmed views and gap recovery | List actions, methods and entitlement-checked export.                                                           |
| Mobile routes            | Current stop count, route-line toggle and stop list                                           | Shading and timetable/routing explanation.                                                                      |
| Library/events density   | Relative concentration key and interpretation                                                 | Shading and methods.                                                                                            |

With multiple views, the tab strip scrolls horizontally. ArrowLeft/ArrowRight, Home and End change the selected tab and focus. Tabs have unique panel relationships. One remaining view uses a simple heading instead of an unnecessary tab strip.

Library access keeps Overview, Explore and Compare directly below the heading, outside the scrolling body. Selected-area figures and tab results appear before the supporting settings. Explore and Inspect share thin, rounded scrollbars. Active layer labels and their panel icon open Inspect; the separate chevron expands the layer explanation.

Minimize hides Inspect without switching layers off. The active view's remove button turns its layer off and offers Undo. Closing a record clears that selection. Disabling a layer removes its local view; re-enabling it may initialize its local settings again.

Panel components remain mounted while switching views, minimizing or opening List, using React Activity to preserve local state and suspend hidden effects. The active panel alone contributes to the shared footer. Source and download panels anchor to the full Inspect footer, with a title, close button and one scrolling body. Only one opens at a time. Source text is shown directly, and download formats stack in full-width rows.

## Reach scope

One-library Reach uses the selected library. Service Reach uses the chosen service and its reporting boundary. Inspecting another library does not replace a service origin. Reach from here asks whether to switch to that library or keep the service; a switch requires the explicit action.

Travel time is selected with the standard segmented control. Choosing among already-calculated thresholds does not start another calculation. Service calculations require an explicit Calculate/Update coverage action; choosing a service, changing mode or resetting filters never starts a job. Reset filters in service Reach keeps the selected service; it can clear accessibility restrictions without disabling the Accessibility layer.

One-library Reach requires zoom 11 or closer and at most 100 matching libraries in view. Named service calculations use canonical service and reporting bounds independently of camera zoom. Pro allows 50 eligible libraries, a 2,500 km² envelope / 75 km span for all four times, or 20,000 km² / 200 km for the selected time only. Active Team seats allow 100 libraries and double those area/span allowances. Both origin and reporting envelopes must fit. Changing a larger service’s time clears stale results and requires another explicit calculation. CMS and native admission independently enforce the budget before work or cache access.

The headline shows the selected time, mode, modelled coverage or estimated residents, population year and denominator where available. Journey bands are distinct; cumulative totals must not be added. Community comparisons retain their national release, coverage and missing-data conditions. National deprivation deciles are not comparisons of individual residents or interchangeable international measures.

Reach controls remain expanded, and service Reach keeps Calculate/Update coverage pinned above the footer tools. Completing a calculation does not collapse its controls.

Sources, licences, routing assumptions, record exclusions and reproducibility details remain accessible through About. Download retains existing CSV columns, GeoJSON and versioned analysis JSON where supported. Missing routes or population must not become a false zero. Stale, pending, partial, unsupported and failed states have separate presentation.

## Map and list

The map key includes pins and every active overlay. Reach labels follow the actual travel mode, threshold, calculation state and population year. Population and context legends identify their release and units. Library density remains relative record concentration; events density describes libraries with events feeds.

The toolbar's active-layer buttons reopen Inspect. Limited-width layouts retain the result count and Map/List controls; detailed descriptions remain in Map key and Inspect. Attribution stays with the map.

List remains the keyboard-friendly fallback when WebGL is unavailable. It retains sorting, server pagination, exports, hours, place/type, completeness and accessibility information. Return to map keeps enabled layers and Inspect state. All Atlas selects use the shared SelectField component.

## Data, security and motion

- Loading skeletons reflect actual service lookup, calculation, population or context requests, without a minimum display delay. Their brief pulse settles during longer waits.
- Unsupported regions, missing datasets, errors and genuine zero results remain explicit. Missing data is never replaced by illustrative mockup values.
- Authentication, analysis entitlements, export entitlements and rate limits are enforced by server routes. Inspect visibility and URL parameters cannot grant access.
- External catalogue links accept HTTP(S) URLs without embedded credentials. CSV text is quoted and formula-prefixed values, including leading whitespace, are escaped.
- Detail requests abort when a record effect is suspended or replaced; the existing detail cache stays bounded.
- Panel transitions are short and interruptible. The live map is excluded from snapshots. Unsupported browsers update immediately. Reduced motion disables movement and skeleton pulses.
- Focus remains visible; minimizing and reopening restores a useful control. Notices have live status or alert semantics, and all icon controls have accessible labels.

## Persistence and checks

Existing URLs retain camera, filters, service, layers, selection, Map/List, projection and analysis parameters. Inspect target and minimized state use validated UI parameters. Old analysis links still open their matching view. Invalid or unauthorized targets fall back to an available view.

Automated coverage includes service bounds, background coexistence, exclusive layers, removal/Undo, tab keyboard navigation, minimized state, retained local controls, mobile workspace access, list sorting/paging, stale calculation handling, pending skeletons, native-motion fallback/cancellation, URL restoration, unsafe links and CSV escaping. API suites cover authentication, entitlements, invalid inputs, release allowlists and analysis response validation.
