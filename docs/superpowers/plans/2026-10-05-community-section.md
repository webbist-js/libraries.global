# Community Section (Band 0) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a top-level, indexable Community section at `/community` (Noticeboard landing, Leaderboard, Suggestions), move the leaderboard and the option votes out of Contribute, and link it from the header, before the 15 Oct launch.

**Architecture:** A new Next.js route segment `app/[locale]/community/` with its own layout, tab bar and `PageHero` header, mirroring `app/[locale]/contribute/`. The leaderboard page and its three components move unchanged except for imports and links. Its Strapi fetches move to `lib/community/leaderboard-server.ts`, shared by the landing page. `SuggestedAdditions` moves to `components/community/` and gains a `variant`. The landing page is the Noticeboard: until drives ship (later plans) it says so honestly and shows this month's top contributors and the votes.

**Tech Stack:** Next.js 16 App Router (RSC), TypeScript strict, Tailwind v4 plus `T` tokens, vitest with happy-dom and Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-05-noticeboard-and-drives-design.md` §4.1–4.2, §14 band 0.

## Global Constraints

- Work on `dev` in the main tree. No worktrees.
- Pre-launch: moved routes get **no redirects**. Update links and delete the old route.
- Colours and fonts come from `T` (`apps/ui/src/lib/design-tokens.ts`). Tailwind handles layout and spacing.
- Every primary page opens with `PageHero` (`components/ds`). Never hand-roll a hero.
- Community pages are indexable: use `buildMetadata` (`lib/seo/metadata.ts`), never `privateMetadata`.
- Never add `overflow-x-hidden` or `overflow: hidden` to a page wrapper.
- Named exports only, except Next.js `page.tsx` and `layout.tsx` default exports.
- Commit messages: conventional commits, scope `ui` where it's UI only, header ≤ 100 chars, **no `Co-Authored-By` line**.
- The pre-commit hook runs `eslint --fix` (errors block, warnings are fine) and commitlint.
- UI tests: `cd apps/ui && npx vitest run <path>`. Typecheck: `cd apps/ui && npx tsc --noEmit`. Two errors already exist in `app/api/profile/me/prompts/__tests__/route.test.ts`; ignore them.

---

### Task 1: Community section shell (layout, tabs, header)

**Files:**

- Create: `apps/ui/src/app/[locale]/community/layout.tsx`
- Create: `apps/ui/src/app/[locale]/community/_components/CommunityNavBar.tsx`
- Create: `apps/ui/src/app/[locale]/community/_components/CommunitySectionHeader.tsx`
- Test: `apps/ui/src/app/[locale]/community/_components/__tests__/CommunityNavBar.test.ts`

**Interfaces:**

- Produces: `activeCommunityTab(pathname: string): string | null`; `CommunityNavBar(): JSX.Element`; `CommunitySectionHeader({ section?: string, title: string, lead?: ReactNode, children?: ReactNode })`. Tab ids: `"noticeboard" | "leaderboard" | "suggestions"`.

- [ ] **Step 1: Write the failing test**

`apps/ui/src/app/[locale]/community/_components/__tests__/CommunityNavBar.test.ts`:

```ts
// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react"
import * as React from "react"
import { createElement } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

// vitest.config has no JSX runtime, so .tsx compiles to React.createElement.
Object.assign(globalThis, { React })

const nav = vi.hoisted(() => ({ path: "/community/leaderboard" }))

vi.mock("next/navigation", () => ({ usePathname: () => nav.path }))
// The ds barrel pulls in env validation; the tabs need no env.
vi.mock("@/lib/env-vars", () => ({ getEnvVar: () => {} }))
vi.mock("@iconify/react", () => ({ Icon: () => null }))
vi.mock("@/lib/navigation", async () => {
  const { createElement: h } = await import("react")

  return {
    Link: ({
      href,
      children,
      ...rest
    }: {
      href: string
      children?: React.ReactNode
    }) => h("a", { href, ...rest }, children),
  }
})

const { CommunityNavBar, activeCommunityTab } =
  await import("../CommunityNavBar")

afterEach(() => {
  cleanup()
  nav.path = "/community/leaderboard"
})

describe("CommunityNavBar", () => {
  it("links the three Community tabs and marks the current one", () => {
    render(createElement(CommunityNavBar))
    expect(
      screen.getByRole("link", { name: /Noticeboard/ }).getAttribute("href")
    ).toBe("/community")
    const leaderboard = screen.getByRole("link", { name: /Leaderboard/ })
    expect(leaderboard.getAttribute("href")).toBe("/community/leaderboard")
    expect(leaderboard.getAttribute("aria-current")).toBe("page")
    expect(
      screen.getByRole("link", { name: /Suggestions/ }).getAttribute("href")
    ).toBe("/community/suggestions")
  })
})

