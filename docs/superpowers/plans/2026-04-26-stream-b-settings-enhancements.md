# Stream B: Settings Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Prerequisite:** Stream A must be deployed first (user-profile schema and topics plugin must exist).

**Goal:** Upgrade the settings Public Profile section with searchable country/timezone dropdowns, working avatar upload, pronouns, social links, profile visibility cards, interests chips, and an incomplete-profile CTA banner.

**Architecture:** New shared UI components (`CountryCombobox`, `TimezoneCombobox`, `AvatarUpload`, `VisibilityCards`, `InterestsChips`) are built using the existing Popover from `@radix-ui/react-popover` and inline styles matching the `T` design token system. Three new Next.js API routes handle avatar upload (proxy to Strapi), username availability check, and topics listing. `PublicProfileSection` is rewritten to compose all new components. The `UserProfile` TypeScript type and `useProfile` hook are updated to include all new fields.

**Tech Stack:** Next.js 15 App Router, React, TypeScript, Radix UI Popover, `T` design tokens, Strapi upload API, Better Auth session

---

## File Map

**Create:**

- `apps/ui/src/app/api/profile/me/avatar/route.ts`
- `apps/ui/src/app/api/profile/check-username/route.ts`
- `apps/ui/src/app/api/topics/route.ts`
- `apps/ui/src/lib/data/countries.ts`
- `apps/ui/src/components/settings/CountryCombobox.tsx`
- `apps/ui/src/components/settings/TimezoneCombobox.tsx`
- `apps/ui/src/components/settings/AvatarUpload.tsx`
- `apps/ui/src/components/settings/VisibilityCards.tsx`
- `apps/ui/src/components/settings/InterestsChips.tsx`

**Modify:**

- `apps/ui/src/lib/types/profile.ts`
- `apps/ui/src/hooks/useProfile.ts`
- `apps/ui/src/app/api/profile/me/route.ts`
- `apps/ui/src/app/[locale]/settings/_components/PublicProfileSection.tsx`

---

## Task 1: Extend TypeScript types

**Files:**

- Modify: `apps/ui/src/lib/types/profile.ts`

- [ ] **Step 1: Replace profile.ts with extended types**

```typescript
export type UserProfile = {
  id: number
  username: string
  firstName: string
  lastName: string
  bio?: string | null
  pronouns?:
    | "he_him"
    | "she_her"
    | "they_them"
    | "other"
    | "prefer_not_to_say"
    | null
  affiliation?: string | null
  affiliationType?:
    | "reader"
    | "librarian"
    | "researcher"
    | "archivist"
    | "educator"
    | "other"
    | null
  role?: string | null
  claimedLibraryEntityRef?: string | null
  claimedLibraryName?: string | null
  claimedLibraryRole?: string | null
  claimedLibraryDepartment?: string | null
  affiliationVerificationStatus?:
    | "unclaimed"
    | "pending"
    | "verified"
    | "rejected"
    | null
  affiliationVerificationMethod?:
    | "email_domain"
    | "vouching"
    | "contact_us"
    | null
  city?: string | null
  country?: string | null
  timezone?: string | null
  website?: string | null
  orcid?: string | null
  mastodon?: string | null
  linkedin?: string | null
  avatarUrl?: string | null
  avatarStrapiId?: string | null
  profileVisibility: "public" | "limited" | "private"
  isVerifiedLibrarian: boolean
  contributorNumber?: number | null
  languages?: LanguageEntry[]
  interests?: string[]
  notifPrefs: NotifPrefs
  createdAt: string
  updatedAt: string
}

export type LanguageEntry = {
  code: string
  proficiency: "native" | "fluent" | "conversational"
}

export type NotifPrefs = {
  weeklyDigest: boolean
  editsReviewed: boolean
  newFollowers: boolean
  editorialMessages: boolean
  soundOn: boolean
  marketing: boolean
}

export type PublicProfile = Omit<UserProfile, "notifPrefs">

export type Topic = {
  documentId: string
  name: string
  slug: string
  status: "approved" | "pending" | "rejected"
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd apps/ui && npx tsc --noEmit 2>&1 | grep -E "types/profile"
```

Expected: No errors in profile.ts.

- [ ] **Step 3: Commit**

```bash
git add apps/ui/src/lib/types/profile.ts
git commit -m "feat(ui): extend UserProfile type with new fields"
```

---

## Task 2: New API routes

**Files:**

- Create: `apps/ui/src/app/api/profile/me/avatar/route.ts`
- Create: `apps/ui/src/app/api/profile/check-username/route.ts`
- Create: `apps/ui/src/app/api/topics/route.ts`
- Modify: `apps/ui/src/app/api/profile/me/route.ts`

- [ ] **Step 1: Create avatar upload route**

Create `apps/ui/src/app/api/profile/me/avatar/route.ts`:

```typescript
import { headers } from "next/headers"
import { NextResponse } from "next/server"

import { auth } from "@/lib/auth"

const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
const SECRET = process.env.STRAPI_BRIDGE_SECRET

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (!SECRET)
    return NextResponse.json(
      { error: "Bridge not configured" },
      { status: 500 }
    )

  const formData = await req.formData()
  const file = formData.get("file") as File | null
  if (!file)
    return NextResponse.json({ error: "No file provided" }, { status: 400 })

  if (file.size > 5 * 1024 * 1024)
    return NextResponse.json(
      { error: "File too large (max 5 MB)" },
      { status: 400 }
    )

  const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"]
  if (!allowed.includes(file.type))
    return NextResponse.json({ error: "Invalid file type" }, { status: 400 })

  // Forward to Strapi upload
  const strapiForm = new FormData()
  strapiForm.append("files", file, file.name)

  const uploadRes = await fetch(`${STRAPI}/api/upload`, {
    method: "POST",
    body: strapiForm,
  })
  if (!uploadRes.ok)
    return NextResponse.json({ error: "Upload failed" }, { status: 500 })

  const uploaded = (await uploadRes.json()) as Array<{
    id: number
    url: string
  }>
  const { id, url } = uploaded[0]

  // Update profile with new avatar
  const profileRes = await fetch(`${STRAPI}/api/auth-bridge/upsert-profile`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Service-Secret": SECRET },
    body: JSON.stringify({
      baUserId: session.user.id,
      avatarUrl: url.startsWith("http") ? url : `${STRAPI}${url}`,
      avatarStrapiId: String(id),
    }),
  })
  if (!profileRes.ok)
    return NextResponse.json(
      { error: "Profile update failed" },
      { status: 500 }
    )

  return NextResponse.json({
    url: url.startsWith("http") ? url : `${STRAPI}${url}`,
  })
}
```

