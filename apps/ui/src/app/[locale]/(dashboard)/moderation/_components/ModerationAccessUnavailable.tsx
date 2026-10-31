import { Icon } from "@iconify/react"
import { useTranslations as useUiTranslations } from "next-intl"

import { Notice } from "@/components/ds"
import { T } from "@/lib/design-tokens"

import { ModerationHero } from "./ModerationHero"

/**
 * Shown when the session's roles couldn't be read (the session-profile
 * bridge timed out or failed), so a Moderation page can't tell whether the
 * viewer may review here. Not a 404: the submission may well exist and the
 * viewer may well be a Moderator. The retry is a plain GET form, so it
 * works before hydration and always re-renders on the server with a fresh
 * bridge call (failures are never cached).
 */
export function ModerationAccessUnavailable({
  title,
  leaf,
  path,
}: {
  /** The page's own hero title, so the shell doesn't change on retry. */
  readonly title: string
  readonly leaf?: string
  /** The page's path, without a locale: where "Try again" goes. */
  readonly path: string
}) {
  const tUi = useUiTranslations("ui")

  return (
    <>
      <ModerationHero title={title} leaf={leaf} />
      <div className="mx-auto w-full max-w-[960px] px-4 pt-8 pb-16 sm:px-8">
        <Notice
          icon="mdi:alert-circle-outline"
          tone="warn"
          title={tUi("couldnt_check_your_access")}
        >
          <p className="m-0" style={{ color: T.ink.base }}>
            Your roles didn’t load in time, so this page can’t tell whether you
            may review here. Nothing was lost. Try again.
          </p>
          <form action={path} method="get" className="m-0 mt-2">
            <button
              type="submit"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full border bg-(--t-bg-deep) px-4 text-sm font-semibold transition-colors hover:bg-(--t-bg-surface)"
              style={{ borderColor: T.border.hi, color: T.ink.base }}
            >
              <Icon
                aria-hidden="true"
                icon="mdi:refresh"
                width={16}
                height={16}
              />
              {tUi("try_again")}{" "}
            </button>
          </form>
        </Notice>
      </div>
    </>
  )
}
