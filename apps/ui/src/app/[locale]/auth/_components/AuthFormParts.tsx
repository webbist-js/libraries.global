"use client"

// apps/ui/src/app/[locale]/auth/_components/AuthFormParts.tsx
//
// Shared pieces of the auth forms and their "check your inbox" pages.

import { Icon, loadIcons } from "@iconify/react"
import {
  CircleAlert,
  CircleCheck,
  Clock,
  Link2Off,
  Mail,
  MailWarning,
  UserRound,
} from "lucide-react"
import { useTranslations as useUiTranslations } from "next-intl"
import {
  type ButtonHTMLAttributes,
  type CSSProperties,
  type InputHTMLAttributes,
  type ReactNode,
  type Ref,
  useEffect,
  useState,
} from "react"

import GlobalLink from "@/components/global/GlobalLink"
import { UtilityHeading } from "@/components/utility/UtilityPage"
import { useMounted } from "@/hooks/useMounted"
import { PASSWORD_MIN_LENGTH, SITE_NAME } from "@/lib/constants"
import { T } from "@/lib/design-tokens"
import { passwordStrength } from "@/lib/password-strength"

// No `outline: none` — the global :focus-visible ring must stay visible.
export const authInputStyle: CSSProperties = {
  width: "100%",
  height: "52px",
  padding: "0 16px",
  borderRadius: "14px",
  border: `1px solid ${T.border.hi}`,
  background: T.bg.surface,
  color: T.ink.base,
  fontSize: "16px",
  fontFamily: T.font.sans,
  boxSizing: "border-box",
}

export const authInputClassName =
  "transition-colors placeholder:text-(--t-ink-low) focus:border-(--t-accent-primary) focus:bg-(--t-bg-deep)"

const inlineLinkClassName =
  "font-semibold underline underline-offset-[3px] transition-colors hover:text-(--t-accent-primary-hover)"

/**
 * Fetches icons a page may switch to later, e.g. its "sent" state. Iconify
 * loads each icon on first render, so one that only appears after a state
 * change would show a blank circle first. Pass a module-level array.
 */
export function usePreloadedIcons(icons: readonly string[]) {
  useEffect(() => {
    loadIcons([...icons])
  }, [icons])
}

/** aria wiring that ties an input to its FieldError. */
export function fieldA11y(id: string, error?: string) {
  return {
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? `${id}-error` : undefined,
  } as const
}

// Status icon tints, as in the DS Notice: status is never colour alone.
const HEADING_ICON_TONES = {
  info: { bg: T.accent.chip, fg: T.accent.primary },
  ok: { bg: "var(--tint-public-bg)", fg: T.accent.ok },
  warn: { bg: "#F5EEDC", fg: T.accent.warn },
} as const

const UTILITY_ICONS = {
  "mdi:email-fast-outline": Mail,
  "mdi:email-alert-outline": MailWarning,
  "mdi:clock-alert-outline": Clock,
  "mdi:link-variant-off": Link2Off,
  "mdi:check-circle-outline": CircleCheck,
  "mdi:alert-circle-outline": CircleAlert,
  "mdi:account-question-outline": UserRound,
} as const

export function AuthHeading({
  title,
  italic,
  subtitle,
  icon,
  iconTone = "info",
  layout = "form",
}: {
  title: string
  italic: string
  subtitle: ReactNode
  /** Iconify id for a status page's icon above the title. */
  icon?: string
  iconTone?: keyof typeof HEADING_ICON_TONES
  layout?: "form" | "utility"
}) {
  const UtilityIcon = UTILITY_ICONS[icon as keyof typeof UTILITY_ICONS]
  if (layout === "utility")
    return (
      <UtilityHeading
        title={title}
        italic={italic}
        description={subtitle}
        tone={iconTone}
        icon={
          UtilityIcon ? (
            <UtilityIcon size={30} />
          ) : icon ? (
            <Icon icon={icon} width={30} />
          ) : undefined
        }
      />
    )

  return (
    <div style={{ textAlign: "center", marginBottom: "28px" }}>
      {icon && (
        <div
          aria-hidden="true"
          className="mx-auto mb-6 flex size-16 items-center justify-center"
          style={{
            borderRadius: "999px",
            background: HEADING_ICON_TONES[iconTone].bg,
            color: HEADING_ICON_TONES[iconTone].fg,
          }}
        >
          <Icon icon={icon} width={30} />
        </div>
      )}
      <h1
        style={{
          fontFamily: T.font.serif,
          fontSize: "clamp(2.5rem, 4.2vw, 3.5rem)",
          fontWeight: 500,
          letterSpacing: "-0.025em",
          lineHeight: 1.02,
          color: T.ink.base,
          margin: 0,
        }}
      >
        {title}{" "}
        <em style={{ fontStyle: "italic", fontWeight: 400 }}>{italic}</em>
      </h1>
      <p
        style={{
          marginTop: "14px",
          fontSize: "16px",
          lineHeight: 1.55,
          color: T.ink.dim,
        }}
      >
        {subtitle}
      </p>
    </div>
  )
}

