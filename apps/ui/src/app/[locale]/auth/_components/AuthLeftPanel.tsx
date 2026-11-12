import { Icon } from "@iconify/react"
import { useTranslations } from "next-intl"

// apps/ui/src/app/[locale]/auth/_components/AuthLeftPanel.tsx

import GlobalLink from "@/components/global/GlobalLink"
import { SITE_NAME } from "@/lib/constants"
import { T } from "@/lib/design-tokens"

import { type AuthTip, AuthTipCarousel } from "./AuthTipCarousel"

export interface JournalTeaser {
  title: string
  href: string
}

interface AuthLeftPanelProps {
  /**
   * `verify` is sign-up's second step: the confirmation email has gone out.
   * `account` is for signed-in pages such as changing a password.
   */
  mode: "signin" | "register" | "verify" | "account"
  /** Latest journal article; the card is left out when there is none. */
  journal?: JournalTeaser | null
}

const ACTIVE_STEP: Partial<Record<AuthLeftPanelProps["mode"], 1 | 2>> = {
  register: 1,
  verify: 2,
}

export function AuthLeftPanel({ mode, journal }: AuthLeftPanelProps) {
  const tStatic = useTranslations("staticUi")

  const tUi = useTranslations("ui")

  const tPanel = useTranslations("authPanel")
  const tips: readonly AuthTip[] = (
    mode === "account"
      ? (["devices", "passwordless", "passphrase"] as const)
      : (["open", "zoom", "fix", "events"] as const)
  ).map((key) => ({ title: tPanel(`${key}Title`), body: tPanel(`${key}Body`) }))
  const copy = {
    chipIcon: {
      signin: "mdi:earth",
      register: "mdi:plus",
      verify: "mdi:email-check-outline",
      account: "mdi:shield-lock-outline",
    }[mode],
    chip: tPanel(`${mode}Chip`),
    heading: tPanel.rich(
      mode === "verify" ? "registerHeading" : `${mode}Heading`,
      {
        em: (chunks) => (
          <span style={{ fontStyle: "italic", fontWeight: 400 }}>{chunks}</span>
        ),
      }
    ),
    subtext: tPanel(`${mode}Subtext`),
  }
  const activeStep = ACTIVE_STEP[mode]

  return (
    <aside
      aria-label={tPanel("about", { name: SITE_NAME })}
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
        {tUi("libraries")}{" "}
        <em style={{ fontStyle: "italic", fontWeight: 400 }}>
          {tStatic("common.global")}
        </em>
      </GlobalLink>

      <div className="my-auto flex flex-col pt-12">
        <span
          className="inline-flex items-center gap-2 self-start px-4 py-2"
          style={{
            background: T.bg.deep,
            border: `1px solid ${T.border.line}`,
            borderRadius: "999px",
            fontSize: "var(--type-body-size)",
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
            font: T.type.displayBand,
            letterSpacing: "var(--type-display-tracking)",
            color: T.ink.base,
          }}
        >
          {copy.heading}
        </p>

        <p
          style={{
            marginTop: "24px",
            fontSize: "var(--type-body-size)",
            lineHeight: 1.65,
            color: T.ink.dim,
            maxWidth: "48ch",
          }}
        >
          {copy.subtext}
        </p>

        <div className="mt-10">
          {activeStep ? (
            <StepCards activeStep={activeStep} />
          ) : (
            <div
              className={
                journal ? "grid grid-cols-2 gap-4" : "grid max-w-sm gap-4"
              }
            >
              <AuthTipCarousel tips={tips} />
              {journal && <JournalCard journal={journal} />}
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}

function JournalCard({ journal }: { journal: JournalTeaser }) {
  const tPanel = useTranslations("authPanel")
  const tExisting = useTranslations()

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
          fontSize: "var(--type-body-small-size)",
          fontWeight: 600,
          color: T.accent.primary,
        }}
      >
        {tExisting("homepageFallback.from_the_journal")}
      </span>
      <span
        style={{
          marginTop: "8px",
          fontFamily: T.font.sans,
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
          fontSize: "var(--type-body-size)",
          fontWeight: 600,
          color: T.accent.primary,
        }}
      >
        {tPanel("readArticle")}
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
  const tUi = useTranslations("ui")
  const tPanel = useTranslations("authPanel")
  const steps = (["create", "confirm", "profile"] as const).map((key) => ({
    title: tPanel(`${key}Title`),
    body: tPanel(`${key}Body`),
  }))

  return (
    <ol aria-label={tUi("getting_started")} className="grid grid-cols-3 gap-3">
      {steps.map((step, i) => {
        const number = i + 1
        const active = number === activeStep
        const done = number < activeStep

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
                fontSize: "var(--type-body-size)",
                fontWeight: 600,
                ...(active && { background: T.action.primary, color: "#fff" }),
                ...(done && {
                  background: "var(--tint-public-bg)",
                  color: T.accent.ok,
                }),
                ...(!active &&
                  !done && {
                    border: `1px solid ${T.border.hi}`,
                    color: T.ink.dim,
                  }),
              }}
            >
              {done ? (
                <Icon icon="mdi:check" width={18} aria-hidden="true" />
              ) : (
                number
              )}
            </span>
            <div>
              <p
                style={{
                  fontSize: "var(--type-body-size)",
                  fontWeight: 600,
                  color: T.ink.base,
                }}
              >
                {step.title}
                {done && <span className="sr-only"> {tPanel("done")}</span>}
              </p>
              <p
                style={{
                  marginTop: "4px",
                  fontSize: "var(--type-body-small-size)",
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