describe("activeCommunityTab", () => {
  it("maps the landing page and drive pages to the Noticeboard", () => {
    expect(activeCommunityTab("/community")).toBe("noticeboard")
    expect(activeCommunityTab("/fr/community")).toBe("noticeboard")
    expect(activeCommunityTab("/community/drives/ohio-hours")).toBe(
      "noticeboard"
    )
    expect(activeCommunityTab("/community/propose")).toBe("noticeboard")
  })

  it("maps the leaderboard and suggestions to their own tabs", () => {
    expect(activeCommunityTab("/community/leaderboard?period=week")).toBe(
      "leaderboard"
    )
    expect(activeCommunityTab("/community/suggestions")).toBe("suggestions")
  })

  it("ignores paths outside the section", () => {
    expect(activeCommunityTab("/contribute")).toBeNull()
    expect(activeCommunityTab("/communityx")).toBeNull()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/ui && npx vitest run 'src/app/[locale]/community/_components/__tests__/CommunityNavBar.test.ts'`
Expected: FAIL, "Failed to load url ../CommunityNavBar" (the module doesn't exist).

- [ ] **Step 3: Write the tab bar**

`apps/ui/src/app/[locale]/community/_components/CommunityNavBar.tsx`:

```tsx
"use client"

import { usePathname } from "next/navigation"

import { type SectionTab, SectionTabs } from "@/components/ds"

const COMMUNITY_TABS: readonly SectionTab[] = [
  {
    id: "noticeboard",
    href: "/community",
    label: "Noticeboard",
    icon: "mdi:pin-outline",
  },
  {
    id: "leaderboard",
    href: "/community/leaderboard",
    label: "Leaderboard",
    icon: "mdi:trophy-outline",
  },
  {
    id: "suggestions",
    href: "/community/suggestions",
    label: "Suggestions",
    icon: "mdi:thumb-up-outline",
  },
]

/** Sub-routes that belong under a tab: drive pages sit under the Noticeboard. */
const SEGMENT_TO_TAB: Record<string, string> = {
  drives: "noticeboard",
  propose: "noticeboard",
  leaderboard: "leaderboard",
  suggestions: "suggestions",
}

export function activeCommunityTab(pathname: string): string | null {
  const match = /\/community(?:\/([^/?#]+))?(?=[/?#]|$)/.exec(pathname)
  if (!match) return null
  const segment = match[1]
  if (!segment) return "noticeboard"

  return SEGMENT_TO_TAB[segment] ?? null
}

/** The Community section's tabs, on the bottom edge of its hero band. */
export function CommunityNavBar() {
  const pathname = usePathname() ?? ""

  return (
    <SectionTabs
      activeId={activeCommunityTab(pathname)}
      label="Community"
      tabs={COMMUNITY_TABS}
    />
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/ui && npx vitest run 'src/app/[locale]/community/_components/__tests__/CommunityNavBar.test.ts'`
Expected: PASS (4 tests).

- [ ] **Step 5: Write the section header and layout**

`apps/ui/src/app/[locale]/community/_components/CommunitySectionHeader.tsx`:

```tsx
import type { ReactNode } from "react"

import { PageHero } from "@/components/ds"

import { CommunityNavBar } from "./CommunityNavBar"

/**
 * Shared header for every /community route: the PageHero band (breadcrumb,
 * "Community" pill, serif title, lead) with the section's tabs on its bottom
 * edge. `title` accepts `*italic*` markup, rendered as indigo italic.
 */
export function CommunitySectionHeader({
  section,
  title,
  lead,
  children,
}: {
  /** Breadcrumb leaf after "Community". Omit on the Noticeboard itself. */
  readonly section?: string
  readonly title: string
  readonly lead?: ReactNode
  /** Rendered under the lead in the right column. */
  readonly children?: ReactNode
}) {
  return (
    <PageHero
      breadcrumb={
        section
          ? [
              { label: "Home", href: "/" },
              { label: "Community", href: "/community" },
              { label: section },
            ]
          : [{ label: "Home", href: "/" }, { label: "Community" }]
      }
      eyebrow="Community"
      eyebrowIcon="mdi:account-group-outline"
      title={title}
      lead={lead}
      tabs={<CommunityNavBar />}
    >
      {children}
    </PageHero>
  )
}
```

`apps/ui/src/app/[locale]/community/layout.tsx`:

```tsx
import type { Locale } from "next-intl"

import GlobalHeader from "@/components/global/GlobalHeader"
import { T } from "@/lib/design-tokens"

// Community pages are public and indexable, unlike /contribute: each page
// sets its own metadata with buildMetadata.
export default async function CommunityLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  return (
    <>
      <GlobalHeader locale={locale as Locale} />
      <div style={{ background: T.bg.void }}>{children}</div>
    </>
  )
}
```

- [ ] **Step 6: Typecheck**

Run: `cd apps/ui && npx tsc --noEmit`
Expected: only the two known errors in `app/api/profile/me/prompts/__tests__/route.test.ts`.

- [ ] **Step 7: Commit**

```bash
git add 'apps/ui/src/app/[locale]/community'
git commit -m "feat(ui): add the Community section's layout, tabs and header"
```

---

### Task 2: Move the leaderboard to `/community/leaderboard`

**Files:**

- Create: `apps/ui/src/lib/community/leaderboard-server.ts`
- Test: `apps/ui/src/lib/community/__tests__/leaderboard-server.test.ts`
- Move (git mv): `apps/ui/src/app/[locale]/contribute/community/_components/{LeaderboardPodium,LeaderboardRows,LeaderboardSidebar}.tsx` → `apps/ui/src/app/[locale]/community/leaderboard/_components/`
- Create: `apps/ui/src/app/[locale]/community/leaderboard/page.tsx`
- Delete: `apps/ui/src/app/[locale]/contribute/community/page.tsx` (and the then-empty folder)
- Modify: `apps/ui/src/app/[locale]/profile/[username]/_components/sections/BadgesSection.tsx:143`
- Modify: `apps/ui/src/app/[locale]/profile/[username]/_components/ProfileHero.tsx:138`

**Interfaces:**

- Consumes: `CommunitySectionHeader` (Task 1).
- Produces: from `@/lib/community/leaderboard-server`: `type LeaderboardPeriod = "today" | "week" | "month" | "all"`, `LEADERBOARD_PERIODS: { key: LeaderboardPeriod; label: string }[]`, `parsePeriod(value: string | undefined): LeaderboardPeriod`, `type Standing`, `fetchLeaderboard(period: LeaderboardPeriod, limit?: number): Promise<LeaderboardEntry[]>`, `fetchStanding(baUserId: string): Promise<Standing | null>`.

- [ ] **Step 1: Write the failing test**

`apps/ui/src/lib/community/__tests__/leaderboard-server.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest"

import { fetchLeaderboard, parsePeriod } from "../leaderboard-server"

afterEach(() => vi.unstubAllGlobals())

describe("parsePeriod", () => {
  it("keeps a known period", () => {
    expect(parsePeriod("week")).toBe("week")
    expect(parsePeriod("all")).toBe("all")
  })

  it("defaults to this month", () => {
    expect(parsePeriod(undefined)).toBe("month")
    expect(parsePeriod("decade")).toBe("month")
  })
})

describe("fetchLeaderboard", () => {
  it("asks Strapi for the period and limit", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ data: [{ rank: 1 }] }), { status: 200 })
    )
    vi.stubGlobal("fetch", fetchMock)

    const entries = await fetchLeaderboard("week", 5)

    expect(entries).toEqual([{ rank: 1 }])
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      "/api/rewards/leaderboard?period=week&limit=5"
    )
  })

  it("returns an empty list when Strapi fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 500 }))
    )
    expect(await fetchLeaderboard("month")).toEqual([])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/ui && npx vitest run src/lib/community/__tests__/leaderboard-server.test.ts`
Expected: FAIL, the module `../leaderboard-server` doesn't exist.

- [ ] **Step 3: Write the shared fetches**

`apps/ui/src/lib/community/leaderboard-server.ts`:

```ts
import "server-only"

import type { LeaderboardEntry } from "@/lib/types/leaderboard"

const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
const API_TOKEN = process.env.STRAPI_REST_READONLY_API_KEY
const SECRET = process.env.STRAPI_BRIDGE_SECRET

export type LeaderboardPeriod = "today" | "week" | "month" | "all"

export const LEADERBOARD_PERIODS: { key: LeaderboardPeriod; label: string }[] =
  [
    { key: "today", label: "Today" },
    { key: "week", label: "This week" },
    { key: "month", label: "This month" },
    { key: "all", label: "All time" },
  ]

/** A `?period=` value, or the default: this month. */
export function parsePeriod(value: string | undefined): LeaderboardPeriod {
  return LEADERBOARD_PERIODS.some((p) => p.key === value)
    ? (value as LeaderboardPeriod)
    : "month"
}

export type Standing = {
  globalRank: number | null
  tier: {
    level: number
    name: string
    nextName: string | null
    nextThreshold: number | null
    progressPercent: number
  }
  streak: number
  totalPoints: number
  pointsThisMonth: number
  recentBadges: { badgeId: string; awardedAt: string }[]
  suggestedAction: string
}

/** The top contributors for a period; empty when Strapi can't answer. */
export async function fetchLeaderboard(
  period: LeaderboardPeriod,
  limit = 50
): Promise<LeaderboardEntry[]> {
  try {
    const res = await fetch(
      `${STRAPI}/api/rewards/leaderboard?period=${period}&limit=${limit}`,
      {
        next: { revalidate: 3600 },
        headers: API_TOKEN ? { Authorization: `Bearer ${API_TOKEN}` } : {},
      }
    )
    if (!res.ok) return []
    const json = (await res.json()) as { data?: LeaderboardEntry[] }

    return json.data ?? []
  } catch {
    return []
  }
}

/** The signed-in user's tier, streak and rank, through the bridge. */
export async function fetchStanding(
  baUserId: string
): Promise<Standing | null> {
  if (!SECRET) return null
  try {
    const res = await fetch(`${STRAPI}/api/rewards/my-standing`, {
      cache: "no-store",
      headers: {
        "X-Service-Secret": SECRET,
        "X-Ba-User-Id": baUserId,
      },
    })
    if (!res.ok) return null
    const json = (await res.json()) as { data?: Standing }

    return json.data ?? null
  } catch {
    return null
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/ui && npx vitest run src/lib/community/__tests__/leaderboard-server.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Move the components and write the page**

```bash
mkdir -p 'apps/ui/src/app/[locale]/community/leaderboard/_components'
for f in LeaderboardPodium LeaderboardRows LeaderboardSidebar; do
  git mv "apps/ui/src/app/[locale]/contribute/community/_components/$f.tsx" \
         "apps/ui/src/app/[locale]/community/leaderboard/_components/$f.tsx"
done
git rm -q 'apps/ui/src/app/[locale]/contribute/community/page.tsx'
```

The three components import only `@/` paths, so they need no edits. Confirm with `grep -n "from \"\.\." 'apps/ui/src/app/[locale]/community/leaderboard/_components/'*.tsx` (expected: no output).

`apps/ui/src/app/[locale]/community/leaderboard/page.tsx` (the old page, with the fetches imported, the community header, indexable metadata and the new links):

```tsx
import type { Metadata } from "next"
import { headers } from "next/headers"

import { getSessionSSR } from "@/lib/auth-server"
import {
  fetchLeaderboard,
  fetchStanding,
  LEADERBOARD_PERIODS,
  parsePeriod,
} from "@/lib/community/leaderboard-server"
import { T } from "@/lib/design-tokens"
import { fetchOwnProfile } from "@/lib/own-profile-server"
import { buildMetadata } from "@/lib/seo/metadata"

import { CommunitySectionHeader } from "../_components/CommunitySectionHeader"
import { LeaderboardPodium } from "./_components/LeaderboardPodium"
import { LeaderboardRows } from "./_components/LeaderboardRows"
import { LeaderboardSidebar } from "./_components/LeaderboardSidebar"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params

  return buildMetadata({
    title: "Leaderboard",
    description:
      "The contributors who keep the atlas accurate and growing, ranked by points for approved changes.",
    path: "community/leaderboard",
    locale,
  })
}

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>
}) {
  const { period: periodParam } = await searchParams
  const period = parsePeriod(periodParam)

  const session = await getSessionSSR(await headers())

  const [entries, standing, profileUsername] = await Promise.all([
    fetchLeaderboard(period),
    session?.user ? fetchStanding(session.user.id) : Promise.resolve(null),
    session?.user
      ? fetchOwnProfile(session.user).then((p) => p?.username ?? null)
      : Promise.resolve(null),
  ])

  const podium = entries.slice(0, 3)
  const rest = entries.slice(3)

  return (
    <div
      style={{ minHeight: "100vh", background: T.bg.void, color: T.ink.base }}
    >
      <CommunitySectionHeader
        section="Leaderboard"
        title="The community, *in numbers.*"
        lead="Contributors who keep the atlas accurate and growing. Points are earned for every approved contribution."
      />

      <div className="mx-auto w-full max-w-[1360px] px-4 pt-8 pb-16 sm:px-8">
        <nav
          aria-label="Leaderboard period"
          className="mb-8 flex overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{ borderBottom: `1px solid ${T.border.line}` }}
        >
          {LEADERBOARD_PERIODS.map(({ key, label }) => {
            const active = period === key

            return (
              <a
                key={key}
                href={`/community/leaderboard?period=${key}`}
                aria-current={active ? "page" : undefined}
                className="-mb-px whitespace-nowrap"
                style={{
                  fontFamily: T.font.sans,
                  fontSize: "15px",
                  fontWeight: active ? 600 : 500,
                  color: active ? T.ink.base : T.ink.dim,
                  textDecoration: "none",
                  padding: "12px 14px 10px",
                  borderBottom: active
                    ? `3px solid ${T.accent.primary}`
                    : "3px solid transparent",
                  transition: "color 150ms",
                }}
              >
                {label}
              </a>
            )
          })}
        </nav>

        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section aria-labelledby="leaderboard-heading" className="min-w-0">
            <h2
              id="leaderboard-heading"
              className="m-0 mb-5"
              style={{
                fontFamily: T.font.serif,
                fontSize: "clamp(26px,3vw,32px)",
                fontWeight: 500,
                letterSpacing: "-0.01em",
                color: T.ink.base,
              }}
            >
              Top contributors
            </h2>
            {entries.length === 0 ? (
              <div
                className="rounded-[20px] px-6 py-10 text-center"
                style={{
                  background: T.bg.deep,
                  border: `1px solid ${T.border.line}`,
                }}
              >
                <p className="m-0 text-[16px]" style={{ color: T.ink.dim }}>
                  No contributions recorded for this period yet.
                </p>
              </div>
            ) : (
              <>
                <LeaderboardPodium entries={podium} />
                <LeaderboardRows entries={rest} />
              </>
            )}
          </section>

          <LeaderboardSidebar
            isSignedIn={!!session?.user}
            standing={standing}
            profileUsername={profileUsername}
          />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Update the two profile links**

In `apps/ui/src/app/[locale]/profile/[username]/_components/sections/BadgesSection.tsx`, change:

```tsx
<TextLink href="/contribute/community">View leaderboard</TextLink>
```

to:

```tsx
<TextLink href="/community/leaderboard">View leaderboard</TextLink>
```

In `apps/ui/src/app/[locale]/profile/[username]/_components/ProfileHero.tsx`, change:

```tsx
            { label: "Community", href: "/contribute/community" },
```

to:

```tsx
            { label: "Community", href: "/community" },
```

Then confirm nothing else links to the old path:
Run: `grep -rn "contribute/community" apps/ui/src`
Expected: no output.

- [ ] **Step 7: Typecheck and run the UI tests**

Run: `cd apps/ui && npx tsc --noEmit && npx vitest run`
Expected: tsc shows only the two known errors (so `&&` stops there). Run `npx vitest run` separately if it does. Every test passes.

- [ ] **Step 8: Commit**

```bash
git add -A 'apps/ui/src/app/[locale]/community/leaderboard' 'apps/ui/src/app/[locale]/contribute/community' apps/ui/src/lib/community 'apps/ui/src/app/[locale]/profile/[username]/_components'
git commit -m "feat(ui): move the leaderboard to /community/leaderboard"
```

---

### Task 3: Suggestions page and a shared `SuggestedAdditions`

**Files:**

- Move (git mv): `apps/ui/src/app/[locale]/contribute/_components/hub/SuggestedAdditions.tsx` → `apps/ui/src/components/community/SuggestedAdditions.tsx`
- Test: `apps/ui/src/components/community/__tests__/SuggestedAdditions.test.ts`
- Create: `apps/ui/src/app/[locale]/community/suggestions/page.tsx`
- Modify: `apps/ui/src/app/[locale]/contribute/page.tsx` (import path and props)

**Interfaces:**

- Produces: `SuggestedAdditions({ variant?: "card" | "page", signInReturnTo: string })` from `@/components/community/SuggestedAdditions`. `"card"` (the default) shows 4 and links "See all N suggestions" to `/community/suggestions`. `"page"` shows every suggestion.

- [ ] **Step 1: Write the failing test**

`apps/ui/src/components/community/__tests__/SuggestedAdditions.test.ts`:

```ts
// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react"
import * as React from "react"
import { createElement } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

Object.assign(globalThis, { React })

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => ({ data: { user: { id: "u1" } }, isPending: false }),
  },
}))
vi.mock("@iconify/react", () => ({ Icon: () => null }))
vi.mock("@/components/global/GlobalLink", async () => {
  const { createElement: h } = await import("react")

  return {
    default: ({
      href,
      children,
      ...rest
    }: {
      href: string
      children?: React.ReactNode
    }) => h("a", { href, ...rest }, children),
  }
})

const suggestion = (n: number) => ({
  documentId: `s${n}`,
  name: `Option ${n}`,
  optionKey: "services",
  requests: 1,
  votes: n,
  voted: false,
  libraryCount: 2,
  libraries: [],
})

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({ data: [1, 2, 3, 4, 5, 6].map(suggestion) }),
          { status: 200 }
        )
    )
  )
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const { SuggestedAdditions } = await import("../SuggestedAdditions")