- [ ] **Step 2: Create username check route**

Create `apps/ui/src/app/api/profile/check-username/route.ts`:

```typescript
import { NextResponse } from "next/server"

const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const username = searchParams.get("username")?.trim().toLowerCase()
  if (!username || username.length < 3)
    return NextResponse.json({ available: false, reason: "too_short" })
  if (!/^[a-z0-9_]+$/.test(username))
    return NextResponse.json({ available: false, reason: "invalid_chars" })

  const res = await fetch(
    `${STRAPI}/api/user-profiles?filters[username][$eq]=${encodeURIComponent(username)}&fields[0]=id`,
    { next: { revalidate: 0 } }
  )
  if (!res.ok) return NextResponse.json({ available: false, reason: "error" })
  const json = (await res.json()) as { data: unknown[] }
  return NextResponse.json({ available: json.data.length === 0 })
}
```

- [ ] **Step 3: Create topics listing route**

Create `apps/ui/src/app/api/topics/route.ts`:

```typescript
import { NextResponse } from "next/server"

const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"

export async function GET() {
  const res = await fetch(`${STRAPI}/api/topics/approved`, {
    next: { revalidate: 3600 },
  })
  if (!res.ok) return NextResponse.json({ data: [] })
  const json = await res.json()
  return NextResponse.json(json)
}
```

- [ ] **Step 4: Expand allowed fields in /api/profile/me PUT route**

In `apps/ui/src/app/api/profile/me/route.ts`, replace the `allowed` array (lines 41–54) with:

```typescript
const allowed = [
  "username",
  "firstName",
  "lastName",
  "bio",
  "pronouns",
  "affiliation",
  "affiliationType",
  "role",
  "claimedLibraryEntityRef",
  "claimedLibraryName",
  "claimedLibraryRole",
  "claimedLibraryDepartment",
  "affiliationVerificationStatus",
  "affiliationVerificationMethod",
  "city",
  "country",
  "timezone",
  "website",
  "orcid",
  "mastodon",
  "linkedin",
  "avatarUrl",
  "avatarStrapiId",
  "profileVisibility",
  "languages",
  "interests",
]
```

- [ ] **Step 5: Test the new routes**

```bash
# Topics
curl -s http://localhost:3000/api/topics | jq '.data | length'
# Expected: 25

# Username check (available)
curl -s "http://localhost:3000/api/profile/check-username?username=newhandle" | jq .
# Expected: { available: true }

# Username check (invalid chars)
curl -s "http://localhost:3000/api/profile/check-username?username=hello world" | jq .
# Expected: { available: false, reason: "invalid_chars" }
```

- [ ] **Step 6: Commit**

```bash
git add apps/ui/src/app/api/profile/me/avatar/ \
        apps/ui/src/app/api/profile/check-username/ \
        apps/ui/src/app/api/topics/ \
        apps/ui/src/app/api/profile/me/route.ts
git commit -m "feat(ui): add avatar upload, username check, and topics API routes"
```

---

## Task 3: Countries static data

**Files:**

- Create: `apps/ui/src/lib/data/countries.ts`

- [ ] **Step 1: Create static countries list**

Create `apps/ui/src/lib/data/countries.ts`:

