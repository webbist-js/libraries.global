"use client"

// apps/ui/src/app/[locale]/auth/_components/AuthFormParts.tsx
//
// Shared pieces of the sign-in, register and forgot-password forms.

import { Icon } from "@iconify/react"
import {
  type ButtonHTMLAttributes,
  type CSSProperties,
  type InputHTMLAttributes,
  type ReactNode,
  type Ref,
  useState,
} from "react"

import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"

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

/** aria wiring that ties an input to its FieldError. */
export function fieldA11y(id: string, error?: string) {
  return {
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? `${id}-error` : undefined,
  } as const
}

export function AuthHeading({
  title,
  italic,
  subtitle,
}: {
  title: string
  italic: string
  subtitle: string
}) {
  return (
    <div style={{ textAlign: "center", marginBottom: "28px" }}>
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
        aria-label="Show password"
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

export function AuthPrimaryButton({
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="submit"
      disabled={disabled}
      style={{
        ...pillBase,
        background: T.accent.primary,
        color: "#fff",
        border: "none",
        opacity: disabled ? 0.6 : 1,
        cursor: disabled ? "default" : "pointer",
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
