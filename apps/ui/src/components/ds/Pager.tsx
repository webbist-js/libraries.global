import { useTranslations } from "next-intl"

import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"

import { Card } from "./Card"

export function Pager({
  prev,
  next,
}: {
  readonly prev?: { label: string; href: string }
  readonly next?: { label: string; href: string }
}) {
  const t = useTranslations("ui")
  if (!prev && !next) return null

  return (
    <div
      style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}
    >
      {prev ? (
        <GlobalLink href={prev.href} style={{ textDecoration: "none" }}>
          <Card hover style={{ padding: "16px 20px" }}>
            <p
              style={{
                fontFamily: T.font.sans,
                fontSize: "var(--type-body-small-size)",
                fontWeight: 600,
                color: T.ink.dim,
                margin: "0 0 6px",
              }}
            >
              ← {t("previous")}
            </p>
            <p
              style={{
                fontFamily: T.font.sans,
                fontSize: "var(--type-body-small-size)",
                color: T.ink.dim,
                lineHeight: 1.3,
                margin: 0,
              }}
            >
              {prev.label}
            </p>
          </Card>
        </GlobalLink>
      ) : (
        <div />
      )}
      {next ? (
        <GlobalLink href={next.href} style={{ textDecoration: "none" }}>
          <Card hover style={{ padding: "16px 20px", textAlign: "right" }}>
            <p
              style={{
                fontFamily: T.font.sans,
                fontSize: "var(--type-body-small-size)",
                fontWeight: 600,
                color: T.ink.dim,
                margin: "0 0 6px",
              }}
            >
              {t("next")} →
            </p>
            <p
              style={{
                fontFamily: T.font.sans,
                fontSize: "var(--type-body-small-size)",
                color: T.ink.dim,
                lineHeight: 1.3,
                margin: 0,
              }}
            >
              {next.label}
            </p>
          </Card>
        </GlobalLink>
      ) : (
        <div />
      )}
    </div>
  )
}
