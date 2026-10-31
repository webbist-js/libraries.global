import { Icon } from "@iconify/react"

/** Presentation only: permission, visibility, shortcuts and drawer state belong to the owner. */
export function DrawerEdgeTab({
  label,
  accessibleLabel,
  title,
  icon,
  onOpen,
  below = false,
}: {
  readonly label: string
  readonly accessibleLabel: string
  readonly title: string
  readonly icon: string
  readonly onOpen: () => void
  readonly below?: boolean
}) {
  return (
    <button
      type="button"
      aria-label={accessibleLabel}
      title={title}
      onClick={onOpen}
      className="fixed right-0 z-[60] hidden w-11 flex-col items-center gap-2 rounded-l-[20px] border border-r-0 border-(--t-border-line) bg-(--t-bg-deep) pt-2 pb-3 text-(--t-ink-base) transition-colors hover:bg-(--t-bg-surface) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--t-accent-primary) motion-reduce:transition-none lg:flex"
      style={{
        top: below ? "calc(50% + 64px)" : "50%",
        transform: below ? undefined : "translateY(-50%)",
      }}
    >
      <span
        aria-hidden="true"
        className="flex size-8 items-center justify-center rounded-full bg-(--t-accent-chip) text-(--t-accent-primary)"
      >
        <Icon height={17} icon={icon} width={17} />
      </span>
      <span
        aria-hidden="true"
        className="text-sm font-semibold tracking-wide"
        style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
      >
        {label}
      </span>
    </button>
  )
}
