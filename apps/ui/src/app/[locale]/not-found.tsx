import { Compass, Search } from "lucide-react"
import { getLocale, getTranslations } from "next-intl/server"

import { Button } from "@/components/ui/button"
import {
  utilityButtonClass,
  UtilityHeading,
  UtilityLink,
  UtilityPage,
} from "@/components/utility/UtilityPage"
import { T } from "@/lib/design-tokens"
import { routing } from "@/lib/navigation"

export default async function NotFound() {
  const [t, locale] = await Promise.all([
    getTranslations("errors.notFound"),
    getLocale(),
  ])
  const searchPath =
    locale === routing.defaultLocale ? "/libraries" : `/${locale}/libraries`

  return (
    <UtilityPage>
      <UtilityHeading
        title={t("heading")}
        italic={t("headingItalic")}
        description={t("description")}
        icon={<Compass size={28} />}
        tone="neutral"
      />
      <form
        action={searchPath}
        method="get"
        className="flex flex-col gap-3 sm:flex-row sm:items-center"
      >
        <div className="relative min-w-0 flex-1">
          <Search
            aria-hidden="true"
            size={20}
            className="absolute top-1/2 left-4 -translate-y-1/2"
            style={{ color: T.ink.dim }}
          />
          <label className="sr-only" htmlFor="missing-page-search">
            {t("searchLabel")}
          </label>
          <input
            id="missing-page-search"
            type="search"
            name="q"
            placeholder={t("searchLabel")}
            className="h-14 w-full rounded-full border pr-4 pl-12 text-base"
            style={{ borderColor: T.border.hi, background: T.bg.surface }}
            maxLength={200}
          />
        </div>
        <Button type="submit" className={utilityButtonClass}>
          {t("search")}
        </Button>
      </form>
      <nav
        aria-label={t("navigation")}
        className="mt-6 flex flex-wrap gap-x-6 gap-y-3 font-medium"
        style={{ color: T.accent.primary }}
      >
        <UtilityLink href="/" className="underline underline-offset-4">
          {t("homepage")}
        </UtilityLink>
        <UtilityLink href="/libraries" className="underline underline-offset-4">
          {t("libraries")}
        </UtilityLink>
        <UtilityLink href="/journal" className="underline underline-offset-4">
          {t("journal")}
        </UtilityLink>
        <UtilityLink href="/knowledge" className="underline underline-offset-4">
          {t("help")}
        </UtilityLink>
      </nav>
    </UtilityPage>
  )
}