describe("SuggestedAdditions", () => {
  it("shows four as a card and links to the full list", async () => {
    render(createElement(SuggestedAdditions, { signInReturnTo: "/contribute" }))
    expect(await screen.findByText("Option 4")).toBeTruthy()
    expect(screen.queryByText("Option 5")).toBeNull()
    const all = screen.getByRole("link", { name: "See all 6 suggestions" })
    expect(all.getAttribute("href")).toBe("/community/suggestions")
  })

  it("shows every suggestion as a page", async () => {
    render(
      createElement(SuggestedAdditions, {
        variant: "page",
        signInReturnTo: "/community/suggestions",
      })
    )
    expect(await screen.findByText("Option 6")).toBeTruthy()
    expect(screen.queryByRole("link", { name: /See all/ })).toBeNull()
  })
})
```

- [ ] **Step 2: Move the file, then run the test to verify it fails**

```bash
mkdir -p apps/ui/src/components/community
git mv 'apps/ui/src/app/[locale]/contribute/_components/hub/SuggestedAdditions.tsx' apps/ui/src/components/community/SuggestedAdditions.tsx
```

Run: `cd apps/ui && npx vitest run src/components/community/__tests__/SuggestedAdditions.test.ts`
Expected: FAIL. It can't resolve `./YourSubmissionsList` (the old relative import), or, once that's fixed, it can't find the "See all 6 suggestions" link.

- [ ] **Step 3: Make the component standalone, with a variant**

In `apps/ui/src/components/community/SuggestedAdditions.tsx`:

(a) Replace the import:

```tsx
import { CardHeading, HUB_CARD } from "./YourSubmissionsList"
```

with nothing, and add this below the `PAGE` constant:

```tsx
const CARD =
  "flex h-full flex-col rounded-[20px] border border-(--t-border-line) bg-white"
