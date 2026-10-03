import { headers } from "next/headers"
import { redirect } from "next/navigation"
import type { Locale } from "next-intl"

import { docsSectionForArticle } from "@/components/docs/docs.config"
import {
  type HeldRoles,
  type LocaleOption,
  RoleApplicationForm,
  type SectionOption,
} from "@/components/contribute/RoleApplicationForm"
import { sessionCapabilities } from "@/lib/access-server"
import { fetchArticleLocales } from "@/lib/article-editor-server"
import { getSessionSSR } from "@/lib/auth-server"
import { T } from "@/lib/design-tokens"
import { fetchOwnProfileSnippet } from "@/lib/own-profile-server"
import {
  acceptedChanges,
  APPLICATION_QUEUES,
  type ApplicationQueue,
  applicationRoleFrom,
  latestApplications,
} from "@/lib/role-application"
import {
  fetchAcceptedCount,
  fetchMySubmissions,
} from "@/lib/role-application-server"
import { privateMetadata } from "@/lib/seo/metadata"
import {
  fetchBlogSections,
  fetchWikiArticle,
  fetchWikiSections,
} from "@/lib/strapi-api/content/server"

import { ContributeSectionHeader } from "../../_components/ContributeSectionHeader"

export const metadata = privateMetadata("Apply for a role")
export const dynamic = "force-dynamic"

/** "Welsh · Cymraeg": the English name, then the language's own name. */
function localeLabel(code: string, fallback: string): string {
  try {
    const english = new Intl.DisplayNames(["en"], { type: "language" }).of(code)
    const own = new Intl.DisplayNames([code], { type: "language" }).of(code)
    if (!english) return fallback
    if (!own || own.toLowerCase() === english.toLowerCase()) return english
    const ownCap = own.charAt(0).toLocaleUpperCase(code) + own.slice(1)

    return `${english} · ${ownCap}`
  } catch {
    return fallback
  }
}

/** Profile languages that are configured locales (exact or base match). */
function profileLocales(
  profileCodes: readonly string[],
  configured: readonly string[]
): string[] {
  const out = new Set<string>()
  for (const raw of profileCodes) {
    const code = raw.toLowerCase()
    const hit =
      configured.find((c) => c.toLowerCase() === code) ??
      configured.find((c) => c.toLowerCase() === code.split("-")[0])
    if (hit) out.add(hit)
  }

  return [...out]
}

/** A Knowledge article's public path, or null when it isn't published. */
async function knowledgeHref(
  slug: string,
  locale: Locale
): Promise<string | null> {
  const res = await fetchWikiArticle(slug, locale)
  const article = res?.data
  if (!article?.slug) return null

  return `/knowledge/${docsSectionForArticle(article)}/${article.slug}`
}

export default async function ApplyForRolePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ role?: string | string[] }>
}) {
  const [{ locale }, { role }, session] = await Promise.all([
    params,
    searchParams,
    getSessionSSR(await headers()),
  ])
  const initialRole = applicationRoleFrom(role)
  if (!session?.user) {
    const back = `/contribute/knowledge/apply${initialRole ? `?role=${initialRole}` : ""}`
    redirect(`/auth/signin?callbackUrl=${encodeURIComponent(back)}`)
  }
  const user = session.user

  const [
    rows,
    acceptedCount,
    locales,
    wikiSections,
    blogSections,
    profile,
    contributingHref,
    reviewHref,
  ] = await Promise.all([
    fetchMySubmissions(user),
    fetchAcceptedCount(user),
    fetchArticleLocales(),
    fetchWikiSections(),
    fetchBlogSections(),
    fetchOwnProfileSnippet(user),
    knowledgeHref("how-to-contribute", locale as Locale),
    knowledgeHref("how-review-works", locale as Locale),
  ])

  // What the session already grants, per role (UI only; Strapi decides).
  const caps = sessionCapabilities(user)
  const held = (l: "all" | ReadonlySet<string>) =>
    l === "all" ? ("all" as const) : [...l]
  const moderatorHeld = Object.fromEntries(
    APPLICATION_QUEUES.map((q) => {
      const scopes = caps.moderation.filter(
        (m) => m.queue === "all" || m.queue === q
      )
      const all = scopes.some((m) => m.locale === null)

      return [
        q,
        all
          ? ("all" as const)
          : scopes.flatMap((m) => (m.locale ? [m.locale] : [])),
      ]
    })
  ) as Record<ApplicationQueue, "all" | string[]>
  const heldRoles: HeldRoles = {
    wiki_editor: held(caps.editorLocales.docs),
    journal_editor: held(caps.editorLocales.journal),
    moderator: moderatorHeld,
  }

  const localeOptions: LocaleOption[] = locales.map((l) => ({
    code: l.code,
    label: localeLabel(l.code, l.name),
  }))
  const toOptions = (
    list: {
      slug?: string | null
      name?: string | null
      label?: string | null
    }[]
  ): SectionOption[] =>
    list.flatMap((s) =>
      s.slug && (s.label || s.name)
        ? [{ slug: s.slug, name: (s.label || s.name) as string }]
        : []
    )
  const accepted = acceptedChanges(rows)
  const username = user.username ?? profile?.username ?? null

  return (
    <div
      className="relative isolate flex min-h-screen w-full flex-col"
      style={{ background: T.bg.void, color: T.ink.base }}
    >
      <ContributeSectionHeader
        back
        compact
        title={
          initialRole === "moderator"
            ? "Apply to *moderate.*"
            : "Apply to be *an editor.*"
        }
        lead={
          initialRole === "moderator"
            ? "Moderators review other people’s changes in a queue and language they choose. The editorial board reads every moderator application."
            : "Editors write, edit and translate Knowledge and Journal articles, and their changes publish straight away. Anyone can still report an issue on a Knowledge page. A moderator reads every application."
        }
      />
      <main className="mx-auto w-full max-w-[1360px] px-4 pt-8 pb-20 sm:px-8">
        <RoleApplicationForm
          acceptedCount={acceptedCount}
          locales={localeOptions}
          initialLocales={profileLocales(
            profile?.languages ?? [],
            locales.map((l) => l.code)
          )}
          initialRole={initialRole ?? "wiki_editor"}
          applications={latestApplications(rows)}
          accepted={accepted.slice(0, 3)}
          acceptedTotal={Math.max(acceptedCount, accepted.length)}
          username={username}
          wikiSections={toOptions(wikiSections.data ?? [])}
          blogSections={toOptions(blogSections.data ?? [])}
          held={heldRoles}
          guidelines={{
            editor: contributingHref ?? "/knowledge/contributing",
            moderator:
              reviewHref ?? contributingHref ?? "/knowledge/contributing",
          }}
        />
      </main>
    </div>
  )
}