```typescript
export type Country = { code: string; name: string }

export const COUNTRIES: Country[] = [
  { code: "AF", name: "Afghanistan" },
  { code: "AL", name: "Albania" },
  { code: "DZ", name: "Algeria" },
  { code: "AD", name: "Andorra" },
  { code: "AO", name: "Angola" },
  { code: "AG", name: "Antigua and Barbuda" },
  { code: "AR", name: "Argentina" },
  { code: "AM", name: "Armenia" },
  { code: "AU", name: "Australia" },
  { code: "AT", name: "Austria" },
  { code: "AZ", name: "Azerbaijan" },
  { code: "BS", name: "Bahamas" },
  { code: "BH", name: "Bahrain" },
  { code: "BD", name: "Bangladesh" },
  { code: "BB", name: "Barbados" },
  { code: "BY", name: "Belarus" },
  { code: "BE", name: "Belgium" },
  { code: "BZ", name: "Belize" },
  { code: "BJ", name: "Benin" },
  { code: "BT", name: "Bhutan" },
  { code: "BO", name: "Bolivia" },
  { code: "BA", name: "Bosnia and Herzegovina" },
  { code: "BW", name: "Botswana" },
  { code: "BR", name: "Brazil" },
  { code: "BN", name: "Brunei" },
  { code: "BG", name: "Bulgaria" },
  { code: "BF", name: "Burkina Faso" },
  { code: "BI", name: "Burundi" },
  { code: "CV", name: "Cabo Verde" },
  { code: "KH", name: "Cambodia" },
  { code: "CM", name: "Cameroon" },
  { code: "CA", name: "Canada" },
  { code: "CF", name: "Central African Republic" },
  { code: "TD", name: "Chad" },
  { code: "CL", name: "Chile" },
  { code: "CN", name: "China" },
  { code: "CO", name: "Colombia" },
  { code: "KM", name: "Comoros" },
  { code: "CG", name: "Congo" },
  { code: "CD", name: "Congo, DR" },
  { code: "CR", name: "Costa Rica" },
  { code: "CI", name: "Côte d'Ivoire" },
  { code: "HR", name: "Croatia" },
  { code: "CU", name: "Cuba" },
  { code: "CY", name: "Cyprus" },
  { code: "CZ", name: "Czech Republic" },
  { code: "DK", name: "Denmark" },
  { code: "DJ", name: "Djibouti" },
  { code: "DM", name: "Dominica" },
  { code: "DO", name: "Dominican Republic" },
  { code: "EC", name: "Ecuador" },
  { code: "EG", name: "Egypt" },
  { code: "SV", name: "El Salvador" },
  { code: "GQ", name: "Equatorial Guinea" },
  { code: "ER", name: "Eritrea" },
  { code: "EE", name: "Estonia" },
  { code: "SZ", name: "Eswatini" },
  { code: "ET", name: "Ethiopia" },
  { code: "FJ", name: "Fiji" },
  { code: "FI", name: "Finland" },
  { code: "FR", name: "France" },
  { code: "GA", name: "Gabon" },
  { code: "GM", name: "Gambia" },
  { code: "GE", name: "Georgia" },
  { code: "DE", name: "Germany" },
  { code: "GH", name: "Ghana" },
  { code: "GR", name: "Greece" },
  { code: "GD", name: "Grenada" },
  { code: "GT", name: "Guatemala" },
  { code: "GN", name: "Guinea" },
  { code: "GW", name: "Guinea-Bissau" },
  { code: "GY", name: "Guyana" },
  { code: "HT", name: "Haiti" },
  { code: "HN", name: "Honduras" },
  { code: "HU", name: "Hungary" },
  { code: "IS", name: "Iceland" },
  { code: "IN", name: "India" },
  { code: "ID", name: "Indonesia" },
  { code: "IR", name: "Iran" },
  { code: "IQ", name: "Iraq" },
  { code: "IE", name: "Ireland" },
  { code: "IL", name: "Israel" },
  { code: "IT", name: "Italy" },
  { code: "JM", name: "Jamaica" },
  { code: "JP", name: "Japan" },
  { code: "JO", name: "Jordan" },
  { code: "KZ", name: "Kazakhstan" },
  { code: "KE", name: "Kenya" },
  { code: "KI", name: "Kiribati" },
  { code: "KP", name: "Korea, North" },
  { code: "KR", name: "Korea, South" },
  { code: "XK", name: "Kosovo" },
  { code: "KW", name: "Kuwait" },
  { code: "KG", name: "Kyrgyzstan" },
  { code: "LA", name: "Laos" },
  { code: "LV", name: "Latvia" },
  { code: "LB", name: "Lebanon" },
  { code: "LS", name: "Lesotho" },
  { code: "LR", name: "Liberia" },
  { code: "LY", name: "Libya" },
  { code: "LI", name: "Liechtenstein" },
  { code: "LT", name: "Lithuania" },
  { code: "LU", name: "Luxembourg" },
  { code: "MG", name: "Madagascar" },
  { code: "MW", name: "Malawi" },
  { code: "MY", name: "Malaysia" },
  { code: "MV", name: "Maldives" },
  { code: "ML", name: "Mali" },
  { code: "MT", name: "Malta" },
  { code: "MH", name: "Marshall Islands" },
  { code: "MR", name: "Mauritania" },
  { code: "MU", name: "Mauritius" },
  { code: "MX", name: "Mexico" },
  { code: "FM", name: "Micronesia" },
  { code: "MD", name: "Moldova" },
  { code: "MC", name: "Monaco" },
  { code: "MN", name: "Mongolia" },
  { code: "ME", name: "Montenegro" },
  { code: "MA", name: "Morocco" },
  { code: "MZ", name: "Mozambique" },
  { code: "MM", name: "Myanmar" },
  { code: "NA", name: "Namibia" },
  { code: "NR", name: "Nauru" },
  { code: "NP", name: "Nepal" },
  { code: "NL", name: "Netherlands" },
  { code: "NZ", name: "New Zealand" },
  { code: "NI", name: "Nicaragua" },
  { code: "NE", name: "Niger" },
  { code: "NG", name: "Nigeria" },
  { code: "MK", name: "North Macedonia" },
  { code: "NO", name: "Norway" },
  { code: "OM", name: "Oman" },
  { code: "PK", name: "Pakistan" },
  { code: "PW", name: "Palau" },
  { code: "PA", name: "Panama" },
  { code: "PG", name: "Papua New Guinea" },
  { code: "PY", name: "Paraguay" },
  { code: "PE", name: "Peru" },
  { code: "PH", name: "Philippines" },
  { code: "PL", name: "Poland" },
  { code: "PT", name: "Portugal" },
  { code: "QA", name: "Qatar" },
  { code: "RO", name: "Romania" },
  { code: "RU", name: "Russia" },
  { code: "RW", name: "Rwanda" },
  { code: "KN", name: "Saint Kitts and Nevis" },
  { code: "LC", name: "Saint Lucia" },
  { code: "VC", name: "Saint Vincent and the Grenadines" },
  { code: "WS", name: "Samoa" },
  { code: "SM", name: "San Marino" },
  { code: "ST", name: "Sao Tome and Principe" },
  { code: "SA", name: "Saudi Arabia" },
  { code: "SN", name: "Senegal" },
  { code: "RS", name: "Serbia" },
  { code: "SC", name: "Seychelles" },
  { code: "SL", name: "Sierra Leone" },
  { code: "SG", name: "Singapore" },
  { code: "SK", name: "Slovakia" },
  { code: "SI", name: "Slovenia" },
  { code: "SB", name: "Solomon Islands" },
  { code: "SO", name: "Somalia" },
  { code: "ZA", name: "South Africa" },
  { code: "SS", name: "South Sudan" },
  { code: "ES", name: "Spain" },
  { code: "LK", name: "Sri Lanka" },
  { code: "SD", name: "Sudan" },
  { code: "SR", name: "Suriname" },
  { code: "SE", name: "Sweden" },
  { code: "CH", name: "Switzerland" },
  { code: "SY", name: "Syria" },
  { code: "TW", name: "Taiwan" },
  { code: "TJ", name: "Tajikistan" },
  { code: "TZ", name: "Tanzania" },
  { code: "TH", name: "Thailand" },
  { code: "TL", name: "Timor-Leste" },
  { code: "TG", name: "Togo" },
  { code: "TO", name: "Tonga" },
  { code: "TT", name: "Trinidad and Tobago" },
  { code: "TN", name: "Tunisia" },
  { code: "TR", name: "Turkey" },
  { code: "TM", name: "Turkmenistan" },
  { code: "TV", name: "Tuvalu" },
  { code: "UG", name: "Uganda" },
  { code: "UA", name: "Ukraine" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "GB", name: "United Kingdom" },
  { code: "US", name: "United States" },
  { code: "UY", name: "Uruguay" },
  { code: "UZ", name: "Uzbekistan" },
  { code: "VU", name: "Vanuatu" },
  { code: "VE", name: "Venezuela" },
  { code: "VN", name: "Vietnam" },
  { code: "YE", name: "Yemen" },
  { code: "ZM", name: "Zambia" },
  { code: "ZW", name: "Zimbabwe" },
]
```

