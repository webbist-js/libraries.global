import { T } from "@/lib/design-tokens"

interface PanelCardProps {
  /** Rendered as "§ NN ·" in the top bar */
  index?: string | number
  /** Uppercase mono label beside the index */
  eyebrow?: string
  /** Serif title — plain portion */
  title: string
  /** Italic suffix appended after title */
  italic?: string
  /** Right-aligned element in the top bar (pill, badge, etc.) */
  action?: React.ReactNode
  /** Content below a dashed divider at the bottom of the card */
  footer?: React.ReactNode
  children: React.ReactNode
  className?: string
}

export function PanelCard({
  index,
  eyebrow,
  title,
  italic,
  action,
  footer,
  children,
  className,
}: PanelCardProps) {
  const indexStr = index != null ? String(index).padStart(2, "0") : null

  const hasTopBar = indexStr || eyebrow || action

  return (
    <div
      className={className}
      style={{
        background: T.bg.deep,
        border: `1px solid ${T.border.line}`,
        borderRadius: "20px",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div style={{ padding: "20px 24px 0" }}>
        {hasTopBar && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "10px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontFamily: T.font.mono,
                fontSize: "10px",
                letterSpacing: ".22em",
                textTransform: "uppercase",
                color: T.ink.faint,
              }}
            >
              {indexStr && <span>§ {indexStr}</span>}
              {indexStr && eyebrow && <span>·</span>}
              {eyebrow && <span>{eyebrow}</span>}
            </div>
            {action}
          </div>
        )}

        <h2
          style={{
            fontFamily: T.font.serif,
            fontSize: "1.4rem",
            fontWeight: 400,
            color: T.ink.base,
            lineHeight: 1.25,
            margin: "0 0 20px",
          }}
        >
          {title}
          {italic && (
            <>
              {" "}
              <em style={{ fontStyle: "italic", color: T.ink.dim }}>
                {italic}
              </em>
            </>
          )}
        </h2>
      </div>

      {/* Body */}
      <div style={{ padding: "0 24px 24px" }}>{children}</div>

      {/* Footer */}
      {footer && (
        <>
          <div
            style={{
              borderTop: `1px dashed ${T.border.line}`,
              margin: "0 24px",
            }}
          />
          <div style={{ padding: "16px 24px" }}>{footer}</div>
        </>
      )}
    </div>
  )
}
