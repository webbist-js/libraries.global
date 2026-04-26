# Stream C: Onboarding Route Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Prerequisite:** Stream A must be deployed first (user-profile schema with new fields; topics plugin). Stream B components (`CountryCombobox`, `TimezoneCombobox`) should be available before starting Task 3.

**Goal:** Build a full-screen `/onboarding` first-login wizard covering identity, library affiliation claim (with MeiliSearch search + email domain auto-verification + vouching/contact-us fallback), interests & languages, external links, and profile visibility.

**Architecture:** RSC page shell with auth guard. All state is client-side in `OnboardingShell`. Each step saves independently via `PUT /api/profile/me`. The library claim flow calls `POST /api/profile/me/claim-library` which does email domain matching server-side and creates a content-moderation submission for non-auto-verified claims. MeiliSearch is called from the API route (server-side), not from the browser.

**Tech Stack:** Next.js 15 App Router, React client components, Better Auth session, MeiliSearch, T design tokens

**Important:** `country_slug` is already a filterable attribute on the MeiliSearch `library` index (confirmed in `apps/strapi/config/plugins.ts`).

---

## File Map

**Create:**

- `apps/ui/src/app/[locale]/onboarding/page.tsx`
- `apps/ui/src/app/[locale]/onboarding/_components/OnboardingShell.tsx`
- `apps/ui/src/app/[locale]/onboarding/_components/OnboardingIdentity.tsx`
- `apps/ui/src/app/[locale]/onboarding/_components/OnboardingAffiliation.tsx`
- `apps/ui/src/app/[locale]/onboarding/_components/LibraryClaimSearch.tsx`
- `apps/ui/src/app/[locale]/onboarding/_components/OnboardingInterests.tsx`
- `apps/ui/src/app/[locale]/onboarding/_components/OnboardingLinks.tsx`
- `apps/ui/src/app/[locale]/onboarding/_components/OnboardingVisibility.tsx`
- `apps/ui/src/app/api/profile/me/claim-library/route.ts`

---

## Task 1: claim-library API route

**Files:**

- Create: `apps/ui/src/app/api/profile/me/claim-library/route.ts`

The claim-library route:

1. Receives: `{ libraryEntityRef, libraryName, libraryWebsite, role, department }`
2. Extracts domain from user email and library website
3. If domains match → auto-verify (update profile directly)
4. Otherwise → create a content-moderation submission with `verificationMethod: vouching | contact_us`

- [ ] **Step 1: Create the route**

Create `apps/ui/src/app/api/profile/me/claim-library/route.ts`:

```typescript
import { headers } from "next/headers"
import { NextResponse } from "next/server"

import { auth } from "@/lib/auth"

const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
const SECRET = process.env.STRAPI_BRIDGE_SECRET

function extractDomain(url: string): string {
  try {
    const parsed = new URL(url.startsWith("http") ? url : `https://${url}`)
    return parsed.hostname.replace(/^www\./, "").toLowerCase()
  } catch {
    return ""
  }
}

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!SECRET)
    return NextResponse.json(
      { error: "Bridge not configured" },
      { status: 500 }
    )

  const body = (await req.json()) as {
    libraryEntityRef: string
    libraryName: string
    libraryWebsite?: string
    role?: string
    department?: string
  }

  const { libraryEntityRef, libraryName, libraryWebsite, role, department } =
    body
  if (!libraryEntityRef || !libraryName)
    return NextResponse.json(
      { error: "libraryEntityRef and libraryName are required" },
      { status: 400 }
    )

  // Check email domain vs library website domain
  const emailDomain = session.user.email.split("@")[1]?.toLowerCase() ?? ""
  const libraryDomain = libraryWebsite ? extractDomain(libraryWebsite) : ""
  const domainMatch =
    emailDomain.length > 0 &&
    libraryDomain.length > 0 &&
    emailDomain === libraryDomain

  if (domainMatch) {
    // Auto-verify via upsert-profile
    const res = await fetch(`${STRAPI}/api/auth-bridge/upsert-profile`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Service-Secret": SECRET,
      },
      body: JSON.stringify({
        baUserId: session.user.id,
        claimedLibraryEntityRef: libraryEntityRef,
        claimedLibraryName: libraryName,
        claimedLibraryRole: role ?? "",
        claimedLibraryDepartment: department ?? "",
        affiliationVerificationStatus: "verified",
        affiliationVerificationMethod: "email_domain",
        isVerifiedLibrarian: true,
      }),
    })
    if (!res.ok)
      return NextResponse.json(
        { error: "Failed to update profile" },
        { status: 500 }
      )
    return NextResponse.json({ status: "verified", method: "email_domain" })
  }

  // Check if there are verified librarians at this library (for vouching)
  const vouchCheckRes = await fetch(
    `${STRAPI}/api/user-profiles?filters[claimedLibraryEntityRef][$eq]=${encodeURIComponent(libraryEntityRef)}&filters[isVerifiedLibrarian][$eq]=true&fields[0]=id`,
    { next: { revalidate: 0 } }
  )
  let verificationMethod = "contact_us"
  if (vouchCheckRes.ok) {
    const vouchJson = (await vouchCheckRes.json()) as { data: unknown[] }
    if (vouchJson.data.length > 0) verificationMethod = "vouching"
  }

  // Update profile to pending
  await fetch(`${STRAPI}/api/auth-bridge/upsert-profile`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Service-Secret": SECRET },
    body: JSON.stringify({
      baUserId: session.user.id,
      claimedLibraryEntityRef: libraryEntityRef,
      claimedLibraryName: libraryName,
      claimedLibraryRole: role ?? "",
      claimedLibraryDepartment: department ?? "",
      affiliationVerificationStatus: "pending",
      affiliationVerificationMethod: verificationMethod,
    }),
  })

  // Create moderation submission
  const submissionRes = await fetch(
    `${STRAPI}/api/content-moderation/submissions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: (await headers()).get("cookie") ?? "",
      },
      body: JSON.stringify({
        submissionType: "library_claim",
        targetEntityType: "library",
        targetSlug: libraryEntityRef,
        verificationMethod,
        fields: {
          entityRef: libraryEntityRef,
          name: libraryName,
          role: role ?? "",
          department: department ?? "",
          userEmailDomain: emailDomain,
          libraryWebsiteDomain: libraryDomain,
        },
        note: `Library affiliation claim: ${libraryName} (${libraryEntityRef}) — ${verificationMethod}`,
      }),
    }
  )

  if (!submissionRes.ok)
    return NextResponse.json(
      { error: "Failed to submit claim" },
      { status: 500 }
    )

  return NextResponse.json({ status: "pending", method: verificationMethod })
}
```

- [ ] **Step 2: Test the route (manual)**

Start the dev server. Sign in as a test user. Test the claim-library endpoint:

```bash
curl -s -X POST http://localhost:3000/api/profile/me/claim-library \
  -H "Content-Type: application/json" \
  -H "Cookie: <your-session-cookie>" \
  -d '{"libraryEntityRef":"GB-BL-001","libraryName":"British Library","libraryWebsite":"https://bl.uk","role":"Reference Librarian","department":"Rare Books"}' | jq .
```

Expected: `{ status: "pending", method: "contact_us" }` (unless your email domain is `bl.uk`).

- [ ] **Step 3: Commit**

```bash
git add apps/ui/src/app/api/profile/me/claim-library/
git commit -m "feat(ui): add claim-library API route with email domain verification"
```

---

## Task 2: Onboarding page RSC shell

**Files:**

- Create: `apps/ui/src/app/[locale]/onboarding/page.tsx`

- [ ] **Step 1: Create the page**

Create `apps/ui/src/app/[locale]/onboarding/page.tsx`:

```typescript
import { redirect } from "next/navigation"

import { getSession } from "@/lib/auth-server"

export default async function OnboardingPage() {
  const session = await getSession()
  if (!session?.user) redirect("/auth/signin?callbackUrl=/onboarding")

  // Fetch current profile
  const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
  const profileRes = await fetch(
    `${STRAPI}/api/user-profiles?filters[baUserId][$eq]=${encodeURIComponent(session.user.id)}&publicationState=live`,
    { next: { revalidate: 0 } }
  )
  const profileJson = profileRes.ok
    ? ((await profileRes.json()) as { data?: Array<{ id: number; attributes?: Record<string, unknown> }> })
    : { data: [] }
  const row = profileJson.data?.[0]
  const profile = row ? { id: row.id, ...row.attributes } : null

  // Dynamically import the client shell to keep this RSC lean
  const { OnboardingShell } = await import("./_components/OnboardingShell")

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#030511",
        display: "flex",
        flexDirection: "column",
        color: "#f4f7ff",
        fontFamily: "Roboto, sans-serif",
      }}
    >
      <OnboardingShell
        sessionUser={{
          id: session.user.id,
          name: session.user.name,
          email: session.user.email,
          image: session.user.image ?? null,
        }}
        initialProfile={profile as any}
      />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/ui/src/app/[locale]/onboarding/page.tsx
git commit -m "feat(ui): add onboarding RSC page shell with auth guard"
```

---

## Task 3: OnboardingShell wizard

**Files:**

- Create: `apps/ui/src/app/[locale]/onboarding/_components/OnboardingShell.tsx`

- [ ] **Step 1: Create OnboardingShell**

Create `apps/ui/src/app/[locale]/onboarding/_components/OnboardingShell.tsx`:

```tsx
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { T } from "@/lib/design-tokens"
import type { UserProfile } from "@/lib/types/profile"
import { OnboardingIdentity } from "./OnboardingIdentity"
import { OnboardingAffiliation } from "./OnboardingAffiliation"
import { OnboardingInterests } from "./OnboardingInterests"
import { OnboardingLinks } from "./OnboardingLinks"
import { OnboardingVisibility } from "./OnboardingVisibility"

type SessionUser = {
  id: string
  name: string
  email: string
  image: string | null
}

const STEPS = ["Identity", "Affiliation", "Interests", "Links", "Visibility"]

export function OnboardingShell({
  sessionUser,
  initialProfile,
}: {
  sessionUser: SessionUser
  initialProfile: UserProfile | null
}) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)

  const saveSection = async (data: Partial<UserProfile>) => {
    setSaving(true)
    try {
      const res = await fetch("/api/profile/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) toast.error("Failed to save — your progress is not lost")
    } catch {
      toast.error("Failed to save")
    } finally {
      setSaving(false)
    }
  }

  const advance = async (data?: Partial<UserProfile>) => {
    if (data) await saveSection(data)
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1)
    } else {
      router.push("/profile")
    }
  }

  const skip = () => {
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1)
    } else {
      router.push("/profile")
    }
  }

  const finishLater = async () => {
    router.push("/")
  }

  return (
    <div
      style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}
    >
      {/* Top bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "16px 32px",
          borderBottom: `1px solid ${T.border.line}`,
        }}
      >
        <span
          style={{
            fontFamily: T.font.mono,
            fontSize: "11px",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: T.ink.faint,
          }}
        >
          libraries.global / profile setup
        </span>
        <button
          type="button"
          onClick={() => void finishLater()}
          style={{
            background: "none",
            border: "none",
            color: T.ink.faint,
            fontSize: "12px",
            cursor: "pointer",
            fontFamily: T.font.sans,
          }}
        >
          Finish later
        </button>
      </div>

      {/* Step progress */}
      <div
        style={{
          display: "flex",
          gap: "4px",
          padding: "0 32px",
          marginTop: "24px",
        }}
      >
        {STEPS.map((s, i) => (
          <div
            key={s}
            style={{
              flex: 1,
              height: "2px",
              borderRadius: "2px",
              background: i <= step ? T.accent.aurora : T.border.line,
              transition: "background 300ms",
            }}
          />
        ))}
      </div>

      {/* Step label */}
      <div style={{ padding: "16px 32px 0" }}>
        <span
          style={{
            fontFamily: T.font.mono,
            fontSize: "10px",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: T.accent.aurora,
          }}
        >
          Step {step + 1} of {STEPS.length} · {STEPS[step]}
        </span>
      </div>

      {/* Step content */}
      <div
        style={{
          flex: 1,
          padding: "32px",
          maxWidth: "640px",
          margin: "0 auto",
          width: "100%",
        }}
      >
        {step === 0 && (
          <OnboardingIdentity
            sessionUser={sessionUser}
            initialProfile={initialProfile}
            saving={saving}
            onNext={(data) => void advance(data)}
            onSkip={skip}
          />
        )}
        {step === 1 && (
          <OnboardingAffiliation
            sessionUser={sessionUser}
            initialProfile={initialProfile}
            saving={saving}
            onNext={(data) => void advance(data)}
            onSkip={skip}
          />
        )}
        {step === 2 && (
          <OnboardingInterests
            initialProfile={initialProfile}
            saving={saving}
            onNext={(data) => void advance(data)}
            onSkip={skip}
          />
        )}
        {step === 3 && (
          <OnboardingLinks
            initialProfile={initialProfile}
            saving={saving}
            onNext={(data) => void advance(data)}
            onSkip={skip}
          />
        )}
        {step === 4 && (
          <OnboardingVisibility
            initialProfile={initialProfile}
            saving={saving}
            onNext={(data) => void advance(data)}
            onSkip={skip}
          />
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/ui/src/app/[locale]/onboarding/_components/OnboardingShell.tsx
git commit -m "feat(ui): add OnboardingShell wizard with step progress"
```

---

## Task 4: OnboardingIdentity step

**Files:**

- Create: `apps/ui/src/app/[locale]/onboarding/_components/OnboardingIdentity.tsx`

- [ ] **Step 1: Create the component**

Create `apps/ui/src/app/[locale]/onboarding/_components/OnboardingIdentity.tsx`:

```tsx
"use client"

import { useEffect, useState } from "react"

import { AvatarUpload } from "@/components/settings/AvatarUpload"
import { CountryCombobox } from "@/components/settings/CountryCombobox"
import { T } from "@/lib/design-tokens"
import type { UserProfile } from "@/lib/types/profile"

type SessionUser = {
  id: string
  name: string
  email: string
  image: string | null
}

const inputStyle = {
  width: "100%",
  padding: "10px 14px",
  borderRadius: "8px",
  border: `1px solid ${T.border.hi}`,
  background: "rgba(255,255,255,0.04)",
  color: T.ink.base,
  fontSize: "13px",
  fontFamily: "Roboto, sans-serif",
  outline: "none",
  boxSizing: "border-box" as const,
}

const labelStyle = {
  fontFamily: "JetBrains Mono, monospace",
  fontSize: "9px",
  letterSpacing: ".16em",
  textTransform: "uppercase" as const,
  color: T.ink.faint,
  display: "block",
  marginBottom: "6px",
}

const PRONOUNS = [
  { value: "", label: "Not specified" },
  { value: "he_him", label: "He / Him" },
  { value: "she_her", label: "She / Her" },
  { value: "they_them", label: "They / Them" },
  { value: "other", label: "Other" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
]

export function OnboardingIdentity({
  sessionUser,
  initialProfile,
  saving,
  onNext,
  onSkip,
}: {
  sessionUser: SessionUser
  initialProfile: UserProfile | null
  saving: boolean
  onNext: (data: Partial<UserProfile>) => void
  onSkip: () => void
}) {
  const [form, setForm] = useState({
    firstName:
      initialProfile?.firstName ?? sessionUser.name?.split(" ")[0] ?? "",
    lastName:
      initialProfile?.lastName ??
      sessionUser.name?.split(" ").slice(1).join(" ") ??
      "",
    username: initialProfile?.username ?? "",
    pronouns: initialProfile?.pronouns ?? "",
    city: initialProfile?.city ?? "",
    country: initialProfile?.country ?? "",
    avatarUrl: initialProfile?.avatarUrl ?? "",
  })
  const [usernameStatus, setUsernameStatus] = useState<
    "idle" | "checking" | "available" | "taken"
  >("idle")

  useEffect(() => {
    const username = form.username.trim()
    if (!username || username === initialProfile?.username) {
      setUsernameStatus("idle")
      return
    }
    setUsernameStatus("checking")
    const t = setTimeout(async () => {
      const res = await fetch(
        `/api/profile/check-username?username=${encodeURIComponent(username)}`
      )
      const json = (await res.json()) as { available: boolean }
      setUsernameStatus(json.available ? "available" : "taken")
    }, 400)
    return () => clearTimeout(t)
  }, [form.username, initialProfile?.username])

  const initials =
    ((form.firstName[0] ?? "") + (form.lastName[0] ?? "")).toUpperCase() || "?"

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div>
        <h1
          style={{
            margin: "0 0 8px",
            fontSize: "28px",
            fontWeight: 700,
            fontFamily: "Fraunces, serif",
            color: T.ink.base,
          }}
        >
          Let&apos;s set up your identity
        </h1>
        <p style={{ margin: 0, fontSize: "14px", color: T.ink.faint }}>
          How you appear to other contributors. You can change this any time in
          settings.
        </p>
      </div>

      <AvatarUpload
        currentUrl={form.avatarUrl}
        initials={initials}
        onUpload={(url) => setForm((f) => ({ ...f, avatarUrl: url }))}
      />

      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}
      >
        <div>
          <label style={labelStyle}>First name</label>
          <input
            style={inputStyle}
            type="text"
            value={form.firstName}
            onChange={(e) =>
              setForm((f) => ({ ...f, firstName: e.target.value }))
            }
            className="focus:border-[rgba(127,223,255,.4)]"
          />
        </div>
        <div>
          <label style={labelStyle}>Last name</label>
          <input
            style={inputStyle}
            type="text"
            value={form.lastName}
            onChange={(e) =>
              setForm((f) => ({ ...f, lastName: e.target.value }))
            }
            className="focus:border-[rgba(127,223,255,.4)]"
          />
        </div>
      </div>

      <div>
        <label
          style={{
            ...labelStyle,
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <span>Username · @handle</span>
          {usernameStatus === "checking" && (
            <span style={{ color: T.ink.faint }}>Checking…</span>
          )}
          {usernameStatus === "available" && (
            <span style={{ color: T.accent.ok }}>Available</span>
          )}
          {usernameStatus === "taken" && (
            <span style={{ color: T.accent.danger }}>Taken</span>
          )}
        </label>
        <input
          style={{
            ...inputStyle,
            borderColor:
              usernameStatus === "taken" ? "rgba(255,138,138,0.4)" : undefined,
          }}
          type="text"
          value={form.username}
          onChange={(e) =>
            setForm((f) => ({
              ...f,
              username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""),
            }))
          }
          placeholder="yourhandle"
          className="focus:border-[rgba(127,223,255,.4)]"
        />
      </div>

      <div>
        <label style={labelStyle}>Pronouns</label>
        <select
          style={{ ...inputStyle, cursor: "pointer" }}
          value={form.pronouns}
          onChange={(e) => setForm((f) => ({ ...f, pronouns: e.target.value }))}
        >
          {PRONOUNS.map((p) => (
            <option
              key={p.value}
              value={p.value}
              style={{ background: "#070b1e" }}
            >
              {p.label}
            </option>
          ))}
        </select>
      </div>

      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}
      >
        <div>
          <label style={labelStyle}>City</label>
          <input
            style={inputStyle}
            type="text"
            value={form.city}
            onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
            className="focus:border-[rgba(127,223,255,.4)]"
          />
        </div>
        <div>
          <label style={labelStyle}>Country</label>
          <CountryCombobox
            value={form.country}
            onChange={(code) => setForm((f) => ({ ...f, country: code }))}
          />
        </div>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          paddingTop: "8px",
        }}
      >
        <button
          type="button"
          onClick={onSkip}
          style={{
            background: "none",
            border: "none",
            color: T.ink.faint,
            fontSize: "13px",
            cursor: "pointer",
            fontFamily: "Roboto, sans-serif",
          }}
        >
          Skip for now
        </button>
        <button
          type="button"
          disabled={saving || usernameStatus === "taken"}
          onClick={() =>
            onNext({
              firstName: form.firstName,
              lastName: form.lastName,
              username: form.username,
              pronouns: form.pronouns as UserProfile["pronouns"],
              city: form.city,
              country: form.country,
            })
          }
          style={{
            padding: "10px 24px",
            borderRadius: "8px",
            border: "none",
            background: T.ink.base,
            color: "#030511",
            fontSize: "13px",
            fontFamily: "Roboto, sans-serif",
            fontWeight: 600,
            cursor:
              saving || usernameStatus === "taken" ? "not-allowed" : "pointer",
            opacity: saving || usernameStatus === "taken" ? 0.7 : 1,
          }}
        >
          {saving ? "Saving…" : "Continue →"}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/ui/src/app/[locale]/onboarding/_components/OnboardingIdentity.tsx
git commit -m "feat(ui): add OnboardingIdentity step with avatar, username check, pronouns, location"
```

---

## Task 5: LibraryClaimSearch + OnboardingAffiliation

**Files:**

- Create: `apps/ui/src/app/[locale]/onboarding/_components/LibraryClaimSearch.tsx`
- Create: `apps/ui/src/app/[locale]/onboarding/_components/OnboardingAffiliation.tsx`

- [ ] **Step 1: Create MeiliSearch library search API route**

Create `apps/ui/src/app/api/libraries/search/route.ts`:

```typescript
import { NextResponse } from "next/server"

const MEILI_HOST =
  process.env.NEXT_PUBLIC_MEILISEARCH_HOST ?? "http://localhost:7700"
const MEILI_KEY = process.env.MEILISEARCH_SEARCH_API_KEY ?? ""

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get("q") ?? ""
  const country_slug = searchParams.get("country_slug") ?? ""

  const filter = country_slug ? `country_slug = "${country_slug}"` : undefined

  const body: Record<string, unknown> = { q, limit: 20 }
  if (filter) body.filter = filter

  const res = await fetch(`${MEILI_HOST}/indexes/library/search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(MEILI_KEY ? { Authorization: `Bearer ${MEILI_KEY}` } : {}),
    },
    body: JSON.stringify(body),
    next: { revalidate: 0 },
  })

  if (!res.ok) return NextResponse.json({ hits: [] })
  const json = (await res.json()) as { hits: unknown[] }
  return NextResponse.json({ hits: json.hits })
}
```

- [ ] **Step 2: Create LibraryClaimSearch component**

Create `apps/ui/src/app/[locale]/onboarding/_components/LibraryClaimSearch.tsx`:

```tsx
"use client"

