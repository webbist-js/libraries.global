import { useTranslations } from "next-intl"

/** Members and outstanding invitations consume the same seat allowance. */
export function TeamSeatUsage({
  used,
  total,
}: {
  readonly used: number
  readonly total: number
}) {
  const t = useTranslations("staffWorkspace")

  return (
    <div>
      <p className="m-0 font-semibold text-(--t-ink-base) tabular-nums">
        {t("seatsUsed", { used, total })}
      </p>
      <progress
        aria-label={t("seatsProgress")}
        value={used}
        max={Math.max(1, used, total)}
        className="mt-3 h-2 w-full overflow-hidden rounded-full accent-(--t-accent-primary) [&::-webkit-progress-bar]:bg-(--t-border-line) [&::-webkit-progress-value]:bg-(--t-action-primary)"
      />
    </div>
  )
}
