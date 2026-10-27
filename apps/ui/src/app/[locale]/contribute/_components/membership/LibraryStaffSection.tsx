import { Icon } from "@iconify/react"
import { useTranslations as useUiTranslations } from "next-intl"

import GlobalLink from "@/components/global/GlobalLink"
import { T, TYPE_TINT } from "@/lib/design-tokens"

import { ComingSoonChip } from "./PlanBits"

type StaffBenefit = {
  readonly label: string
  readonly badge?: "mobile" | "soon"
}

function Benefits({ items }: { readonly items: readonly StaffBenefit[] }) {
  const tUi = useUiTranslations("ui")

  return (
    <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
      {items.map((item) => (
        <li
          key={item.label}
          className="flex items-start gap-3 text-sm leading-[1.5]"
        >
          <Icon
            aria-hidden="true"
            className="mt-0.5 shrink-0"
            height={18}
            icon={item.badge === "soon" ? "mdi:clock-outline" : "mdi:check"}
            style={{ color: item.badge === "soon" ? T.ink.dim : T.accent.ok }}
            width={18}
          />
          <span>
            {item.label}
            {item.badge === "mobile" ? (
              <span
                className="ml-1 inline-flex rounded-full px-2 py-px align-[1px] text-xs leading-[1.4] font-semibold whitespace-nowrap"
                style={{
                  background: TYPE_TINT.public.bg,
                  color: TYPE_TINT.public.fg,
                }}
              >
                {tUi("mobile_libraries")}
              </span>
            ) : null}
            {item.badge === "soon" ? (
              <ComingSoonChip label={tUi("soon")} />
            ) : null}
          </span>
        </li>
      ))}
    </ul>
  )
}

export function LibraryStaffSection({
  isStaff,
  compact = false,
}: {
  readonly isStaff: boolean
  readonly compact?: boolean
}) {
  const tUi = useUiTranslations("ui")
  const t = useUiTranslations("membershipStaff")
  const benefits: StaffBenefit[] = ([0, 1, 2, 3, 4] as const).map((index) => ({
    label: t(`benefit${index}`),
    ...(index === 3 ? { badge: "mobile" as const } : {}),
  }))

  if (compact)
    return (
      <section
        aria-labelledby="library-staff-h"
        className="flex flex-col items-start gap-5 rounded-3xl border border-(--t-border-line) bg-(--t-bg-space) p-5 sm:p-7 lg:flex-row lg:items-center lg:justify-between lg:gap-10"
      >
        <div className="max-w-[72ch] min-w-0">
          <p className="m-0 mb-2 text-xs font-semibold text-(--t-accent-primary)">
            {t("eyebrow")} · {tUi("free")}
          </p>
          <h2 id="library-staff-h" className="type-h2 m-0">
            {t.rich("title", {
              em: (chunks) => (
                <em className="text-(--t-accent-primary)">{chunks}</em>
              ),
            })}
          </h2>
          <p className="mt-3 mb-0 text-base leading-relaxed text-(--t-ink-dim)">
            {t("lead")}
          </p>
        </div>
        <GlobalLink
          href={isStaff ? "/staff" : "/contribute/claim"}
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full border border-(--t-border-hi) bg-white px-5 py-3 text-sm font-semibold text-(--t-ink-base) no-underline hover:bg-(--t-bg-surface)"
        >
          {isStaff ? t("openStaff") : t("claim")}
          <Icon aria-hidden icon="mdi:arrow-right" width={17} />
        </GlobalLink>
      </section>
    )

  return (
    <section
      aria-labelledby="library-staff-h"
      className="grid gap-6 rounded-[26px] border p-5 sm:p-7 lg:grid-cols-2 lg:gap-8"
      style={{ background: T.bg.space, borderColor: T.border.line }}
    >
      <div className="flex flex-col items-start gap-4">
        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold">
          {t("eyebrow")}
        </span>
        <h2 id="library-staff-h" className="type-h2 m-0">
          {t.rich("title", {
            em: (chunks) => (
              <em className="text-(--t-accent-primary)">{chunks}</em>
            ),
          })}
        </h2>
        <p className="m-0 text-sm leading-[1.6] text-(--t-ink-dim)">
          {t("lead")}
        </p>
        <ol className="m-0 flex list-none flex-col gap-2 p-0">
          {([0, 1, 2] as const).map((index) => (
            <li key={index} className="flex gap-2 text-sm leading-[1.5]">
              <span
                aria-hidden="true"
                className="mt-px grid size-5 shrink-0 place-items-center rounded-full bg-white text-xs font-bold text-(--t-accent-primary)"
              >
                {index + 1}
              </span>
              <span>
                <strong>{t(`step${index}Title`)}.</strong>{" "}
                <span className="text-(--t-ink-dim)">
                  {t(`step${index}Body`)}
                </span>
              </span>
            </li>
          ))}
        </ol>
        <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2">
          <GlobalLink
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-(--t-accent-primary) px-5 py-2.5 text-sm font-semibold text-white no-underline hover:bg-(--t-accent-primary-hover) focus-visible:outline-2 focus-visible:outline-offset-4"
            href={isStaff ? "/staff" : "/contribute/claim"}
          >
            {isStaff ? t("openStaff") : t("claim")}
          </GlobalLink>
          <a
            href="#plan-team"
            className="inline-flex min-h-11 items-center text-sm font-semibold text-(--t-accent-primary) underline underline-offset-4"
          >
            {t("team")}
          </a>
        </div>
      </div>
      <div className="flex flex-col gap-4 rounded-[20px] border border-(--t-border-line) bg-white p-5">
        <div className="flex justify-between gap-3 text-sm font-bold">
          <h3 className="type-small-heading m-0">{tUi("verified_staff")}</h3>
          <span className="text-(--t-accent-ok)">{tUi("free")}</span>
        </div>
        <p className="m-0 text-sm leading-relaxed text-(--t-ink-dim)">
          {t("eachLibrary")}
        </p>
        <Benefits items={benefits} />
        <GlobalLink
          href="#get-pro-free"
          className="text-sm font-semibold underline"
        >
          {t("proRequest")}
        </GlobalLink>
        <p className="m-0 mt-auto border-t border-(--t-divider) pt-3 text-sm leading-[1.6] text-(--t-ink-dim)">
          {t("endorsement")}
        </p>
      </div>
    </section>
  )
}