export function AuthField({
  id,
  label,
  hint,
  aside,
  error,
  children,
}: {
  id: string
  label: string
  /** Muted text after the label, e.g. "(shown on your profile)". */
  hint?: string
  /** Right-aligned slot on the label row, e.g. a "Forgot password?" link. */
  aside?: ReactNode
  error?: string
  children: ReactNode
}) {
  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: "12px",
          marginBottom: "8px",
        }}
      >
        <label
          htmlFor={id}
          style={{
            fontFamily: T.font.sans,
            fontSize: "15px",
            fontWeight: 600,
            color: T.ink.base,
          }}
        >
          {label}
          {hint && (
            <span style={{ fontWeight: 400, color: T.ink.dim }}> {hint}</span>
          )}
        </label>
        {aside}
      </div>
      {children}
      <FieldError id={id} message={error} />
    </div>
  )
}

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null

  return (
    <p
      id={`${id}-error`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "6px",
        marginTop: "6px",
        fontSize: "14px",
        color: T.accent.danger,
      }}
    >
      <Icon icon="mdi:alert-circle-outline" width={16} aria-hidden="true" />
      {message}
    </p>
  )
}

export function PasswordInput({
  ref,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  ref?: Ref<HTMLInputElement>
}) {
  const tUi = useUiTranslations("ui")

  const [visible, setVisible] = useState(false)

  return (
    <div style={{ position: "relative" }}>
      <input
        ref={ref}
        type={visible ? "text" : "password"}
        style={{ ...authInputStyle, paddingRight: "56px" }}
        className={authInputClassName}
        {...props}
      />
      <button
        type="button"
        aria-label={tUi("show_password")}
        aria-pressed={visible}
        aria-controls={props.id}
        onClick={() => setVisible((v) => !v)}
        className="absolute top-1/2 right-2 flex size-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-(--t-bg-muted-2)"
        style={{ color: T.ink.dim, borderRadius: "999px" }}
      >
        <Icon
          icon={visible ? "mdi:eye-off-outline" : "mdi:eye-outline"}
          width={20}
          aria-hidden="true"
        />
      </button>
    </div>
  )
}

const pillBase: CSSProperties = {
  width: "100%",
  height: "52px",
  borderRadius: "999px",
  fontFamily: T.font.sans,
  fontSize: "16px",
  fontWeight: 600,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "10px",
  cursor: "pointer",
}

/**
 * The auth forms' submit button. It stays disabled until it has mounted, so a
 * click or Enter before hydration can't submit the form natively.
 */
export function AuthPrimaryButton({
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  const mounted = useMounted()
  const isDisabled = disabled || !mounted

  return (
    <button
      type="submit"
      disabled={isDisabled}
      style={{
        ...pillBase,
        background: T.accent.primary,
        color: "#fff",
        border: "none",
        opacity: isDisabled ? 0.6 : 1,
        cursor: isDisabled ? "default" : "pointer",
      }}
      className="transition-colors enabled:hover:bg-(--t-accent-primary-hover)"
      {...props}
    >
      {children}
    </button>
  )
}

export function AuthSecondaryButton({
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      disabled={disabled}
      style={{
        ...pillBase,
        fontWeight: 500,
        background: T.bg.deep,
        color: T.ink.base,
        border: `1px solid ${T.border.hi}`,
        opacity: disabled ? 0.6 : 1,
        cursor: disabled ? "default" : "pointer",
      }}
      className="transition-colors enabled:hover:bg-(--t-bg-surface)"
      {...props}
    >
      {children}
    </button>
  )
}

/** A primary pill that navigates, for a status page's next step. */
export function AuthPrimaryLink({
  href,
  children,
}: {
  href: string
  children: ReactNode
}) {
  return (
    <GlobalLink
      href={href}
      style={{
        ...pillBase,
        background: T.accent.primary,
        color: "#fff",
        textDecoration: "none",
      }}
      className="transition-colors hover:bg-(--t-accent-primary-hover)"
    >
      {children}
    </GlobalLink>
  )
}

export function AuthCheckbox({
  ref,
  label,
  hint,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  ref?: Ref<HTMLInputElement>
  label: ReactNode
  /** Muted line under the label. */
  hint?: ReactNode
}) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "12px",
        cursor: "pointer",
        fontSize: "15px",
        lineHeight: 1.5,
        color: T.ink.base,
      }}
    >
      <input
        ref={ref}
        type="checkbox"
        style={{
          width: "20px",
          height: "20px",
          marginTop: "1px",
          accentColor: T.accent.primary,
          flexShrink: 0,
        }}
        {...props}
      />
      <span>
        {label}
        {hint && (
          <span
            style={{ display: "block", fontSize: "14px", color: T.ink.dim }}
          >
            {hint}
          </span>
        )}
      </span>
    </label>
  )
}

export type AuthStatus = { tone: "ok" | "error"; text: ReactNode } | null

/**
 * The result of an action on the page, e.g. "New link sent". The region is
 * always rendered, so screen readers announce what appears in it.
 */