```

(b) Replace the doc comment and signature:

```tsx
/**
 * Options contributors asked for that aren't in the lists yet. Signed-in
 * contributors vote; the editorial board sees the tally in the moderation
 * plugin and considers new additions monthly.
 */
export function SuggestedAdditions() {
```

with:

```tsx
/**
 * Options contributors asked for that aren't in the lists yet. Signed-in
 * contributors vote; the editorial board sees the tally in the moderation
 * plugin and considers new additions monthly. As a card (the Contribute hub,
 * the Noticeboard) it shows the top four and links to the full list at
 * /community/suggestions; as a page it shows them all.
 */
export function SuggestedAdditions({
  variant = "card",
  signInReturnTo,
}: {
  readonly variant?: "card" | "page"
  /** Where "Sign in to vote" comes back to. */
  readonly signInReturnTo: string
}) {
```

(c) Delete the `showAll` state line:

```tsx
const [showAll, setShowAll] = useState(false)
```

(d) Replace:

```tsx
const shown = showAll ? (items ?? []) : (items ?? []).slice(0, PAGE)
const hidden = (items?.length ?? 0) - shown.length
const signIn = `/auth/signin?callbackUrl=${encodeURIComponent("/contribute#suggested-additions")}`
```

with:

```tsx
const shown = variant === "page" ? (items ?? []) : (items ?? []).slice(0, PAGE)
const hidden = (items?.length ?? 0) - shown.length
const signIn = `/auth/signin?callbackUrl=${encodeURIComponent(signInReturnTo)}`
```

(e) Replace the opening of the returned markup:

```tsx
    <section aria-labelledby="suggested-additions" className={HUB_CARD}>
      <div
        className="border-b px-5 py-5"
        style={{ borderColor: T.border.divider }}
      >
        <CardHeading id="suggested-additions">Vote on additions</CardHeading>
```

with:

```tsx
    <section aria-labelledby="suggested-additions" className={CARD}>
      <div
        className="border-b px-5 py-5"
        style={{ borderColor: T.border.divider }}
      >
        <h2
          id="suggested-additions"
          className="m-0"
          style={{
            fontFamily: T.font.serif,
            fontSize: "24px",
            fontWeight: 500,
            lineHeight: 1.2,
            letterSpacing: "-0.01em",
            color: T.ink.base,
          }}
        >
          Vote on additions
        </h2>
```

(f) Replace the "Show N more" button:

```tsx
{
  hidden > 0 ? (
    <button
      type="button"
      onClick={() => setShowAll(true)}
      className="self-start text-[14px] font-semibold underline underline-offset-[3px]"
      style={{ color: T.accent.primary }}
    >
      Show {hidden} more
    </button>
  ) : null
}
```

with:

```tsx
{
  hidden > 0 ? (
    <GlobalLink
      href="/community/suggestions"
      className="self-start text-[14px] font-semibold underline underline-offset-[3px]"
      style={{ color: T.accent.primary }}
    >
      See all {items?.length ?? 0} suggestions
    </GlobalLink>
  ) : null
}
```

Before (a), check that `CardHeading`'s `h2` style matches the one used in (e): `sed -n '56,80p' 'apps/ui/src/app/[locale]/contribute/_components/hub/YourSubmissionsList.tsx'`. If it has more style keys, copy them into (e).

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/ui && npx vitest run src/components/community/__tests__/SuggestedAdditions.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Point the hub at it, and add the page**

In `apps/ui/src/app/[locale]/contribute/page.tsx`, replace:

```tsx
import { SuggestedAdditions } from "./_components/hub/SuggestedAdditions"
```

with:

```tsx
import { SuggestedAdditions } from "@/components/community/SuggestedAdditions"
```

Move the import into the `@/` import group so ESLint's import order passes; `eslint --fix` does this at commit. Replace:

```tsx
<SuggestedAdditions />
```

with:

```tsx
<SuggestedAdditions signInReturnTo="/contribute#suggested-additions" />
```

`apps/ui/src/app/[locale]/community/suggestions/page.tsx`:

```tsx
import type { Metadata } from "next"

import { SuggestedAdditions } from "@/components/community/SuggestedAdditions"
import { T } from "@/lib/design-tokens"
import { buildMetadata } from "@/lib/seo/metadata"

import { CommunitySectionHeader } from "../_components/CommunitySectionHeader"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params

  return buildMetadata({
    title: "Suggested additions",
    description:
      "Services, amenities and accessibility features contributors want added to the lists. Vote for the ones you'd use.",
    path: "community/suggestions",
    locale,
  })
}

export default function SuggestionsPage() {
  return (
    <div
      style={{ minHeight: "100vh", background: T.bg.void, color: T.ink.base }}
    >
      <CommunitySectionHeader
        section="Suggestions"
        title="What should the lists *include?*"
        lead="When contributors correct a library, they can name an option the lists don't have yet. Vote for the ones you'd use; the editorial board decides monthly."
      />
      <div className="mx-auto w-full max-w-[880px] px-4 pt-8 pb-16 sm:px-8">
        <SuggestedAdditions
          variant="page"
          signInReturnTo="/community/suggestions"
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Typecheck and run the UI tests**

Run: `cd apps/ui && npx tsc --noEmit; npx vitest run`
Expected: only the two known tsc errors; every test passes.

- [ ] **Step 7: Commit**

```bash
git add -A apps/ui/src/components/community 'apps/ui/src/app/[locale]/contribute' 'apps/ui/src/app/[locale]/community/suggestions'
git commit -m "feat(ui): give suggested additions their own page under Community"
```

---

### Task 4: The Noticeboard landing page (`/community`)

**Files:**

- Create: `apps/ui/src/app/[locale]/community/page.tsx`

**Interfaces:**

- Consumes: `CommunitySectionHeader` (Task 1), `fetchLeaderboard` (Task 2), `LeaderboardRows` (moved in Task 2), `SuggestedAdditions` (Task 3).
- Produces: the `/community` route that the drives plans (D1) fill in. Keep the `id="drives"` section, which D1 replaces with the drive lists.

This page is a composition of tested parts; the Playwright smoke in Task 5 covers it.

- [ ] **Step 1: Write the page**

`apps/ui/src/app/[locale]/community/page.tsx`:

```tsx
import { Icon } from "@iconify/react"
import type { Metadata } from "next"

import { SuggestedAdditions } from "@/components/community/SuggestedAdditions"
import GlobalLink from "@/components/global/GlobalLink"
import { fetchLeaderboard } from "@/lib/community/leaderboard-server"
import { T } from "@/lib/design-tokens"
import { buildMetadata } from "@/lib/seo/metadata"

import { CommunitySectionHeader } from "./_components/CommunitySectionHeader"
import { LeaderboardRows } from "./leaderboard/_components/LeaderboardRows"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params

  return buildMetadata({
    title: "Community",
    description:
      "Community drives to fill gaps in the index, the contributors behind it, and the additions people are voting for.",
    path: "community",
    locale,
  })
}

const CARD = "rounded-[20px] border bg-white"

export default async function CommunityPage() {
  const top = await fetchLeaderboard("month", 5)

  return (
    <div
      style={{ minHeight: "100vh", background: T.bg.void, color: T.ink.base }}
    >
      <CommunitySectionHeader
        title="The *noticeboard.*"
        lead="Community drives to fill gaps in the index. Pick one, work through small tasks, and see the whole effort move forward."
      />

      <div className="mx-auto flex w-full max-w-[1360px] flex-col gap-8 px-4 pt-8 pb-16 sm:px-8">
        {/* Replaced by the drive lists when drives ship (D1). */}
        <section
          id="drives"
          aria-labelledby="drives-heading"
          className={`${CARD} flex flex-col gap-3 px-6 py-8 sm:px-8`}
          style={{ borderColor: T.border.line }}
        >
          <span
            aria-hidden="true"
            className="flex size-10 items-center justify-center rounded-full"
            style={{ background: T.accent.chip, color: T.accent.primary }}
          >
            <Icon icon="mdi:pin-outline" width={20} height={20} />
          </span>
          <h2
            id="drives-heading"
            className="m-0"
            style={{
              fontFamily: T.font.serif,
              fontSize: "clamp(24px,2.6vw,30px)",
              fontWeight: 500,
              letterSpacing: "-0.01em",
            }}
          >
            No drives are open yet
          </h2>
          <p
            className="m-0 max-w-[640px] text-[16px] leading-[1.6]"
            style={{ color: T.ink.dim }}
          >
            A drive is a short, shared effort to fill one kind of gap, such as
            opening hours for a county's libraries or photos of a city's
            branches. Until the first one opens, you can improve any record from
            the Index editor.
          </p>
          <GlobalLink
            href="/contribute/index"
            className="mt-1 inline-flex h-10 items-center self-start rounded-full bg-(--t-accent-primary) px-4 text-[15px] font-semibold text-white no-underline hover:bg-(--t-accent-primary-hover)"
          >
            Improve a record
          </GlobalLink>
        </section>

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <section
            aria-labelledby="top-contributors"
            className={`${CARD} flex flex-col`}
            style={{ borderColor: T.border.line }}
          >
            <div
              className="flex items-baseline justify-between gap-4 border-b px-5 py-5"
              style={{ borderColor: T.border.divider }}
            >
              <h2
                id="top-contributors"
                className="m-0"
                style={{
                  fontFamily: T.font.serif,
                  fontSize: "24px",
                  fontWeight: 500,
                  letterSpacing: "-0.01em",
                }}
              >
                Top contributors this month
              </h2>
              <GlobalLink
                href="/community/leaderboard"
                className="text-[14px] font-semibold underline underline-offset-[3px]"
                style={{ color: T.accent.primary }}
              >
                Full leaderboard
              </GlobalLink>
            </div>
            {top.length === 0 ? (
              <p
                className="m-0 px-5 py-6 text-[15px]"
                style={{ color: T.ink.dim }}
              >
                No contributions recorded this month yet.
              </p>
            ) : (
              <div className="px-2 py-2">
                <LeaderboardRows entries={top} />
              </div>
            )}
          </section>

          <SuggestedAdditions signInReturnTo="/community#suggested-additions" />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Check it renders**

Run: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/community`
Expected: `200` (the UI dev server is running on :3000). Then open `http://localhost:3000/community`: the hero shows "The _noticeboard._" with the three tabs and Noticeboard active; the empty drives card; and this month's top contributors beside the votes. `LeaderboardRows` may render its own outer frame; if it doubles up with the card border, drop the `px-2 py-2` wrapper's padding.

- [ ] **Step 3: Typecheck**

Run: `cd apps/ui && npx tsc --noEmit`
Expected: only the two known errors.

- [ ] **Step 4: Commit**

```bash
git add 'apps/ui/src/app/[locale]/community/page.tsx'
git commit -m "feat(ui): open the Community section with the noticeboard"
```

---

### Task 5: Header link, Contribute tab removal, sitemap, docs and a smoke test

**Files:**

- Modify: `apps/ui/src/components/global/GlobalHeader.tsx:18-24`
- Modify: `apps/ui/src/app/[locale]/contribute/_components/ContributeNavBar.tsx`
- Modify: `apps/ui/src/app/[locale]/contribute/_components/__tests__/ContributeNavBar.test.ts`
- Modify: `apps/ui/src/lib/sitemap/entries.ts:96-113`
- Modify: `CLAUDE.md` (routing table; Future Goals §3 "UI" tab list)
- Modify: `docs/user-touchpoints.md` (the leaderboard section)
- Create: `qa/tests/playwright/e2e/community.spec.ts`

**Interfaces:**

- Consumes: the routes from Tasks 1–4.

- [ ] **Step 1: Write the failing unit test**

In `apps/ui/src/app/[locale]/contribute/_components/__tests__/ContributeNavBar.test.ts`, add inside `describe("ContributeNavBar", …)`:

```ts
it("has no Community tab: Community is its own section", () => {
  render(createElement(ContributeNavBar))
  expect(screen.queryByRole("link", { name: /Community/ })).toBeNull()
  expect(activeContributeTab("/contribute/community")).toBeNull()
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/ui && npx vitest run 'src/app/[locale]/contribute/_components/__tests__/ContributeNavBar.test.ts'`
Expected: FAIL. The Community link is still there.

- [ ] **Step 3: Remove the tab**

In `ContributeNavBar.tsx`, delete this entry from `NAV_ITEMS`:

```tsx
  {
    id: "community",
    href: "/contribute/community",
    label: "Community",
    icon: "mdi:account-group-outline",
  },
```

and this line from `SEGMENT_TO_TAB`:

```tsx
  community: "community",
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd apps/ui && npx vitest run 'src/app/[locale]/contribute/_components/__tests__/ContributeNavBar.test.ts'`
Expected: PASS (4 tests).

- [ ] **Step 5: Header link and sitemap**

In `apps/ui/src/components/global/GlobalHeader.tsx`, change `NAV_LINKS` to:

```tsx
const NAV_LINKS: NavLink[] = [
  { label: "Atlas", href: "/map" },
  { label: "Find libraries", href: "/libraries" },
  { label: "Community", href: "/community" },
  { label: "Journal", href: "/journal" },
  { label: "Events", href: "/events" },
  { label: "Knowledge", href: "/knowledge" },
]
```

(The mobile menu reads the same list.)

In `apps/ui/src/lib/sitemap/entries.ts`, add after the `knowledge` entry in `STATIC_ROUTES`:

```ts
  { path: "community", changeFrequency: "daily", priority: 0.6 },
  {
    path: "community/leaderboard",
    changeFrequency: "daily",
    priority: 0.4,
  },
  {
    path: "community/suggestions",
    changeFrequency: "weekly",
    priority: 0.4,
  },
```

- [ ] **Step 6: Write the Playwright smoke test**

`qa/tests/playwright/e2e/community.spec.ts`:

```ts
import { expect, test } from "@playwright/test"

test.describe("Community section", () => {
  test("the header links to the Noticeboard and its tabs work", async ({
    page,
  }) => {
    await page.goto("/")
    await page
      .getByRole("navigation", { name: "Main" })
      .getByRole("link", { name: "Community" })
      .click()
    await expect(page).toHaveURL(/\/community$/)
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "noticeboard"
    )

    const tabs = page.getByRole("navigation", { name: "Community" })
    await tabs.getByRole("link", { name: /Leaderboard/ }).click()
    await expect(page).toHaveURL(/\/community\/leaderboard$/)
    await expect(
      page.getByRole("navigation", { name: "Leaderboard period" })
    ).toBeVisible()

    await tabs.getByRole("link", { name: /Suggestions/ }).click()
    await expect(page).toHaveURL(/\/community\/suggestions$/)
    await expect(
      page.getByRole("heading", { name: "Vote on additions" })
    ).toBeVisible()
  })

  test("Community pages are indexable", async ({ page }) => {
    await page.goto("/community")
    await expect(page.locator('meta[name="robots"]')).not.toHaveAttribute(
      "content",
      /noindex/
    )
  })

  test("the old Contribute leaderboard route is gone", async ({ page }) => {
    const res = await page.goto("/contribute/community")
    expect(res?.status()).toBe(404)
  })
})
```

Run: `cd qa/tests/playwright && BASE_URL=http://localhost:3000 npx playwright test e2e/community.spec.ts --project=chromium`
Expected: 3 passed. The header nav is hidden below `lg` (1024px), so this runs at the desktop default. If a robots meta tag is absent entirely, the second test still passes.

- [ ] **Step 7: Docs**

In `CLAUDE.md`'s routing table (under "### Routing"), add after the `/libraries` row:

```markdown
| `/community` | Noticeboard: community drives (CommunityPage) |
| `/community/leaderboard`, `/community/suggestions` | Leaderboard; option votes (moved out of Contribute) |
```

In CLAUDE.md's Future Goals §3 "UI" bullet, change `tabs Hub, Community, Index editor` to `tabs Hub, Index editor`. Add after that sentence: `Community (leaderboard, suggestions, drives) is its own section at /community.`

In `docs/user-touchpoints.md`, replace:

```markdown
### Community Leaderboard (`/contribute/community`)
```

with:

```markdown
### Community Leaderboard (`/community/leaderboard`)
```

- [ ] **Step 8: Run everything**

Run: `cd apps/ui && npx tsc --noEmit; npx vitest run`
Expected: only the two known tsc errors; every test passes.

- [ ] **Step 9: Commit**

```bash
git add apps/ui/src/components/global/GlobalHeader.tsx 'apps/ui/src/app/[locale]/contribute/_components' apps/ui/src/lib/sitemap/entries.ts CLAUDE.md docs/user-touchpoints.md qa/tests/playwright/e2e/community.spec.ts
git commit -m "feat(ui): link Community from the header and take it out of Contribute"
```