import { useState } from "react"
import { toast } from "sonner"

import { COUNTRIES } from "@/lib/data/countries"
import { T } from "@/lib/design-tokens"

type LibraryHit = {
  id: number
  name: string
  city?: string
  country_name?: string
  country_slug?: string
  entityRef?: string
  website?: string
  libraryType?: string
}

type ClaimResult = { status: "verified" | "pending"; method: string }

export function LibraryClaimSearch({
  onClaimed,
}: {
  onClaimed: (
    result: ClaimResult & { libraryName: string; entityRef: string }
  ) => void
}) {
  const [countrySlug, setCountrySlug] = useState("")
  const [query, setQuery] = useState("")
  const [hits, setHits] = useState<LibraryHit[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<LibraryHit | null>(null)
  const [role, setRole] = useState("")
  const [department, setDepartment] = useState("")
  const [claiming, setClaiming] = useState(false)
  const [claimResult, setClaimResult] = useState<ClaimResult | null>(null)

  const inputStyle = {
    width: "100%",
    padding: "10px 14px",
    borderRadius: "8px",
    border: `1px solid ${T.border.hi}`,
    background: "rgba(255,255,255,0.04)",
    color: T.ink.base,
    fontSize: "13px",
    fontFamily: "Roboto, sans-serif",
    outline: "none",
    boxSizing: "border-box" as const,
  }

  const search = async (q: string) => {
    setQuery(q)
    if (!q.trim() && !countrySlug) {
      setHits([])
      return
    }
    setSearching(true)
    try {
      const params = new URLSearchParams({ q })
      if (countrySlug) params.set("country_slug", countrySlug)
      const res = await fetch(`/api/libraries/search?${params}`)
      const json = (await res.json()) as { hits: LibraryHit[] }
      setHits(json.hits)
    } catch {
      setHits([])
    } finally {
      setSearching(false)
    }
  }

  const handleClaim = async () => {
    if (!selected) return
    setClaiming(true)
    try {
      const res = await fetch("/api/profile/me/claim-library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          libraryEntityRef: selected.entityRef ?? String(selected.id),
          libraryName: selected.name,
          libraryWebsite: selected.website ?? "",
          role,
          department,
        }),
      })
      const json = (await res.json()) as ClaimResult & { error?: string }
      if (!res.ok) {
        toast.error(json.error ?? "Claim failed")
        return
      }
      setClaimResult(json)
      onClaimed({
        ...json,
        libraryName: selected.name,
        entityRef: selected.entityRef ?? String(selected.id),
      })
    } catch {
      toast.error("Claim failed")
    } finally {
      setClaiming(false)
    }
  }

  if (claimResult) {
    return (
      <div
        style={{
          padding: "16px 20px",
          borderRadius: "8px",
          border: `1px solid ${claimResult.status === "verified" ? "rgba(142,240,179,0.3)" : "rgba(255,207,122,0.3)"}`,
          background:
            claimResult.status === "verified"
              ? "rgba(142,240,179,0.05)"
              : "rgba(255,207,122,0.05)",
        }}
      >
        {claimResult.status === "verified" ? (
          <p style={{ margin: 0, fontSize: "13px", color: T.accent.ok }}>
            Verified — your email domain matched the library&apos;s website. You
            are now a verified librarian.
          </p>
        ) : claimResult.method === "vouching" ? (
          <p style={{ margin: 0, fontSize: "13px", color: T.accent.warn }}>
            Your claim is pending verification by a verified librarian at this
            institution.
          </p>
        ) : (
          <p style={{ margin: 0, fontSize: "13px", color: T.accent.warn }}>
            Your claim has been submitted. Our team will verify and get back to
            you via email.
          </p>
        )}
      </div>
    )
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {/* Country filter */}
      <div>
        <label
          style={{
            fontFamily: "JetBrains Mono, monospace",
            fontSize: "9px",
            letterSpacing: ".16em",
            textTransform: "uppercase" as const,
            color: T.ink.faint,
            display: "block",
            marginBottom: "6px",
          }}
        >
          Filter by country
        </label>
        <select
          style={{ ...inputStyle, cursor: "pointer" }}
          value={countrySlug}
          onChange={(e) => {
            setCountrySlug(e.target.value)
            void search(query)
          }}
        >
          <option value="" style={{ background: "#070b1e" }}>
            All countries
          </option>
          {COUNTRIES.map((c) => (
            <option
              key={c.code}
              value={c.code.toLowerCase()}
              style={{ background: "#070b1e" }}
            >
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Library search */}
      <div>
        <label
          style={{
            fontFamily: "JetBrains Mono, monospace",
            fontSize: "9px",
            letterSpacing: ".16em",
            textTransform: "uppercase" as const,
            color: T.ink.faint,
            display: "block",
            marginBottom: "6px",
          }}
        >
          Search for your library
        </label>
        <input
          style={inputStyle}
          type="text"
          value={query}
          onChange={(e) => void search(e.target.value)}
          placeholder="British Library, Bibliothèque nationale…"
          className="focus:border-[rgba(127,223,255,.4)]"
        />
      </div>

      {/* Results */}
      {searching && (
        <p
          style={{
            fontSize: "12px",
            color: T.ink.faint,
            fontFamily: "JetBrains Mono, monospace",
          }}
        >
          Searching…
        </p>
      )}

      {!searching && hits.length > 0 && !selected && (
        <div
          style={{
            border: `1px solid ${T.border.line}`,
            borderRadius: "8px",
            overflow: "hidden",
          }}
        >
          {hits.map((hit, i) => (
            <button
              key={hit.id}
              type="button"
              onClick={() => setSelected(hit)}
              style={{
                display: "block",
                width: "100%",
                padding: "12px 16px",
                background: "transparent",
                border: "none",
                borderBottom:
                  i < hits.length - 1 ? `1px solid ${T.border.line}` : "none",
                color: T.ink.dim,
                fontSize: "13px",
                fontFamily: "Roboto, sans-serif",
                cursor: "pointer",
                textAlign: "left",
              }}
              className="hover:bg-white/[0.04]"
            >
              <strong style={{ color: T.ink.base }}>{hit.name}</strong>
              {(hit.city || hit.country_name) && (
                <span
                  style={{
                    fontSize: "11px",
                    color: T.ink.faint,
                    marginLeft: "8px",
                    fontFamily: "JetBrains Mono, monospace",
                  }}
                >
                  {[hit.city, hit.country_name].filter(Boolean).join(", ")}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Selected library — show role/department fields */}
      {selected && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div
            style={{
              padding: "12px 16px",
              borderRadius: "8px",
              background: "rgba(127,223,255,0.06)",
              border: "1px solid rgba(127,223,255,0.2)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <p
                style={{
                  margin: 0,
                  fontSize: "13px",
                  fontWeight: 600,
                  color: T.ink.base,
                }}
              >
                {selected.name}
              </p>
              {(selected.city || selected.country_name) && (
                <p
                  style={{
                    margin: "2px 0 0",
                    fontSize: "11px",
                    color: T.ink.faint,
                    fontFamily: "JetBrains Mono, monospace",
                  }}
                >
                  {[selected.city, selected.country_name]
                    .filter(Boolean)
                    .join(", ")}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setSelected(null)}
              style={{
                background: "none",
                border: "none",
                color: T.ink.faint,
                cursor: "pointer",
                fontSize: "12px",
              }}
            >
              Change
            </button>
          </div>

          <div>
            <label
              style={{
                fontFamily: "JetBrains Mono, monospace",
                fontSize: "9px",
                letterSpacing: ".16em",
                textTransform: "uppercase" as const,
                color: T.ink.faint,
                display: "block",
                marginBottom: "6px",
              }}
            >
              Your role
            </label>
            <input
              style={inputStyle}
              type="text"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="e.g. Reference Librarian"
              className="focus:border-[rgba(127,223,255,.4)]"
            />
          </div>

          <div>
            <label
              style={{
                fontFamily: "JetBrains Mono, monospace",
                fontSize: "9px",
                letterSpacing: ".16em",
                textTransform: "uppercase" as const,
                color: T.ink.faint,
                display: "block",
                marginBottom: "6px",
              }}
            >
              Department (optional)
            </label>
            <input
              style={inputStyle}
              type="text"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="e.g. Rare Books"
              className="focus:border-[rgba(127,223,255,.4)]"
            />
          </div>

          <button
            type="button"
            disabled={claiming}
            onClick={() => void handleClaim()}
            style={{
              padding: "10px 20px",
              borderRadius: "8px",
              border: "1px solid rgba(127,223,255,0.35)",
              background: "rgba(127,223,255,0.1)",
              color: T.accent.aurora,
              fontSize: "13px",
              fontFamily: "Roboto, sans-serif",
              fontWeight: 600,
              cursor: claiming ? "not-allowed" : "pointer",
              opacity: claiming ? 0.7 : 1,
            }}
          >
            {claiming ? "Submitting…" : "Claim affiliation"}
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Create OnboardingAffiliation**

Create `apps/ui/src/app/[locale]/onboarding/_components/OnboardingAffiliation.tsx`:

```tsx
"use client"

import { useState } from "react"

import { T } from "@/lib/design-tokens"
import type { UserProfile } from "@/lib/types/profile"
import { LibraryClaimSearch } from "./LibraryClaimSearch"

const AFFILIATION_TYPES = [
  {
    value: "librarian",
    label: "Librarian / Archivist",
    desc: "I work in a library or archive.",
    showClaim: true,
  },
  {
    value: "researcher",
    label: "Researcher",
    desc: "I conduct research using library resources.",
    showClaim: true,
  },
  {
    value: "educator",
    label: "Educator",
    desc: "I teach or train in an educational institution.",
    showClaim: false,
  },
  {
    value: "reader",
    label: "Reader / Visitor",
    desc: "I use libraries for personal learning.",
    showClaim: false,
  },
  {
    value: "other",
    label: "Other",
    desc: "Something else entirely.",
    showClaim: false,
  },
]

export function OnboardingAffiliation({
  sessionUser,
  initialProfile,
  saving,
  onNext,
  onSkip,
}: {
  sessionUser: { email: string }
  initialProfile: UserProfile | null
  saving: boolean
  onNext: (data: Partial<UserProfile>) => void
  onSkip: () => void
}) {
  const [affiliationType, setAffiliationType] = useState<string>(
    initialProfile?.affiliationType ?? ""
  )
  const [claimResult, setClaimResult] = useState<{
    libraryName: string
    entityRef: string
    status: string
  } | null>(null)

  const selected = AFFILIATION_TYPES.find((a) => a.value === affiliationType)
  const showClaim = selected?.showClaim && !claimResult

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div>
        <h1
          style={{
            margin: "0 0 8px",
            fontSize: "28px",
            fontWeight: 700,
            fontFamily: "Fraunces, serif",
            color: T.ink.base,
          }}
        >
          Your affiliation
        </h1>
        <p style={{ margin: 0, fontSize: "14px", color: T.ink.faint }}>
          How do you primarily engage with libraries?
        </p>
      </div>

      {/* Affiliation type cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {AFFILIATION_TYPES.map((type) => {
          const active = affiliationType === type.value
          return (
            <button
              key={type.value}
              type="button"
              onClick={() => setAffiliationType(type.value)}
              style={{
                padding: "14px 18px",
                borderRadius: "8px",
                border: `1px solid ${active ? "rgba(127,223,255,0.4)" : T.border.line}`,
                background: active
                  ? "rgba(127,223,255,0.06)"
                  : "rgba(255,255,255,0.02)",
                cursor: "pointer",
                textAlign: "left",
                transition: "border-color 150ms, background 150ms",
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: "13px",
                  fontWeight: 600,
                  color: active ? T.ink.base : T.ink.dim,
                }}
              >
                {type.label}
              </p>
              <p
                style={{
                  margin: "2px 0 0",
                  fontSize: "12px",
                  color: T.ink.faint,
                }}
              >
                {type.desc}
              </p>
            </button>
          )
        })}
      </div>

      {/* Library claim section */}
      {showClaim && affiliationType && (
        <div
          style={{
            borderTop: `1px solid ${T.border.line}`,
            paddingTop: "20px",
          }}
        >
          <p
            style={{
              margin: "0 0 16px",
              fontSize: "13px",
              fontWeight: 600,
              color: T.ink.base,
            }}
          >
            Claim your library affiliation
          </p>
          <p
            style={{ margin: "0 0 16px", fontSize: "12px", color: T.ink.faint }}
          >
            Find your institution below. If your email domain matches the
            library&apos;s website, you&apos;ll be verified instantly. Otherwise
            your claim will be reviewed.
          </p>
          <LibraryClaimSearch onClaimed={(result) => setClaimResult(result)} />
        </div>
      )}

      {/* Already claimed */}
      {claimResult && (
        <div
          style={{
            padding: "14px 18px",
            borderRadius: "8px",
            border: `1px solid ${claimResult.status === "verified" ? "rgba(142,240,179,0.3)" : "rgba(255,207,122,0.3)"}`,
            background:
              claimResult.status === "verified"
                ? "rgba(142,240,179,0.05)"
                : "rgba(255,207,122,0.05)",
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: "13px",
              color:
                claimResult.status === "verified" ? T.accent.ok : T.accent.warn,
            }}
          >
            {claimResult.status === "verified"
              ? `Verified at ${claimResult.libraryName}`
              : `Claim pending for ${claimResult.libraryName}`}
          </p>
        </div>
      )}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          paddingTop: "8px",
        }}
      >
        <button
          type="button"
          onClick={onSkip}
          style={{
            background: "none",
            border: "none",
            color: T.ink.faint,
            fontSize: "13px",
            cursor: "pointer",
            fontFamily: "Roboto, sans-serif",
          }}
        >
          Skip for now
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() =>
            onNext({
              affiliationType:
                affiliationType as UserProfile["affiliationType"],
            })
          }
          style={{
            padding: "10px 24px",
            borderRadius: "8px",
            border: "none",
            background: T.ink.base,
            color: "#030511",
            fontSize: "13px",
            fontFamily: "Roboto, sans-serif",
            fontWeight: 600,
            cursor: saving ? "not-allowed" : "pointer",
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? "Saving…" : "Continue →"}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/ui/src/app/[locale]/onboarding/_components/LibraryClaimSearch.tsx \
        apps/ui/src/app/[locale]/onboarding/_components/OnboardingAffiliation.tsx \
        apps/ui/src/app/api/libraries/search/
git commit -m "feat(ui): add OnboardingAffiliation with library claim search and email domain verification"
```

---

## Task 6: Remaining onboarding steps

**Files:**

- Create: `apps/ui/src/app/[locale]/onboarding/_components/OnboardingInterests.tsx`
- Create: `apps/ui/src/app/[locale]/onboarding/_components/OnboardingLinks.tsx`
- Create: `apps/ui/src/app/[locale]/onboarding/_components/OnboardingVisibility.tsx`

- [ ] **Step 1: Create OnboardingInterests**

Create `apps/ui/src/app/[locale]/onboarding/_components/OnboardingInterests.tsx`:

```tsx
"use client"

import { useState } from "react"

import { InterestsChips } from "@/components/settings/InterestsChips"
import { T } from "@/lib/design-tokens"
import type { UserProfile } from "@/lib/types/profile"

const LANGUAGE_OPTIONS = [
  { code: "en", name: "English" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "es", name: "Spanish" },
  { code: "it", name: "Italian" },
  { code: "pt", name: "Portuguese" },
  { code: "ar", name: "Arabic" },
  { code: "zh", name: "Chinese" },
  { code: "ja", name: "Japanese" },
  { code: "ko", name: "Korean" },
  { code: "ru", name: "Russian" },
  { code: "nl", name: "Dutch" },
  { code: "pl", name: "Polish" },
  { code: "sv", name: "Swedish" },
  { code: "la", name: "Latin" },
  { code: "el", name: "Greek" },
]

const PROFICIENCY = ["native", "fluent", "conversational"] as const

type LanguageEntry = {
  code: string
  proficiency: "native" | "fluent" | "conversational"
}

export function OnboardingInterests({
  initialProfile,
  saving,
  onNext,
  onSkip,
}: {
  initialProfile: UserProfile | null
  saving: boolean
  onNext: (data: Partial<UserProfile>) => void
  onSkip: () => void
}) {
  const [interests, setInterests] = useState<string[]>(
    initialProfile?.interests ?? []
  )
  const [languages, setLanguages] = useState<LanguageEntry[]>(
    (initialProfile?.languages as LanguageEntry[] | undefined) ?? []
  )
  const [addingLang, setAddingLang] = useState("")
  const [addingProf, setAddingProf] = useState<
    "native" | "fluent" | "conversational"
  >("fluent")

  const inputStyle = {
    padding: "8px 12px",
    borderRadius: "6px",
    border: `1px solid ${T.border.hi}`,
    background: "rgba(255,255,255,0.04)",
    color: T.ink.base,
    fontSize: "13px",
    fontFamily: "Roboto, sans-serif",
    outline: "none",
  }

  const addLanguage = () => {
    if (!addingLang || languages.find((l) => l.code === addingLang)) return
    setLanguages((prev) => [
      ...prev,
      { code: addingLang, proficiency: addingProf },
    ])
    setAddingLang("")
  }

  const removeLanguage = (code: string) => {
    setLanguages((prev) => prev.filter((l) => l.code !== code))
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div>
        <h1
          style={{
            margin: "0 0 8px",
            fontSize: "28px",
            fontWeight: 700,
            fontFamily: "Fraunces, serif",
            color: T.ink.base,
          }}
        >
          Interests &amp; languages
        </h1>
        <p style={{ margin: 0, fontSize: "14px", color: T.ink.faint }}>
          Help us connect you with relevant libraries, collections, and
          contributors.
        </p>
      </div>

      <div>
        <p
          style={{
            margin: "0 0 10px",
            fontSize: "13px",
            fontWeight: 600,
            color: T.ink.dim,
          }}
        >
          Interests
        </p>
        <InterestsChips selected={interests} onChange={setInterests} />
      </div>

      <div>
        <p
          style={{
            margin: "0 0 10px",
            fontSize: "13px",
            fontWeight: 600,
            color: T.ink.dim,
          }}
        >
          Languages
        </p>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "8px",
            marginBottom: "12px",
          }}
        >
          {languages.map((lang) => {
            const name =
              LANGUAGE_OPTIONS.find((l) => l.code === lang.code)?.name ??
              lang.code
            return (
              <span
                key={lang.code}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "4px 10px",
                  borderRadius: "999px",
                  border: "1px solid rgba(127,223,255,0.3)",
                  background: "rgba(127,223,255,0.06)",
                  color: T.accent.aurora,
                  fontSize: "12px",
                  fontFamily: "JetBrains Mono, monospace",
                }}
              >
                {name} · {lang.proficiency}
                <button
                  type="button"
                  onClick={() => removeLanguage(lang.code)}
                  style={{
                    background: "none",
                    border: "none",
                    color: T.ink.faint,
                    cursor: "pointer",
                    padding: 0,
                    lineHeight: 1,
                    fontSize: "14px",
                  }}
                >
                  ×
                </button>
              </span>
            )
          })}
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <select
            style={inputStyle}
            value={addingLang}
            onChange={(e) => setAddingLang(e.target.value)}
          >
            <option value="" style={{ background: "#070b1e" }}>
              Add language…
            </option>
            {LANGUAGE_OPTIONS.filter(
              (l) => !languages.find((ll) => ll.code === l.code)
            ).map((l) => (
              <option
                key={l.code}
                value={l.code}
                style={{ background: "#070b1e" }}
              >
                {l.name}
              </option>
            ))}
          </select>
          <select
            style={inputStyle}
            value={addingProf}
            onChange={(e) => setAddingProf(e.target.value as typeof addingProf)}
          >
            {PROFICIENCY.map((p) => (
              <option key={p} value={p} style={{ background: "#070b1e" }}>
                {p}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={addLanguage}
            disabled={!addingLang}
            style={{
              padding: "8px 14px",
              borderRadius: "6px",
              border: `1px solid ${T.border.hi}`,
              background: "rgba(255,255,255,0.05)",
              color: T.ink.dim,
              fontSize: "12px",
              cursor: addingLang ? "pointer" : "not-allowed",
              opacity: addingLang ? 1 : 0.5,
            }}
          >
            Add
          </button>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          paddingTop: "8px",
        }}
      >
        <button
          type="button"
          onClick={onSkip}
          style={{
            background: "none",
            border: "none",
            color: T.ink.faint,
            fontSize: "13px",
            cursor: "pointer",
            fontFamily: "Roboto, sans-serif",
          }}
        >
          Skip for now
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => onNext({ interests, languages })}
          style={{
            padding: "10px 24px",
            borderRadius: "8px",
            border: "none",
            background: T.ink.base,
            color: "#030511",
            fontSize: "13px",
            fontFamily: "Roboto, sans-serif",
            fontWeight: 600,
            cursor: saving ? "not-allowed" : "pointer",
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? "Saving…" : "Continue →"}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create OnboardingLinks**

Create `apps/ui/src/app/[locale]/onboarding/_components/OnboardingLinks.tsx`:

```tsx
"use client"

import { useState } from "react"

import { T } from "@/lib/design-tokens"
import type { UserProfile } from "@/lib/types/profile"

export function OnboardingLinks({
  initialProfile,
  saving,
  onNext,
  onSkip,
}: {
  initialProfile: UserProfile | null
  saving: boolean
  onNext: (data: Partial<UserProfile>) => void
  onSkip: () => void
}) {
  const [form, setForm] = useState({
    website: initialProfile?.website ?? "",
    orcid: initialProfile?.orcid ?? "",
    mastodon: initialProfile?.mastodon ?? "",
    linkedin: initialProfile?.linkedin ?? "",
  })

  const inputStyle = {
    width: "100%",
    padding: "10px 14px",
    borderRadius: "8px",
    border: `1px solid ${T.border.hi}`,
    background: "rgba(255,255,255,0.04)",
    color: T.ink.base,
    fontSize: "13px",
    fontFamily: "Roboto, sans-serif",
    outline: "none",
    boxSizing: "border-box" as const,
  }

  const labelStyle = {
    fontFamily: "JetBrains Mono, monospace",
    fontSize: "9px",
    letterSpacing: ".16em",
    textTransform: "uppercase" as const,
    color: T.ink.faint,
    display: "block",
    marginBottom: "6px",
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div>
        <h1
          style={{
            margin: "0 0 8px",
            fontSize: "28px",
            fontWeight: 700,
            fontFamily: "Fraunces, serif",
            color: T.ink.base,
          }}
        >
          External links
        </h1>
        <p style={{ margin: 0, fontSize: "14px", color: T.ink.faint }}>
          All optional — share what you&apos;re comfortable with.
        </p>
      </div>

      <div>
        <label style={labelStyle}>Website</label>
        <input
          style={inputStyle}
          type="url"
          value={form.website}
          onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
          placeholder="https://yoursite.net"
          className="focus:border-[rgba(127,223,255,.4)]"
        />
      </div>

      <div>
        <label style={labelStyle}>ORCID iD</label>
        <input
          style={inputStyle}
          type="text"
          value={form.orcid}
          onChange={(e) => setForm((f) => ({ ...f, orcid: e.target.value }))}
          placeholder="https://orcid.org/0000-0000-0000-0000"
          className="focus:border-[rgba(127,223,255,.4)]"
        />
      </div>

      <div>
        <label style={labelStyle}>Mastodon / Bluesky</label>
        <input
          style={inputStyle}
          type="text"
          value={form.mastodon}
          onChange={(e) => setForm((f) => ({ ...f, mastodon: e.target.value }))}
          placeholder="@you@mastodon.social or @you.bsky.social"
          className="focus:border-[rgba(127,223,255,.4)]"
        />
      </div>

      <div>
        <label style={labelStyle}>LinkedIn</label>
        <input
          style={inputStyle}
          type="url"
          value={form.linkedin}
          onChange={(e) => setForm((f) => ({ ...f, linkedin: e.target.value }))}
          placeholder="https://linkedin.com/in/yourhandle"
          className="focus:border-[rgba(127,223,255,.4)]"
        />
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          paddingTop: "8px",
        }}
      >
        <button
          type="button"
          onClick={onSkip}
          style={{
            background: "none",
            border: "none",
            color: T.ink.faint,
            fontSize: "13px",
            cursor: "pointer",
            fontFamily: "Roboto, sans-serif",
          }}
        >
          Skip for now
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => onNext(form)}
          style={{
            padding: "10px 24px",
            borderRadius: "8px",
            border: "none",
            background: T.ink.base,
            color: "#030511",
            fontSize: "13px",
            fontFamily: "Roboto, sans-serif",
            fontWeight: 600,
            cursor: saving ? "not-allowed" : "pointer",
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? "Saving…" : "Continue →"}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create OnboardingVisibility**

Create `apps/ui/src/app/[locale]/onboarding/_components/OnboardingVisibility.tsx`:

```tsx
"use client"

import { useState } from "react"

import { VisibilityCards } from "@/components/settings/VisibilityCards"
import { T } from "@/lib/design-tokens"
import type { UserProfile } from "@/lib/types/profile"

export function OnboardingVisibility({
  initialProfile,
  saving,
  onNext,
  onSkip,
}: {
  initialProfile: UserProfile | null
  saving: boolean
  onNext: (data: Partial<UserProfile>) => void
  onSkip: () => void
}) {
  const [visibility, setVisibility] = useState<
    "public" | "limited" | "private"
  >(initialProfile?.profileVisibility ?? "public")

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div>
        <h1
          style={{
            margin: "0 0 8px",
            fontSize: "28px",
            fontWeight: 700,
            fontFamily: "Fraunces, serif",
            color: T.ink.base,
          }}
        >
          Profile visibility
        </h1>
        <p style={{ margin: 0, fontSize: "14px", color: T.ink.faint }}>
          Control who can see your profile. You can change this any time in
          settings.
        </p>
      </div>

      <VisibilityCards value={visibility} onChange={setVisibility} />

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          paddingTop: "8px",
        }}
      >
        <button
          type="button"
          onClick={onSkip}
          style={{
            background: "none",
            border: "none",
            color: T.ink.faint,
            fontSize: "13px",
            cursor: "pointer",
            fontFamily: "Roboto, sans-serif",
          }}
        >
          Skip for now
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => onNext({ profileVisibility: visibility })}
          style={{
            padding: "10px 24px",
            borderRadius: "8px",
            border: "1px solid rgba(127,223,255,0.35)",
            background: "rgba(127,223,255,0.1)",
            color: T.accent.aurora,
            fontSize: "13px",
            fontFamily: "Roboto, sans-serif",
            fontWeight: 600,
            cursor: saving ? "not-allowed" : "pointer",
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? "Saving…" : "Enter your profile →"}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: TypeScript compile check**

```bash
cd apps/ui && npx tsc --noEmit 2>&1 | grep -E "onboarding|Onboarding" | head -20
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add apps/ui/src/app/[locale]/onboarding/_components/OnboardingInterests.tsx \
        apps/ui/src/app/[locale]/onboarding/_components/OnboardingLinks.tsx \
        apps/ui/src/app/[locale]/onboarding/_components/OnboardingVisibility.tsx
git commit -m "feat(ui): add OnboardingInterests, OnboardingLinks, OnboardingVisibility steps"
```

---

## Verification

After all tasks complete, navigate to `http://localhost:3000/onboarding` while signed in:

1. Step 1 (Identity): Avatar upload works; username availability shows; country dropdown filters; Continue saves via PUT /api/profile/me
2. Step 2 (Affiliation): Selecting Librarian shows claim section; library search calls /api/libraries/search; claim submission creates moderation entry
3. Step 3 (Interests): Topic chips load; selecting toggles; suggestion input submits to moderation
4. Step 4 (Links): All fields save
5. Step 5 (Visibility): 3 cards select and save; "Enter your profile" redirects to /profile/[username]

Unauthenticated visit: redirects to `/auth/signin?callbackUrl=/onboarding`.
