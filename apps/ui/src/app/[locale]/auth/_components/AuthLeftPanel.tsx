// apps/ui/src/app/[locale]/auth/_components/AuthLeftPanel.tsx
import { Icon } from "@iconify/react"
import type { ReactNode } from "react"

import GlobalLink from "@/components/global/GlobalLink"
import { SITE_NAME } from "@/lib/constants"
import { T } from "@/lib/design-tokens"

import { type AuthTip, AuthTipCarousel } from "./AuthTipCarousel"

export interface JournalTeaser {
  title: string
  href: string
}

interface AuthLeftPanelProps {
  mode: "signin" | "register"
  /** Latest journal article; the card is left out when there is none. */
  journal?: JournalTeaser | null
}

// Each tip describes a feature that exists today.
const TIPS: readonly AuthTip[] = [
  {
    title: "Filter to what's open now",
    body: "Find libraries can narrow any list to places open right now, checked against each library's own time zone.",
  },
  {
    title: "Zoom in to split the clusters",
    body: "Numbered circles on the map break apart into individual libraries as you zoom towards street level.",
  },
  {
    title: "Spotted a mistake? Suggest a fix",
    body: "Every library page has a correction link. Each change is reviewed before it goes live.",
  },
  {
    title: "Find talks and reading groups",
    body: "The events calendar gathers exhibitions, talks and reading groups from the libraries that publish them.",
  },
]

const STEPS = [
  { title: "Create your account", body: "Email and password, or Google." },
  { title: "Confirm your email", body: "Open the link we send you." },
  {
    title: "Set up your profile",
    body: "Choose a username and your interests.",
  },
]

const italic = { fontStyle: "italic", fontWeight: 400 } as const

const COPY: Record<
  AuthLeftPanelProps["mode"],
  { chipIcon: string; chip: string; heading: ReactNode; subtext: string }
> = {
  signin: {
    chipIcon: "mdi:earth",
    chip: "This week in the index",
    heading: (
      <>
        Every library, <span style={italic}>on every continent.</span>
      </>
    ),
    subtext:
      "Browsing and every library record are free without an account. Sign in to contribute and follow libraries.",
  },
  register: {
    chipIcon: "mdi:plus",
    chip: "Join the index",
    heading: (
      <>
        Help map <span style={italic}>the world&rsquo;s libraries.</span>
      </>
    ),
    subtext:
      "Three short steps, then you can start improving records. Every change is reviewed and credited to you.",
  },
}

export function AuthLeftPanel({ mode, journal }: AuthLeftPanelProps) {
  const copy = COPY[mode]

  return (
    <aside
      aria-label={`About ${SITE_NAME}`}
      className="hidden w-[52%] shrink-0 flex-col p-10 lg:flex xl:p-14"
      style={{
        background: T.bg.space,
        border: `1px solid ${T.border.line}`,
        borderRadius: "24px",
      }}
    >
      <GlobalLink
        href="/"
        className="self-start"
        style={{
          fontFamily: T.font.serif,
          fontSize: "1.65rem",
          fontWeight: 500,
          lineHeight: 1,
          color: T.ink.base,
        }}
      >
        Libraries <em style={italic}>Global</em>
      </GlobalLink>

      <div className="my-auto flex flex-col pt-12">
        <span
          className="inline-flex items-center gap-2 self-start px-4 py-2"
          style={{
            background: T.bg.deep,
            border: `1px solid ${T.border.line}`,
            borderRadius: "999px",
            fontSize: "15px",
            fontWeight: 500,
            color: T.ink.base,
          }}
        >
          <Icon
            icon={copy.chipIcon}
            width={16}
            aria-hidden="true"
            style={{ color: T.accent.primary }}
          />
          {copy.chip}
        </span>

        <p
          style={{
            marginTop: "20px",
            fontFamily: T.font.serif,
            fontSize: "clamp(3rem, 5.4vw, 5.5rem)",
            fontWeight: 500,
            lineHeight: 1,
            letterSpacing: "-0.03em",
            color: T.ink.base,
          }}
        >
          {copy.heading}
        </p>

        <p
          style={{
            marginTop: "24px",
            fontSize: "17px",
            lineHeight: 1.65,
            color: T.ink.dim,
            maxWidth: "48ch",
          }}
        >
          {copy.subtext}
        </p>

        <div className="mt-10">
          {mode === "register" ? (
            <StepCards activeStep={1} />
          ) : (
            <div
              className={
                journal ? "grid grid-cols-2 gap-4" : "grid max-w-sm gap-4"
              }
            >
              <AuthTipCarousel tips={TIPS} />
              {journal && <JournalCard journal={journal} />}
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}

function JournalCard({ journal }: { journal: JournalTeaser }) {
  return (
    <GlobalLink
      href={journal.href}
      className="group flex flex-col p-6 transition-colors"
      style={{
        background: T.accent.chip,
        border: "1px solid var(--t-aurora-edge)",
        borderRadius: "20px",
      }}
    >
      <span
        style={{
          fontSize: "14px",
          fontWeight: 600,
          color: T.accent.primary,
        }}
      >
        From the journal
      </span>
      <span
        style={{
          marginTop: "8px",
          fontFamily: T.font.serif,
          fontSize: "24px",
          lineHeight: 1.15,
          letterSpacing: "-0.01em",
          color: T.ink.base,
        }}
      >
        {journal.title}
      </span>
      <span
        className="mt-auto flex items-center gap-1.5 pt-8"
        style={{
          fontSize: "15px",
          fontWeight: 600,
          color: T.accent.primary,
        }}
      >
        Read the article
        <Icon
          icon="mdi:arrow-right"
          width={16}
          aria-hidden="true"
          className="transition-transform group-hover:translate-x-0.5"
        />
      </span>
    </GlobalLink>
  )
}

function StepCards({ activeStep }: { activeStep: 1 | 2 | 3 }) {
  return (
    <ol aria-label="Getting started" className="grid grid-cols-3 gap-3">
      {STEPS.map((step, i) => {
        const number = i + 1
        const active = number === activeStep

        return (
          <li
            key={step.title}
            aria-current={active ? "step" : undefined}
            className="flex min-h-[150px] flex-col justify-between gap-6 p-5"
            style={{
              background: active ? T.bg.deep : T.bg.surface,
              border: `1px solid ${active ? T.accent.primary : T.border.line}`,
              borderRadius: "20px",
            }}
          >
            <span
              className="flex size-9 items-center justify-center"
              style={{
                borderRadius: "999px",
                fontSize: "15px",
                fontWeight: 600,
                ...(active
                  ? { background: T.accent.primary, color: "#fff" }
                  : {
                      border: `1px solid ${T.border.hi}`,
                      color: T.ink.dim,
                    }),
              }}
            >
              {number}
            </span>
            <div>
              <p
                style={{
                  fontSize: "16px",
                  fontWeight: 600,
                  color: T.ink.base,
                }}
              >
                {step.title}
              </p>
              <p
                style={{
                  marginTop: "4px",
                  fontSize: "14px",
                  lineHeight: 1.5,
                  color: T.ink.dim,
                }}
              >
                {step.body}
              </p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