export function AuthStatusMessage({ status }: { status: AuthStatus }) {
  return (
    <div role="status">
      {status && (
        <p
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "8px",
            marginTop: "12px",
            fontSize: "15px",
            lineHeight: 1.5,
            color: status.tone === "error" ? T.accent.danger : T.accent.ok,
          }}
        >
          <Icon
            icon={
              status.tone === "error"
                ? "mdi:alert-circle-outline"
                : "mdi:check-circle-outline"
            }
            width={18}
            aria-hidden="true"
            style={{ flexShrink: 0, marginTop: "2px" }}
          />
          <span>{status.text}</span>
        </p>
      )}
    </div>
  )
}

/** Small centred help text, e.g. "Nothing yet? Check your spam folder." */
export function AuthNote({ children }: { children: ReactNode }) {
  return (
    <p
      style={{
        textAlign: "center",
        fontSize: "14px",
        lineHeight: 1.55,
        color: T.ink.dim,
      }}
    >
      {children}
    </p>
  )
}

// Filled-segment colour per score; the label text carries the same meaning.
const STRENGTH_COLOR = [
  T.bg.muted2,
  T.accent.danger,
  T.accent.warn,
  T.accent.ok,
  T.accent.ok,
]

/** Four-segment strength bar and its label, for a new password field. */
export function PasswordStrengthMeter({
  id,
  password,
}: {
  /** For the password input's aria-describedby. */
  id: string
  password: string
}) {
  const { score, label } = passwordStrength(password, PASSWORD_MIN_LENGTH)

  return (
    <div style={{ marginTop: "10px" }}>
      <div aria-hidden="true" className="grid grid-cols-4 gap-1.5">
        {[1, 2, 3, 4].map((segment) => (
          <span
            key={segment}
            style={{
              height: "6px",
              borderRadius: "999px",
              background:
                segment <= score ? STRENGTH_COLOR[score] : T.bg.muted2,
              transition: "background 150ms",
            }}
          />
        ))}
      </div>
      <p
        id={id}
        aria-live="polite"
        style={{
          marginTop: "8px",
          fontSize: "14px",
          lineHeight: 1.5,
          color: T.ink.dim,
        }}
      >
        <strong style={{ fontWeight: 600, color: T.ink.base }}>{label}.</strong>{" "}
        At least {PASSWORD_MIN_LENGTH} characters. A few unrelated words works
        well.
      </p>
    </div>
  )
}

export function AuthDivider() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "16px",
        margin: "24px 0",
      }}
    >
      <span
        aria-hidden="true"
        style={{ flex: 1, height: "1px", background: T.border.line }}
      />
      <span style={{ fontSize: "15px", color: T.ink.dim }}>or</span>
      <span
        aria-hidden="true"
        style={{ flex: 1, height: "1px", background: T.border.line }}
      />
    </div>
  )
}

export function AuthSwitchPrompt({
  prompt,
  linkLabel,
  href,
}: {
  prompt: string
  linkLabel: string
  href: string
}) {
  return (
    <p
      style={{
        textAlign: "center",
        marginTop: "18px",
        fontSize: "16px",
        color: T.ink.dim,
      }}
    >
      {prompt}{" "}
      <GlobalLink
        href={href}
        style={{ color: T.accent.primary }}
        className={inlineLinkClassName}
      >
        {linkLabel}
      </GlobalLink>
    </p>
  )
}

/**
 * The email to look for, drawn like an inbox row: sender, subject and how
 * long the link works, so it's easy to spot (or to search for in spam).
 */
export function AuthInboxHint({
  subject,
  detail,
}: {
  subject: string
  detail: string
}) {
  return (
    <div>
      <p
        style={{
          marginBottom: "8px",
          fontSize: "15px",
          fontWeight: 600,
          color: T.ink.base,
        }}
      >
        Look for this email
      </p>
      <div
        className="flex items-center gap-4 px-4 py-4"
        style={{
          background: T.bg.surface,
          border: `1px solid ${T.border.line}`,
          borderRadius: "16px",
        }}
      >
        <span
          aria-hidden="true"
          className="flex size-11 shrink-0 items-center justify-center"
          style={{
            borderRadius: "999px",
            background: T.accent.chip,
            color: T.accent.primary,
          }}
        >
          <Mail size={22} />
        </span>
        <div className="min-w-0" style={{ lineHeight: 1.45 }}>
          <p style={{ fontSize: "14px", color: T.ink.dim }}>From {SITE_NAME}</p>
          <p
            style={{
              fontSize: "15px",
              fontWeight: 600,
              color: T.ink.base,
              overflowWrap: "anywhere",
            }}
          >
            {subject}
          </p>
          <p style={{ fontSize: "14px", color: T.ink.dim }}>{detail}</p>
        </div>
      </div>
    </div>
  )
}

/** Small indigo link, e.g. "Forgot password?" on a label row. */
export function AuthInlineLink({
  href,
  children,
}: {
  href: string
  children: ReactNode
}) {
  return (
    <GlobalLink
      href={href}
      style={{ color: T.accent.primary, fontSize: "14px" }}
      className={inlineLinkClassName}
    >
      {children}
    </GlobalLink>
  )
}
