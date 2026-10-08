import { Icon } from "@iconify/react"
import type { Locale } from "next-intl"

import { T } from "@/lib/design-tokens"
import { Link } from "@/lib/navigation"

import { knowledgeLink } from "./knowledge-links"

/**
 * A quiet "Learn more: {title}" line pointing at a Knowledge article. A
 * server component: it resolves the slug and renders nothing when the
 * article isn't published, so a staff page never links to a 404.
 */
export async function LearnMoreLink({
  slug,
  locale,
  className = "",
}: {
  readonly slug: string
  readonly locale: Locale
  readonly className?: string
}) {
  const link = await knowledgeLink(slug, locale)
  if (!link) return null

  return (
    <p className={`m-0 text-[14px] ${className}`} style={{ color: T.ink.dim }}>
      Learn more:{" "}
      <Link
        href={link.href}
        className="inline-flex min-h-11 items-center gap-1 font-semibold underline underline-offset-[3px]"
        style={{ color: T.accent.primary }}
      >
        {link.title}
        <Icon
          aria-hidden="true"
          height={14}
          icon="mdi:arrow-right"
          width={14}
        />
      </Link>
    </p>
  )
}
