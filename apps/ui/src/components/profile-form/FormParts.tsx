import { Icon } from "@iconify/react"
import { useTranslations as useUiTranslations } from "next-intl"
import type React from "react"

import { Badge } from "@/components/ds"
import { T } from "@/lib/design-tokens"

// The v2 form vocabulary, as on the role application and the Index editor:
// 48px fields with a 14px radius, 15px semibold labels, 14px hints.

export const fieldInput: React.CSSProperties = {
  padding: "12px 16px",
  minHeight: 48,
  borderRadius: 14,
  border: `1px solid ${T.border.hi}`,
  background: T.bg.deep,
  color: T.ink.base,
  fontSize: 16,
  fontFamily: T.font.sans,
  width: "100%",
  boxSizing: "border-box",
}

export const fieldLabel: React.CSSProperties = {
  display: "block",
  margin: "0 0 8px",
  padding: 0,
  fontFamily: T.font.sans,
  fontSize: 15,
  fontWeight: 600,
  color: T.ink.base,
}

export const fieldHint: React.CSSProperties = {
  margin: "6px 0 0",
  fontFamily: T.font.sans,
  fontSize: 14,
  lineHeight: 1.5,
  color: T.ink.dim,
}

/** "Optional" / "Required" after a field's name. */
export function Tag({ children }: { readonly children: React.ReactNode }) {
  return (
    <span className="font-normal" style={{ color: T.ink.dim }}>
      {" "}
      {children}
    </span>
  )
}

/** A native select in the field style, with the v2 chevron. */
export function Select({
  style,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        {...props}
        className="appearance-none"
        style={{
          ...fieldInput,
          paddingRight: 44,
          cursor: "pointer",
          ...style,
        }}
      />
      <Icon
        aria-hidden="true"
        icon="mdi:chevron-down"
        width={18}
        height={18}
        className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2"
        style={{ color: T.ink.dim }}
      />
    </div>
  )
}

/** A white v2 section card: serif title, Required/Optional badge, lead. */
export function SectionCard({
  id,
  title,
  requirement,
  lead,
  children,
}: {
  /**
   * Anchor for the progress list. The heading's id is `${id}-title` and the
   * lead's `${id}-lead`, so a group inside can be named and described by them.
   */
  readonly id: string
  readonly title: string
  /** The badge beside the title; none for a section that always has a value. */
  readonly requirement?: "required" | "optional"
  readonly lead?: React.ReactNode
  readonly children: React.ReactNode
}) {
  const tUi = useUiTranslations("ui")

  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="scroll-mt-24 rounded-[24px] p-6 sm:p-7"
      style={{ background: T.bg.deep, border: `1px solid ${T.border.line}` }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2
          id={`${id}-title`}
          className="m-0"
          style={{
            fontFamily: T.font.serif,
            fontSize: 26,
            fontWeight: 500,
            letterSpacing: "-0.01em",
            color: T.ink.base,
          }}
        >
          {title}
        </h2>
        {requirement === "required" ? (
          <Badge label={tUi("required")} color="aurora" />
        ) : requirement === "optional" ? (
          <Badge label={tUi("optional_59be71")} color="dim" />
        ) : null}
      </div>
      {lead ? (
        <p
          id={`${id}-lead`}
          className="mt-2 mb-0 max-w-[62ch] text-[15px] leading-[1.6]"
          style={{ color: T.ink.dim }}
        >
          {lead}
        </p>
      ) : null}
      <div className="mt-6 flex flex-col gap-6">{children}</div>
    </section>
  )
}
