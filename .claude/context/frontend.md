## Frontend Architecture

### Routing

All routes are under `app/[locale]/`. Key routes:

| Route                                                 | Component                                                                                                                       |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `/`                                                   | HomePage                                                                                                                        |
| `/libraries`                                          | FindLibraryPage (faceted search/browse — "Find libraries")                                                                      |
| `/community`                                          | Noticeboard: community drives (CommunityPage)                                                                                   |
| `/community/leaderboard`, `/community/suggestions`    | Leaderboard; option votes (moved out of Contribute)                                                                             |
| `/community/drives/[slug]`                            | DriveDetailPage (a Drive's page: task panel, Your part)                                                                         |
| `/community/drives/new`, `/[slug]/edit`               | DriveBuilder (editorial board only: create, edit a Drive)                                                                       |
| `/community/propose`                                  | DriveBuilder (proposal mode: propose a drive)                                                                                   |
| `/[continent]`                                        | ContinentDetailPage                                                                                                             |
| `/[continent]/[country]`                              | CountryDetailPage                                                                                                               |
| `/[continent]/[country]/[region]`                     | RegionDetailPage                                                                                                                |
| `/[continent]/[country]/[region]/[library]`           | LibraryDetailPage                                                                                                               |
| `/map`                                                | Atlas: AtlasExplorer (MapLibre GL full-screen)                                                                                  |
| `/knowledge/[section]/[slug]`                         | DocsArticlePage (Knowledge article)                                                                                             |
| `/journal/[section]/[slug]`                           | BlogArticlePage (Journal article)                                                                                               |
| `/contribute/index`, `/new`, `/[slug]`                | Index editor: find a library, add one, improve a record                                                                         |
| `/contribute/knowledge`                               | Knowledge editor landing: write new / edit existing                                                                             |
| `/contribute/knowledge/new?type=`                     | Article editor (TipTap) for a new Knowledge or Journal article                                                                  |
| `/contribute/knowledge/[slug]`, `/journal/[slug]`     | Article editor for an existing article, incl. translations                                                                      |
| `/contribute/knowledge/apply?role=`                   | Role Application: apply to be a Knowledge or Journal editor                                                                     |
| `/contribute/moderation`, `/[documentId]`             | Moderation queue and review page (Moderators only)                                                                              |
| `/contribute/moderation/suggestions`                  | Option suggestions (editorial board only)                                                                                       |
| `/staff`                                              | Staff area index: your libraries as cards, "Your team" card                                                                     |
| `/staff/[slug]`                                       | Staff shell (`StaffShell`): Overview, then the tabs below. Staff pages are addressed by the library's slug; APIs by document id |
| `/staff/[slug]/edit`, `/notices`, `/traffic`, `/team` | Edit record (the Index editor in staff mode), Notices, Traffic (Team), Team (Team)                                              |
| `/staff/[slug]/timetable`, `/live`                    | Timetable editor and Go live tab (Mobile libraries only; 404 otherwise)                                                         |
| `/staff/[slug]/events`                                | Event feeds: a library's feeds; `/connect`, `/[feedId]/replace`, `/[feedId]/organisation` (Eventbrite OAuth)                    |
| `/staff/team`                                         | Team organiser (`TeamOrganiser`): invite, assign, remove; members see it read only                                              |
| `/staff/team/join/[token]`                            | Accept a team invite (the signed-in email must match)                                                                           |
| `/live`, `/live/[documentId]`                         | Mobile live console: pick a vehicle; one library's console (phone-first, no site chrome, own manifest and CSP)                  |
| `/auth/*`                                             | Auth flows (sign in, register, OAuth, reset password)                                                                           |

`/staff/**` and `/live/**` are hidden sections: `robots: { index: false, follow: false }` in their layouts, disallowed in `app/robots.ts`, never listed by `lib/sitemap/`, and 404 for anyone who is not staff of that library (`loadStaffPage` in `lib/staff/server.ts` is the server authority; signed out goes to `/auth/signin?callbackUrl=`). They render no Contribute tabs. The old `/contribute/staff/**`, `/contribute/events/**` and `/staff/invite/[token]` routes are deleted with no redirects (pre-launch).

### Data fetching

- All data fetching happens in RSC page components via `lib/strapi-api/content/server.ts`
- Client components receive data as props — no client-side Strapi calls
- Map pin data fetched client-side via `/api/map/*` endpoints (for real-time filtering)
- Search uses MeiliSearch client directly from the browser

### Auth

- **Better Auth** manages the session cookie (JWE, 30-day cache)
- Auth is backed entirely by Strapi users-permissions
- Custom plugins: `strapiAuthPlugin` (credentials), `strapiOAuthPlugin` (OAuth → Strapi JWT sync), `strapiSessionPlugin` (validates Strapi JWT on every session access)
- Session includes `strapiJWT` for making authenticated Strapi API calls on behalf of the user
- Auth pages: `/auth/signin`, `/auth/register`, `/auth/forgot-password`, `/auth/change-password`

---

## Key Conventions

### File organisation

- `components/ds/` — design system primitives (generic, reusable)
- `components/elementary/` — layout primitives (Container, etc.)
- `components/global/` — site-wide chrome (GlobalHeader, GlobalFooter, GlobalLink)
- `components/[feature]/` — feature-specific components (continent, country, region, library, map, wiki, blog)
- `components/staff/`: the Staff area: `StaffDrawer` and `StaffDrawerTab` (the drawer and its edge tab), `TeamOrganiser`, `StaffNotices`, `LibraryNoticeForm`; the shell lives beside its routes in `app/[locale]/staff/[slug]/_components/`
- `components/mobile/`: Mobile libraries: `TimetableEditor`, `MobileRouteMap`, and `live/` (the console, `GoLiveToday`, `ConsolePreview`, `LiveSharingSettings`, `LiveSessionsTable`, `LivePrivacyCard`)
- `components/home/` — homepage-specific components
- `lib/` — utilities, API clients, tokens, helpers
- `app/[locale]/` — Next.js route segments (pages are thin — pass data to `*DetailPage` components)

### Naming

- Page components: `{Entity}DetailPage` (e.g. `LibraryDetailPage`, `CountryDetailPage`)
- DS components: PascalCase noun (`PageHero`, `LocationGridBrowser`)
- Always export named (not default) from DS files; default export is for Next.js page files only

### Strapi data fetching

- All fetch functions live in `lib/strapi-api/content/server.ts`
- Use `PublicStrapiClient` for public reads, `PrivateStrapiClient` for auth-gated operations
- Respect `draftMode()` — pass `status: dm.isEnabled ? "draft" : "published"`
- Never call Strapi from client components

### Map helpers

Basemap attribution and bounding boxes: `components/map/map.helpers.ts`. Location pages use `components/location/LocationHeroMap.tsx`.

---
