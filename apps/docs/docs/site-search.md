---
title: Site search
description: Public result contract, data sources and acceptance checks for the dashboard search.
---

# Site search

The page toolbar and ordinary public header open one shared modal. Cmd/Ctrl+K opens or closes it. The dashboard masthead remains icon navigation only.

`GET /api/site-search?q=…&locale=en` returns bounded public result rows, counts, approximate-count flags and unavailable groups. Queries are limited to 120 characters, supported interface locales are validated, the closed-beta gate applies, and an IP limiter allows 120 requests per minute. Responses use `private, no-store`. Search credentials stay on the server.

| Group             | Source                                                    | Destination and boundary                                                               |
| ----------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Libraries         | Existing `library` Meilisearch index                      | Canonical library path; records without geography open a name search in Find libraries |
| Places            | Published continent, country, region and area CMS records | Geographic page or area-filtered directory; includes places with no library records    |
| Journal           | Existing public `blog-article` index                      | Published article title, summary, section and locale only                              |
| Knowledge         | Existing public `wiki-article` index                      | Published guide title, summary, section and locale only                                |
| Events            | Existing reviewed public `event` index                    | Upcoming/ongoing events with valid document IDs                                        |
| Site destinations | Translated catalogue maintained in code                   | Real public routes such as Atlas, Find, Community and plans                            |

Each remote group has a five-second timeout. Healthy groups remain visible when another source fails. Only an event `index_not_found` response means an empty calendar; connection and permission errors remain unavailable states. Place counts are bounded estimates when a result cap is reached. Meilisearch estimated totals are marked as estimates in the modal.

The browser debounces queries, cancels superseded requests and associates each response with its query/locale key. Radix owns focus trapping and restoration. The combobox supports arrow selection and Enter; links remain clickable. Recent terms use a versioned localStorage key, are capped at five and can be cleared. No account or staff data is included in search results.

Article bodies, Sources, public profiles, discussions, drives and individual network records need additional public projections before they can become result groups. Current search does not expose them. Network and contribution destination pages remain discoverable through the catalogue.

## Acceptance

Check a library, an empty place, a Journal story, a Knowledge guide, an event and a site destination. Check each scope, zero results, a missing event index, a failed group, keyboard selection, Escape, focus return, recent-query clearing and narrow screens. Confirm that queries and private account fields do not appear in shared cache responses. Retain the existing moderation and publication predicates of each index.

The reader-facing draft is [Searching Libraries Global](proposals/site-search-knowledge-article.md). Publish it with the release after acceptance, through the existing editorial workflow.
