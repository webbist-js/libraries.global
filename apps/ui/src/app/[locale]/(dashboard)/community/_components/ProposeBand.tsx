import { Icon } from "@iconify/react"
import { useTranslations } from "next-intl"

import { parseHeroText } from "@/components/ds"
import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"

import { proposeActionHref } from "./NoticeboardHeroActions"

const PILL =
  "inline-flex min-h-11 items-center gap-1.5 rounded-full px-[22px] py-3 text-base font-semibold no-underline transition-colors"

/**
 * The Noticeboard's last card (spec §5.5): "Spotted a gap? Propose a
 * drive.", the three rules every drive keeps, and the way in. Board
 * members see "New drive" in place of "Propose a drive". "How drives work"
 * shows only while its Knowledge article is published.
 */
export function ProposeBand({
  board,
  signedIn,
  howHref,
}: {
  readonly board: boolean
  readonly signedIn: boolean
  readonly howHref: string | null
}) {
  const tStatic = useTranslations("staticUi")

  const RULES = [
    {
      icon: "mdi:target",
      title: tStatic("communityRoute.one_focus_per_drive"),
      text: tStatic(
        "communityRoute.one_kind_of_gap_such_as_opening_hours_filled_from_one_small_panel"
      ),
    },
    {
      icon: "mdi:flag-checkered",
      title: tStatic("communityRoute.a_finish_line_and_an_end_date"),
      text: tStatic(
        "communityRoute.at_most_2_000_libraries_to_do_and_no_more_than_90_days"
      ),
    },
    {
      icon: "mdi:book-open-variant-outline",
      title: tStatic("communityRoute.openly_licensed_sources"),
      text: tStatic(
        "communityRoute.facts_from_a_library_s_own_website_are_fine_data_copied_from_map_services_isn_t"
      ),
    },
  ] as const

  const tExisting = useTranslations()

  const tUi = useTranslations("ui")

  return (
    <section
      aria-labelledby="propose-heading"
      className="flex flex-col gap-5"
      style={{
        background: T.bg.deep,
        border: `1px solid ${T.border.line}`,
        borderRadius: 28,
        padding: "clamp(22px,3vw,36px)",
      }}
    >
      <h2
        id="propose-heading"
        className="type-h2 m-0"
        style={{
          color: T.ink.base,
        }}
      >
        {parseHeroText("Spotted a gap? *Propose a drive.*")}
      </h2>

      <ul
        aria-label={tUi("rules_for_a_drive")}
        className="m-0 grid list-none gap-3 p-0"
        style={{
          gridTemplateColumns:
            "repeat(auto-fill, minmax(min(100%, 220px), 1fr))",
        }}
      >
        {RULES.map((rule) => (
          <li
            key={rule.title}
            className="flex items-start gap-3"
            style={{
              padding: "16px 18px",
              background: T.bg.surface,
              border: `1px solid ${T.border.divider}`,
              borderRadius: 20,
            }}
          >
            <span
              aria-hidden="true"
              className="flex size-9 shrink-0 items-center justify-center rounded-full"
              style={{ background: T.accent.chip, color: T.accent.primary }}
            >
              <Icon icon={rule.icon} width={18} height={18} />
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <strong className="text-base" style={{ color: T.ink.base }}>
                {rule.title}
              </strong>
              <span
                className="text-base leading-[1.45]"
                style={{ color: T.ink.dim }}
              >
                {rule.text}
              </span>
            </span>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap gap-2.5">
        <GlobalLink
          href={proposeActionHref(board, signedIn)}
          className={`${PILL} bg-(--t-action-primary) text-white hover:bg-(--t-action-primary-hover)`}
        >
          <Icon
            aria-hidden="true"
            icon={board ? "mdi:plus" : "mdi:pin-outline"}
            width={18}
          />
          {board ? tUi("new_drive") : tExisting("dashboard.proposeDrive")}
        </GlobalLink>
        {howHref ? (
          <GlobalLink
            href={howHref}
            className={`${PILL} border border-(--t-border-hi) bg-(--t-bg-deep) hover:border-(--t-accent-primary)`}
            style={{ color: T.ink.base }}
          >
            {tExisting("homepageContribute.howDrivesWork")}
          </GlobalLink>
        ) : null}
      </div>
    </section>
  )
}
