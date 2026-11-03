import { Icon } from "@iconify/react"
import { useTranslations } from "next-intl"

import { Link } from "@/lib/navigation"

/** Knowledge guides a moderator is most likely to need while reviewing. */
const GUIDES = [
  { key: "howReview", href: "/knowledge/governance/how-review-works" },
  { key: "sources", href: "/knowledge/data-api/sources-and-data-retention" },
  { key: "roles", href: "/knowledge/governance/roles-and-permissions" },
  { key: "eventFeeds", href: "/knowledge/events/reviewing-event-feeds" },
  { key: "board", href: "/knowledge/governance/the-editorial-board" },
] as const

/** Thanks moderators and points them at the guides behind each decision. */
export function ModerationThanks() {
  const t = useTranslations("moderationWorkspace")

  return (
    <div className="flex max-w-[72ch] min-w-0 flex-col gap-3">
      <p className="m-0 text-base leading-relaxed text-(--t-ink-dim)">
        {t("thanks")}
      </p>
      <nav aria-label={t("guidesLabel")}>
        <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
          {GUIDES.map((guide) => (
            <li key={guide.key}>
              <Link
                href={guide.href}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-(--t-border-line) bg-(--t-bg-deep) px-3 text-sm font-semibold text-(--t-ink-base) no-underline hover:bg-(--t-bg-surface) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--t-accent-primary)"
              >
                <Icon aria-hidden icon="mdi:book-open-variant" width={16} />
                {t(`guides.${guide.key}`)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