- [ ] **Step 2: Commit**

```bash
git add apps/ui/src/lib/data/countries.ts
git commit -m "feat(ui): add static ISO countries list"
```

---

## Task 4: CountryCombobox component

**Files:**

- Create: `apps/ui/src/components/settings/CountryCombobox.tsx`

- [ ] **Step 1: Create the component**

Create `apps/ui/src/components/settings/CountryCombobox.tsx`:

```tsx
"use client"

import { useState, useRef, useEffect } from "react"

import { COUNTRIES, type Country } from "@/lib/data/countries"
import { T } from "@/lib/design-tokens"

const triggerStyle = {
  width: "100%",
  padding: "10px 14px",
  borderRadius: "8px",
  border: `1px solid ${T.border.hi}`,
  background: "rgba(255,255,255,0.04)",
  color: T.ink.base,
  fontSize: "13px",
  fontFamily: T.font.sans,
  outline: "none",
  boxSizing: "border-box" as const,
  cursor: "pointer",
  textAlign: "left" as const,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
}

export function CountryCombobox({
  value,
  onChange,
}: {
  value: string
  onChange: (code: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = COUNTRIES.find((c) => c.code === value)
  const filtered = query
    ? COUNTRIES.filter((c) =>
        c.name.toLowerCase().includes(query.toLowerCase())
      )
    : COUNTRIES

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
        setQuery("")
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <button
        type="button"
        style={triggerStyle}
        className="focus:border-[rgba(127,223,255,.4)]"
        onClick={() => setOpen((o) => !o)}
      >
        <span style={{ color: selected ? T.ink.base : T.ink.faint }}>
          {selected ? selected.name : "Select country…"}
        </span>
        <span style={{ color: T.ink.faint, fontSize: "10px" }}>▾</span>
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            zIndex: 50,
            background: "rgba(7,11,30,0.98)",
            border: `1px solid ${T.border.hi}`,
            borderRadius: "8px",
            overflow: "hidden",
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
          }}
        >
          <input
            ref={inputRef}
            type="text"
            placeholder="Search countries…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 14px",
              border: "none",
              borderBottom: `1px solid ${T.border.line}`,
              background: "transparent",
              color: T.ink.base,
              fontSize: "13px",
              fontFamily: T.font.sans,
              outline: "none",
              boxSizing: "border-box",
            }}
          />
          <div style={{ maxHeight: "240px", overflowY: "auto" }}>
            {filtered.length === 0 && (
              <div
                style={{
                  padding: "12px 14px",
                  color: T.ink.faint,
                  fontSize: "13px",
                }}
              >
                No results
              </div>
            )}
            {filtered.map((c) => (
              <button
                key={c.code}
                type="button"
                onClick={() => {
                  onChange(c.code)
                  setOpen(false)
                  setQuery("")
                }}
                style={{
                  display: "block",
                  width: "100%",
                  padding: "9px 14px",
                  background:
                    c.code === value ? "rgba(127,223,255,0.08)" : "transparent",
                  border: "none",
                  color: c.code === value ? T.accent.aurora : T.ink.dim,
                  fontSize: "13px",
                  fontFamily: T.font.sans,
                  cursor: "pointer",
                  textAlign: "left",
                }}
                className="hover:bg-white/[0.05]"
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/ui/src/components/settings/CountryCombobox.tsx
git commit -m "feat(ui): add CountryCombobox with searchable dropdown"
```

---

## Task 5: TimezoneCombobox component

**Files:**

- Create: `apps/ui/src/components/settings/TimezoneCombobox.tsx`

- [ ] **Step 1: Create the component**

Create `apps/ui/src/components/settings/TimezoneCombobox.tsx`:

```tsx
"use client"

import { useState, useRef, useEffect, useMemo } from "react"

import { T } from "@/lib/design-tokens"

function getTimezones(): string[] {
  try {
    return Intl.supportedValuesOf("timeZone")
  } catch {
    // Fallback for environments that don't support this
    return [
      "UTC",
      "America/New_York",
      "America/Los_Angeles",
      "Europe/London",
      "Europe/Paris",
      "Asia/Tokyo",
      "Asia/Shanghai",
      "Australia/Sydney",
    ]
  }
}

const triggerStyle = {
  width: "100%",
  padding: "10px 14px",
  borderRadius: "8px",
  border: `1px solid ${T.border.hi}`,
  background: "rgba(255,255,255,0.04)",
  color: T.ink.base,
  fontSize: "13px",
  fontFamily: T.font.sans,
  outline: "none",
  boxSizing: "border-box" as const,
  cursor: "pointer",
  textAlign: "left" as const,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
}

export function TimezoneCombobox({
  value,
  onChange,
}: {
  value: string
  onChange: (tz: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const timezones = useMemo(() => getTimezones(), [])

  const filtered = useMemo(() => {
    if (!query) return timezones
    const q = query.toLowerCase()
    return timezones.filter(
      (tz) =>
        tz.toLowerCase().includes(q) ||
        tz.replace(/_/g, " ").toLowerCase().includes(q)
    )
  }, [query, timezones])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
        setQuery("")
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  const displayValue = value ? value.replace(/_/g, " ") : ""

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <button
        type="button"
        style={triggerStyle}
        className="focus:border-[rgba(127,223,255,.4)]"
        onClick={() => setOpen((o) => !o)}
      >
        <span style={{ color: value ? T.ink.base : T.ink.faint }}>
          {displayValue || "Select timezone…"}
        </span>
        <span style={{ color: T.ink.faint, fontSize: "10px" }}>▾</span>
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            zIndex: 50,
            background: "rgba(7,11,30,0.98)",
            border: `1px solid ${T.border.hi}`,
            borderRadius: "8px",
            overflow: "hidden",
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
          }}
        >
          <input
            ref={inputRef}
            type="text"
            placeholder="Search timezones… (e.g. London, Paris)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 14px",
              border: "none",
              borderBottom: `1px solid ${T.border.line}`,
              background: "transparent",
              color: T.ink.base,
              fontSize: "13px",
              fontFamily: T.font.sans,
              outline: "none",
              boxSizing: "border-box",
            }}
          />
          <div style={{ maxHeight: "240px", overflowY: "auto" }}>
            {filtered.length === 0 && (
              <div
                style={{
                  padding: "12px 14px",
                  color: T.ink.faint,
                  fontSize: "13px",
                }}
              >
                No results
              </div>
            )}
            {filtered.slice(0, 100).map((tz) => (
              <button
                key={tz}
                type="button"
                onClick={() => {
                  onChange(tz)
                  setOpen(false)
                  setQuery("")
                }}
                style={{
                  display: "block",
                  width: "100%",
                  padding: "9px 14px",
                  background:
                    tz === value ? "rgba(127,223,255,0.08)" : "transparent",
                  border: "none",
                  color: tz === value ? T.accent.aurora : T.ink.dim,
                  fontSize: "13px",
                  fontFamily: T.font.mono,
                  cursor: "pointer",
                  textAlign: "left",
                }}
                className="hover:bg-white/[0.05]"
              >
                {tz.replace(/_/g, " ")}
              </button>
            ))}
            {filtered.length > 100 && (
              <div
                style={{
                  padding: "8px 14px",
                  color: T.ink.faint,
                  fontSize: "11px",
                  fontFamily: T.font.mono,
                }}
              >
                {filtered.length - 100} more — refine your search
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/ui/src/components/settings/TimezoneCombobox.tsx
git commit -m "feat(ui): add TimezoneCombobox with Intl timezone list"
```

