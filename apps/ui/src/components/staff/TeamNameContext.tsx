/** A Team's name above a staff page title, in the display serif. */
export function TeamNameContext({ name }: { readonly name: string }) {
  return (
    <span
      className="[overflow-wrap:anywhere] text-(--t-ink-base)"
      style={{
        font: "600 clamp(1.375rem, 2vw, 1.625rem) / 1.2 var(--font-newsreader), Georgia, serif",
      }}
    >
      {name}
    </span>
  )
}
