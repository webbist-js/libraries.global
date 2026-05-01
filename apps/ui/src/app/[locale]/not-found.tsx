import { LinkBreak2Icon } from "@radix-ui/react-icons"
import { getTranslations } from "next-intl/server"

import { Link } from "@/lib/navigation"

export default async function NotFound() {
  const t = await getTranslations("errors.notFound")

  return (
    <div className="flex min-h-[calc(100vh-5rem)] flex-col items-center justify-center gap-2">
      <LinkBreak2Icon className="size-8" />
      <div className="text-center">
        <h2 className="mb-4 text-2xl font-semibold">{t("title")}</h2>
        <p>{t("description")}</p>
      </div>
      <p>{t("solution")}</p>
      <Link
        className="rounded-xl border border-(--t-border-line) bg-(--t-bg-deep) px-4 py-2 text-(--t-ink-base) transition-colors duration-500 hover:bg-(--t-bg-surface)"
        href="/"
      >
        {t("redirect")}
      </Link>
    </div>
  )
}