---

## Task 6: AvatarUpload component

**Files:**

- Create: `apps/ui/src/components/settings/AvatarUpload.tsx`

- [ ] **Step 1: Create the component**

Create `apps/ui/src/components/settings/AvatarUpload.tsx`:

```tsx
"use client"

import { useRef, useState } from "react"
import { toast } from "sonner"

import { T } from "@/lib/design-tokens"

export function AvatarUpload({
  currentUrl,
  initials,
  onUpload,
}: {
  currentUrl?: string | null
  initials: string
  onUpload: (url: string) => void
}) {
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<string | null>(currentUrl ?? null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File too large — max 5 MB")
      return
    }
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"]
    if (!allowed.includes(file.type)) {
      toast.error("Only JPG, PNG, WebP, or GIF allowed")
      return
    }

    // Show local preview immediately
    const localUrl = URL.createObjectURL(file)
    setPreview(localUrl)
    setUploading(true)

    try {
      const form = new FormData()
      form.append("file", file)
      const res = await fetch("/api/profile/me/avatar", {
        method: "POST",
        body: form,
      })
      const json = (await res.json()) as { url?: string; error?: string }
      if (!res.ok) {
        toast.error(json.error ?? "Upload failed")
        setPreview(currentUrl ?? null)
        return
      }
      onUpload(json.url!)
      toast.success("Avatar updated")
    } catch {
      toast.error("Upload failed")
      setPreview(currentUrl ?? null)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        style={{
          width: "56px",
          height: "56px",
          borderRadius: "50%",
          background: preview ? "transparent" : "rgba(127,223,255,0.15)",
          border: `1px solid ${uploading ? T.accent.aurora : "rgba(127,223,255,0.25)"}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: T.font.mono,
          fontSize: "18px",
          fontWeight: 600,
          color: T.accent.aurora,
          flexShrink: 0,
          overflow: "hidden",
          cursor: uploading ? "not-allowed" : "pointer",
          opacity: uploading ? 0.6 : 1,
          transition: "opacity 200ms",
          padding: 0,
        }}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt="avatar"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              borderRadius: "50%",
            }}
          />
        ) : (
          initials
        )}
      </button>

      <div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          style={{
            padding: "6px 14px",
            borderRadius: "6px",
            border: `1px solid ${T.border.hi}`,
            background: "rgba(255,255,255,0.05)",
            color: T.ink.dim,
            fontSize: "12px",
            fontFamily: T.font.sans,
            cursor: uploading ? "not-allowed" : "pointer",
            opacity: uploading ? 0.6 : 1,
          }}
        >
          {uploading ? "Uploading…" : "Upload new photo"}
        </button>
        <p
          style={{
            margin: "4px 0 0",
            fontSize: "11px",
            color: T.ink.faint,
            fontFamily: T.font.mono,
          }}
        >
          JPG · PNG · WebP · max 5 MB
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void handleFile(file)
          e.target.value = ""
        }}
      />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/ui/src/components/settings/AvatarUpload.tsx
git commit -m "feat(ui): add AvatarUpload component with Strapi proxy"
```

---

## Task 7: VisibilityCards and InterestsChips

**Files:**

- Create: `apps/ui/src/components/settings/VisibilityCards.tsx`
- Create: `apps/ui/src/components/settings/InterestsChips.tsx`

- [ ] **Step 1: Create VisibilityCards**

Create `apps/ui/src/components/settings/VisibilityCards.tsx`:

```tsx
"use client"

import { T } from "@/lib/design-tokens"

type Visibility = "public" | "limited" | "private"

const OPTIONS: { value: Visibility; label: string; desc: string }[] = [
  {
    value: "public",
    label: "Public",
    desc: "Everyone can see your full profile — name, bio, location, links, and activity.",
  },
  {
    value: "limited",
    label: "Limited",
    desc: "Only your name and avatar are visible. Bio, location, and links are hidden.",
  },
  {
    value: "private",
    label: "Private",
    desc: "Your profile is hidden from everyone. Only you can see it when signed in.",
  },
]

