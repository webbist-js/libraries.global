export function SectionHeader({
  title,
  summary,
}: {
  readonly title?: string | null
  readonly summary?: string | null
}) {
  if (!title && !summary) {
    return null
  }

  return (
    <div className="mb-8 max-w-[46rem] space-y-3">
      {title ? (
        <h2 className="text-3xl font-semibold tracking-[-0.04em] text-(--t-ink-base) sm:text-4xl">
          {title}
        </h2>
      ) : null}

      {summary ? (
        <p className="text-base leading-7 text-(--t-ink-dim) sm:text-lg">
          {summary}
        </p>
      ) : null}
    </div>
  )
}

SectionHeader.displayName = "SectionHeader"

export default SectionHeader
