import { T } from "@/lib/design-tokens"

export function EmptyState({ message }: { readonly message: string }) {
  return (
    <div
      style={{ paddingTop: "64px", paddingBottom: "64px", textAlign: "center" }}
    >
      <p
        style={{
          fontFamily: T.font.sans,
          fontSize: "13px",
          color: T.ink.faint,
          margin: 0,
        }}
      >
        {message}
      </p>
    </div>
  )
}
