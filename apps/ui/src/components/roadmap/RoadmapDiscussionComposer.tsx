"use client"

import { DEFAULT_LOCALE } from "@repo/shared-data"
import { useLocale, useTranslations } from "next-intl"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import {
  discussionRequest,
  type DiscussionLanguage,
  type DiscussionList,
  type Subject,
} from "@/components/discussions/api"
import { DiscussionComposerDrawer } from "@/components/discussions/DiscussionComposerDrawer"
import { useDiscussionActor } from "@/components/discussions/useDiscussionActor"
import { roadmapAnchor } from "@/lib/roadmap"

/** Uid of the virtual discussion target for roadmap items (Strapi host config). */
export const ROADMAP_ITEM_TARGET = "api::roadmap.roadmap-item"

async function loadComposer() {
  const [subjects, languages] = await Promise.all([
    discussionRequest<DiscussionList<Subject>>("subjects?limit=50"),
    fetch("/api/relations/locales", { cache: "no-store" })
      .then(async (response) =>
        response.ok
          ? (((await response.json()) as { data?: DiscussionLanguage[] })
              .data ?? [])
          : []
      )
      .catch(() => []),
  ])

  return {
    subject: subjects.data.find((item) => item.slug === "roadmap") ?? null,
    languages: languages.filter(
      (item) => typeof item.code === "string" && typeof item.name === "string"
    ),
  }
}

/**
 * Starts the conversation about a roadmap item in the shared composer
 * drawer. One thread per item key, shared by every language; once it is
 * visible, the item's Discuss button links to the thread page instead.
 */
export function RoadmapDiscussionComposer({
  item,
  onClose,
  onStarted,
}: {
  readonly item: { key: string; title: string } | null
  readonly onClose: () => void
  readonly onStarted: () => void
}) {
  const t = useTranslations("discussions")
  const locale = useLocale()
  const actor = useDiscussionActor()
  const [loaded, setLoaded] = useState<{
    subject: Subject
    languages: DiscussionLanguage[]
  } | null>(null)
  const wanted = item !== null && loaded === null
  useEffect(() => {
    if (!wanted) return
    let current = true
    loadComposer()
      .then((result) => {
        if (!current) return
        if (result.subject) setLoaded({ ...result, subject: result.subject })
        else {
          toast.error(t("unavailable"))
          onClose()
        }
      })
      .catch(() => {
        if (!current) return
        toast.error(t("error"))
        onClose()
      })

    return () => {
      current = false
    }
  }, [wanted, onClose, t])

  if (!item || !loaded || !actor.ready) return null
  const { subject, languages } = loaded
  const anchor = `/community/roadmap#${roadmapAnchor(item.key)}`

  return (
    <DiscussionComposerDrawer
      key={item.key}
      open
      onClose={onClose}
      subject={subject}
      target={{
        uid: ROADMAP_ITEM_TARGET,
        documentId: item.key,
        locale: DEFAULT_LOCALE,
      }}
      contextTitle={item.title}
      initialTitle={t("attachedTitle", { title: item.title })}
      language={locale}
      defaultLanguage={locale}
      compositionPreferences={actor.compositionPreferences}
      languages={languages}
      returnTo={locale === DEFAULT_LOCALE ? anchor : `/${locale}${anchor}`}
      signedIn={actor.signedIn}
      lockLanguage
      disabled={subject.createPolicy === "moderators" && !actor.canModerate}
      onSubmitted={onStarted}
    />
  )
}
