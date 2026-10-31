/** Descriptive event tags shared by the reader and drawer, distinct from event-type status. */
export function EventTags({
  tags,
}: {
  readonly tags?: readonly string[] | null
}) {
  return tags
    ? [...new Set(tags.slice(0, 3))].map((tag) => (
        <span
          key={tag}
          className="max-w-full rounded-full border border-(--t-border-line) px-2 py-0.5 font-mono text-xs tracking-[.14em] wrap-anywhere text-(--t-ink-dim) uppercase"
        >
          {tag}
        </span>
      ))
    : null
}