export function VisibilityCards({
  value,
  onChange,
}: {
  value: Visibility
  onChange: (v: Visibility) => void
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {OPTIONS.map((opt) => {
        const selected = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            style={{
              padding: "14px 18px",
              borderRadius: "8px",
              border: `1px solid ${selected ? "rgba(127,223,255,0.4)" : T.border.line}`,
              background: selected
                ? "rgba(127,223,255,0.06)"
                : "rgba(255,255,255,0.02)",
              cursor: "pointer",
              textAlign: "left",
              transition: "border-color 150ms, background 150ms",
              display: "flex",
              alignItems: "flex-start",
              gap: "12px",
            }}
          >
            <div
              style={{
                width: "16px",
                height: "16px",
                borderRadius: "50%",
                border: `2px solid ${selected ? T.accent.aurora : T.border.hi}`,
                background: selected ? T.accent.aurora : "transparent",
                flexShrink: 0,
                marginTop: "2px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {selected && (
                <div
                  style={{
                    width: "6px",
                    height: "6px",
                    borderRadius: "50%",
                    background: "#030511",
                  }}
                />
              )}
            </div>
            <div>
              <p
                style={{
                  margin: 0,
                  fontSize: "13px",
                  fontWeight: 600,
                  color: selected ? T.ink.base : T.ink.dim,
                }}
              >
                {opt.label}
              </p>
              <p
                style={{
                  margin: "2px 0 0",
                  fontSize: "12px",
                  color: T.ink.faint,
                }}
              >
                {opt.desc}
              </p>
            </div>
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Create InterestsChips**

Create `apps/ui/src/components/settings/InterestsChips.tsx`:

```tsx
"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"

import { T } from "@/lib/design-tokens"
import type { Topic } from "@/lib/types/profile"

export function InterestsChips({
  selected,
  onChange,
}: {
  selected: string[]
  onChange: (ids: string[]) => void
}) {
  const [topics, setTopics] = useState<Topic[]>([])
  const [suggestInput, setSuggestInput] = useState("")
  const [suggesting, setSuggesting] = useState(false)

  useEffect(() => {
    fetch("/api/topics")
      .then((r) => r.json())
      .then((json) => setTopics(json.data ?? []))
      .catch(() => {})
  }, [])

  const toggle = (id: string) => {
    if (selected.includes(id)) {
      onChange(selected.filter((s) => s !== id))
    } else {
      onChange([...selected, id])
    }
  }

  const suggest = async () => {
    const name = suggestInput.trim()
    if (!name || name.length < 2) return
    setSuggesting(true)
    try {
      const res = await fetch("/api/profile/me/suggest-topic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      })
      if (res.ok) {
        toast.success(`"${name}" submitted for review`)
        setSuggestInput("")
      } else {
        toast.error("Failed to submit suggestion")
      }
    } catch {
      toast.error("Failed to submit suggestion")
    } finally {
      setSuggesting(false)
    }
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "8px",
          marginBottom: "12px",
        }}
      >
        {topics.map((topic) => {
          const active = selected.includes(topic.documentId)
          return (
            <button
              key={topic.documentId}
              type="button"
              onClick={() => toggle(topic.documentId)}
              style={{
                padding: "5px 12px",
                borderRadius: "999px",
                border: `1px solid ${active ? "rgba(127,223,255,0.5)" : T.border.line}`,
                background: active
                  ? "rgba(127,223,255,0.1)"
                  : "rgba(255,255,255,0.03)",
                color: active ? T.accent.aurora : T.ink.dim,
                fontSize: "12px",
                fontFamily: T.font.mono,
                letterSpacing: "0.04em",
                cursor: "pointer",
                transition: "all 150ms",
              }}
            >
              {topic.name}
            </button>
          )
        })}
      </div>

      {/* Suggest new topic */}
      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
        <input
          type="text"
          placeholder="Suggest a topic…"
          value={suggestInput}
          onChange={(e) => setSuggestInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              void suggest()
            }
          }}
          style={{
            flex: 1,
            padding: "8px 12px",
            borderRadius: "6px",
            border: `1px solid ${T.border.line}`,
            background: "rgba(255,255,255,0.03)",
            color: T.ink.base,
            fontSize: "12px",
            fontFamily: T.font.sans,
            outline: "none",
          }}
        />
        <button
          type="button"
          onClick={() => void suggest()}
          disabled={suggesting || suggestInput.trim().length < 2}
          style={{
            padding: "8px 14px",
            borderRadius: "6px",
            border: `1px solid ${T.border.line}`,
            background: "rgba(255,255,255,0.05)",
            color: T.ink.dim,
            fontSize: "12px",
            fontFamily: T.font.sans,
            cursor: suggesting ? "not-allowed" : "pointer",
            opacity: suggesting ? 0.6 : 1,
          }}
        >
          {suggesting ? "…" : "Suggest"}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/ui/src/components/settings/VisibilityCards.tsx \
        apps/ui/src/components/settings/InterestsChips.tsx
git commit -m "feat(ui): add VisibilityCards and InterestsChips components"
```

---

## Task 8: Rewrite PublicProfileSection

**Files:**

- Modify: `apps/ui/src/app/[locale]/settings/_components/PublicProfileSection.tsx`

- [ ] **Step 1: Rewrite PublicProfileSection.tsx**

Replace the entire file:

```tsx
"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

import { AvatarUpload } from "@/components/settings/AvatarUpload"
import { CountryCombobox } from "@/components/settings/CountryCombobox"
import { InterestsChips } from "@/components/settings/InterestsChips"
import { TimezoneCombobox } from "@/components/settings/TimezoneCombobox"
import { VisibilityCards } from "@/components/settings/VisibilityCards"
import { useProfile } from "@/hooks/useProfile"
import type { BetterAuthUser } from "@/lib/auth-server"
import { T } from "@/lib/design-tokens"
import { Link } from "@/lib/navigation"
import type { UserProfile } from "@/lib/types/profile"

const inputStyle = {
  width: "100%",
  padding: "10px 14px",
  borderRadius: "8px",
  border: `1px solid ${T.border.hi}`,
  background: "rgba(255,255,255,0.04)",
  color: T.ink.base,
  fontSize: "13px",
  fontFamily: T.font.sans,
  outline: "none",
  boxSizing: "border-box" as const,
}

const labelStyle = {
  fontFamily: T.font.mono,
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

export function PublicProfileSection({
  profile,
  sessionUser,
}: {
  profile: UserProfile | null
  sessionUser: BetterAuthUser
}) {
  const { saving, updateProfile } = useProfile()
  const isIncomplete = !profile?.firstName || !profile?.affiliationType

  const [form, setForm] = useState({
    firstName: profile?.firstName ?? sessionUser.name?.split(" ")[0] ?? "",
    lastName:
      profile?.lastName ??
      sessionUser.name?.split(" ").slice(1).join(" ") ??
      "",
    username: profile?.username ?? "",
    pronouns: profile?.pronouns ?? "",
    bio: profile?.bio ?? "",
    affiliation: profile?.affiliation ?? "",
    affiliationType: profile?.affiliationType ?? "",
    role: profile?.role ?? "",
    city: profile?.city ?? "",
    country: profile?.country ?? "",
    timezone: profile?.timezone ?? "",
    website: profile?.website ?? "",
    orcid: profile?.orcid ?? "",
    mastodon: profile?.mastodon ?? "",
    linkedin: profile?.linkedin ?? "",
    profileVisibility: (profile?.profileVisibility ?? "public") as
      | "public"
      | "limited"
      | "private",
    interests: profile?.interests ?? [],
    avatarUrl: profile?.avatarUrl ?? "",
  })

  const [usernameStatus, setUsernameStatus] = useState<
    "idle" | "checking" | "available" | "taken"
  >("idle")

  const field = useCallback(
    (key: keyof typeof form) => ({
      value: form[key] as string,
      onChange: (
        e: React.ChangeEvent<
          HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
        >
      ) => setForm((f) => ({ ...f, [key]: e.target.value })),
    }),
    [form]
  )

  useEffect(() => {
    const username = form.username.trim()
    if (!username || username === profile?.username) {
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
  }, [form.username, profile?.username])

  const initials =
    ((form.firstName[0] ?? "") + (form.lastName[0] ?? "")).toUpperCase() || "?"

  const handleSave = async () => {
    if (usernameStatus === "taken") {
      toast.error("That username is taken")
      return
    }
    const payload: Partial<UserProfile> = {
      firstName: form.firstName,
      lastName: form.lastName,
      username: form.username,
      pronouns: form.pronouns as UserProfile["pronouns"],
      bio: form.bio,
      affiliation: form.affiliation,
      affiliationType: form.affiliationType as UserProfile["affiliationType"],
      role: form.role,
      city: form.city,
      country: form.country,
      timezone: form.timezone,
      website: form.website,
      orcid: form.orcid,
      mastodon: form.mastodon,
      linkedin: form.linkedin,
      profileVisibility: form.profileVisibility,
      interests: form.interests,
    }
    await updateProfile(payload)
  }

  const handleDiscard = () => {
    setForm({
      firstName: profile?.firstName ?? "",
      lastName: profile?.lastName ?? "",
      username: profile?.username ?? "",
      pronouns: profile?.pronouns ?? "",
      bio: profile?.bio ?? "",
      affiliation: profile?.affiliation ?? "",
      affiliationType: profile?.affiliationType ?? "",
      role: profile?.role ?? "",
      city: profile?.city ?? "",
      country: profile?.country ?? "",
      timezone: profile?.timezone ?? "",
      website: profile?.website ?? "",
      orcid: profile?.orcid ?? "",
      mastodon: profile?.mastodon ?? "",
      linkedin: profile?.linkedin ?? "",
      profileVisibility: profile?.profileVisibility ?? "public",
      interests: profile?.interests ?? [],
      avatarUrl: profile?.avatarUrl ?? "",
    })
    setUsernameStatus("idle")
  }

  return (
    <div
      style={{
        border: `1px solid ${T.border.line}`,
        borderRadius: "12px",
        overflow: "hidden",
      }}
    >
      {/* Section header */}
      <div
        style={{
          padding: "20px 24px",
          borderBottom: `1px solid ${T.border.line}`,
          background: "rgba(255,255,255,0.02)",
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: "16px",
            fontWeight: 600,
            color: T.ink.base,
          }}
        >
          Public profile
        </h2>
        <p style={{ margin: "4px 0 0", fontSize: "13px", color: T.ink.faint }}>
          This is what other contributors see. Your email is never shown
          publicly.
        </p>
      </div>

      <div
        style={{
          padding: "24px",
          display: "flex",
          flexDirection: "column",
          gap: "20px",
        }}
      >
        {/* Incomplete profile CTA */}
        {isIncomplete && (
          <div
            style={{
              padding: "14px 18px",
              borderRadius: "8px",
              background: "rgba(127,223,255,0.06)",
              border: "1px solid rgba(127,223,255,0.2)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <p style={{ margin: 0, fontSize: "13px", color: T.ink.dim }}>
              Complete your profile to connect with libraries and the community.
            </p>
            <Link
              href="/onboarding"
              style={{
                fontSize: "12px",
                fontFamily: T.font.mono,
                letterSpacing: "0.06em",
                color: T.accent.aurora,
                textDecoration: "none",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              Complete profile →
            </Link>
          </div>
        )}

        {/* Avatar */}
        <AvatarUpload
          currentUrl={form.avatarUrl}
          initials={initials}
          onUpload={(url) => setForm((f) => ({ ...f, avatarUrl: url }))}
        />

        {/* Name row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "12px",
          }}
        >
          <div>
            <label style={labelStyle}>First name</label>
            <input
              style={inputStyle}
              type="text"
              {...field("firstName")}
              className="focus:border-[rgba(127,223,255,.4)]"
            />
          </div>
          <div>
            <label style={labelStyle}>Last name</label>
            <input
              style={inputStyle}
              type="text"
              {...field("lastName")}
              className="focus:border-[rgba(127,223,255,.4)]"
            />
          </div>
        </div>

        {/* Username */}
        <div>
          <label
            style={{
              ...labelStyle,
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <span>Username · libraries.global/@username</span>
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
                usernameStatus === "taken"
                  ? "rgba(255,138,138,0.4)"
                  : undefined,
            }}
            type="text"
            {...field("username")}
            className="focus:border-[rgba(127,223,255,.4)]"
            placeholder="yourhandle"
          />
        </div>

        {/* Pronouns */}
        <div>
          <label style={labelStyle}>Pronouns</label>
          <select
            style={{ ...inputStyle, cursor: "pointer" }}
            {...field("pronouns")}
            className="focus:border-[rgba(127,223,255,.4)]"
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

        {/* Bio */}
        <div>
          <label
            style={{
              ...labelStyle,
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <span>Bio</span>
            <span style={{ color: T.ink.faint }}>{form.bio.length}/400</span>
          </label>
          <textarea
            style={{ ...inputStyle, resize: "vertical", minHeight: "80px" }}
            maxLength={400}
            {...field("bio")}
            className="focus:border-[rgba(127,223,255,.4)]"
          />
        </div>

        {/* Affiliation + Role */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "12px",
          }}
        >
          <div>
            <label style={labelStyle}>Affiliation</label>
            <input
              style={inputStyle}
              type="text"
              {...field("affiliation")}
              className="focus:border-[rgba(127,223,255,.4)]"
              placeholder="Bibliothèque nationale de France"
            />
          </div>
          <div>
            <label style={labelStyle}>Role</label>
            <input
              style={inputStyle}
              type="text"
              {...field("role")}
              className="focus:border-[rgba(127,223,255,.4)]"
              placeholder="Senior curator"
            />
          </div>
        </div>

        {/* City + Country */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "12px",
          }}
        >
          <div>
            <label style={labelStyle}>City</label>
            <input
              style={inputStyle}
              type="text"
              {...field("city")}
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

        {/* Timezone */}
        <div>
          <label style={labelStyle}>Timezone</label>
          <TimezoneCombobox
            value={form.timezone}
            onChange={(tz) => setForm((f) => ({ ...f, timezone: tz }))}
          />
        </div>

        {/* Website */}
        <div>
          <label style={labelStyle}>Website</label>
          <input
            style={inputStyle}
            type="url"
            {...field("website")}
            className="focus:border-[rgba(127,223,255,.4)]"
            placeholder="https://yoursite.net"
          />
        </div>

        {/* Social links */}
        <div>
          <label style={labelStyle}>External links</label>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <input
              style={inputStyle}
              type="text"
              {...field("orcid")}
              className="focus:border-[rgba(127,223,255,.4)]"
              placeholder="ORCID (https://orcid.org/0000-0000-0000-0000)"
            />
            <input
              style={inputStyle}
              type="text"
              {...field("mastodon")}
              className="focus:border-[rgba(127,223,255,.4)]"
              placeholder="Mastodon / Bluesky handle"
            />
            <input
              style={inputStyle}
              type="url"
              {...field("linkedin")}
              className="focus:border-[rgba(127,223,255,.4)]"
              placeholder="LinkedIn URL"
            />
          </div>
        </div>

        {/* Profile visibility */}
        <div>
          <label style={labelStyle}>Profile visibility</label>
          <VisibilityCards
            value={form.profileVisibility}
            onChange={(v) => setForm((f) => ({ ...f, profileVisibility: v }))}
          />
        </div>

        {/* Interests */}
        <div>
          <label style={labelStyle}>Interests</label>
          <InterestsChips
            selected={form.interests}
            onChange={(ids) => setForm((f) => ({ ...f, interests: ids }))}
          />
        </div>

        {/* Actions */}
        <div
          style={{
            display: "flex",
            gap: "10px",
            justifyContent: "flex-end",
            paddingTop: "8px",
            borderTop: `1px solid ${T.border.line}`,
          }}
        >
          <button
            type="button"
            onClick={handleDiscard}
            style={{
              padding: "9px 18px",
              borderRadius: "8px",
              border: `1px solid ${T.border.line}`,
              background: "transparent",
              color: T.ink.dim,
              fontSize: "13px",
              fontFamily: T.font.sans,
              cursor: "pointer",
            }}
          >
            Discard
          </button>
          <button
            type="button"
            disabled={saving || usernameStatus === "taken"}
            onClick={() => void handleSave()}
            style={{
              padding: "9px 18px",
              borderRadius: "8px",
              border: "none",
              background: T.ink.base,
              color: "#030511",
              fontSize: "13px",
              fontFamily: T.font.sans,
              fontWeight: 600,
              cursor:
                saving || usernameStatus === "taken"
                  ? "not-allowed"
                  : "pointer",
              opacity: saving || usernameStatus === "taken" ? 0.7 : 1,
            }}
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Update suggest-topic API route**

Create `apps/ui/src/app/api/profile/me/suggest-topic/route.ts`:

```typescript
import { headers } from "next/headers"
import { NextResponse } from "next/server"

import { auth } from "@/lib/auth"

const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
const SECRET = process.env.STRAPI_BRIDGE_SECRET

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!SECRET)
    return NextResponse.json(
      { error: "Bridge not configured" },
      { status: 500 }
    )

  const { name } = (await req.json()) as { name?: string }
  if (!name?.trim() || name.trim().length < 2)
    return NextResponse.json({ error: "Topic name too short" }, { status: 400 })

  // Create the topic in pending state
  const topicRes = await fetch(`${STRAPI}/api/topics/approved`, {
    method: "GET",
    next: { revalidate: 0 },
  })
  // Check for duplicates
  if (topicRes.ok) {
    const existing = (await topicRes.json()) as {
      data: Array<{ name: string }>
    }
    const duplicate = existing.data.find(
      (t) => t.name.toLowerCase() === name.trim().toLowerCase()
    )
    if (duplicate)
      return NextResponse.json(
        { error: "Topic already exists" },
        { status: 409 }
      )
  }

  // Submit as moderation entry
  const res = await fetch(`${STRAPI}/api/content-moderation/submissions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: (await headers()).get("cookie") ?? "",
    },
    body: JSON.stringify({
      submissionType: "topic_suggestion",
      fields: { name: name.trim(), suggestedByEmail: session.user.email },
      note: `Topic suggestion: "${name.trim()}"`,
    }),
  })

  if (!res.ok)
    return NextResponse.json({ error: "Failed to submit" }, { status: 500 })

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: TypeScript compile check**

```bash
cd apps/ui && npx tsc --noEmit 2>&1 | grep -E "settings|CountryCombobox|TimezoneCombobox|AvatarUpload"
```

Expected: No errors.

- [ ] **Step 4: Manual test — open settings page**

Start the UI dev server and navigate to `http://localhost:3000/settings`:

- Country field should be a searchable dropdown
- Timezone field should be a searchable dropdown
- Avatar area should be clickable
- Interests chips should load from `/api/topics`
- Visibility shows 3 radio cards

- [ ] **Step 5: Commit**

```bash
git add apps/ui/src/app/[locale]/settings/_components/PublicProfileSection.tsx \
        apps/ui/src/app/api/profile/me/suggest-topic/ \
        apps/ui/src/components/settings/
git commit -m "feat(ui): rewrite PublicProfileSection with country/timezone dropdowns, avatar upload, interests chips, visibility cards"
```

---

## Verification

After all tasks complete:

```bash
# TypeScript clean
cd apps/ui && npx tsc --noEmit 2>&1 | grep -v "node_modules" | head -20
# Expected: 0 errors in project files

# Topics API
curl -s http://localhost:3000/api/topics | jq '.data | length'
# Expected: 25

# Username check
curl -s "http://localhost:3000/api/profile/check-username?username=testuser123" | jq .
# Expected: { available: true }
```
