"use client"

import { ArrowRight, Plus, Shield } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { useCallback, useEffect, useId, useRef, useState } from "react"

import {
  DiscussionComposerSkeleton,
  DiscussionListSkeleton,
} from "@/components/discussions/DiscussionSkeleton"
import {
  EditorialToolbar,
  EDITORIAL_SUBTLE_PILL,
} from "@/components/ds/EditorialToolbar"
import { SelectField } from "@/components/ds/SelectField"
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { preferredContentLanguage } from "@/lib/content-language"
import { languageName } from "@/lib/locale-fallback"
import { Link } from "@/lib/navigation"
import { cn, primaryCtaSm } from "@/lib/styles"

import {
  discussionRequest,
  discussionHref,
  mergeDiscussionRecords,
  type DiscussionContextFeed,
  type DiscussionRecord,
  type DiscussionTarget,
  type DiscussionList,
  type DiscussionLanguage,
  type Subject,
} from "./api"
import { DiscussionComposer } from "./DiscussionComposer"
import { DiscussionContextActions } from "./DiscussionContextActions"
import { DiscussionFeedItem } from "./DiscussionFeedItem"
import { DiscussionLinkPicker } from "./DiscussionLinkPicker"
import { useDiscussionActor } from "./useDiscussionActor"

type Props = {
  target?: DiscussionTarget
  contextType?: "drives" | "libraries"
  activeOnly?: boolean
  title?: string
  compact?: boolean
  subjectSlug?: "library-life" | "drives"
}

export function DiscussionFeed(props: Props) {
  const actor = useDiscussionActor()
  const key = `${actor.scope}:${JSON.stringify(props.target)}:${props.contextType}:${props.activeOnly}`

  return <DiscussionFeedPanel {...props} key={key} actor={actor} />
}
function DiscussionFeedPanel({
  target,
  contextType,
  activeOnly,
  title,
  compact = false,
  subjectSlug = "library-life",
  actor,
}: Props & { actor: ReturnType<typeof useDiscussionActor> }) {
  const t = useTranslations("discussions"),
    locale = useLocale()
  const [metadata, setMetadata] = useState<DiscussionContextFeed | null>(null)
  const [threads, setThreads] = useState<DiscussionRecord[]>([])
  const [ownPending, setOwnPending] = useState<DiscussionRecord[]>([])
  const [next, setNext] = useState<number | null>(null)
  const [total, setTotal] = useState<number | null>(null)
  const [languages, setLanguages] = useState<DiscussionLanguage[]>([])
  const [selectedLanguage, setSelectedLanguage] = useState<string | null>(null)
  const defaultLanguage = preferredContentLanguage(
    locale,
    actor.compositionPreferences,
    languages.length ? languages.map((item) => item.code) : undefined
  )
  const language = selectedLanguage ?? defaultLanguage
  const [subject, setSubject] = useState<Subject>()
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)
  const [linkOpen, setLinkOpen] = useState(false)
  const [composeOpen, setComposeOpen] = useState(false)
  const [manageOpen, setManageOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [reload, setReload] = useState(0)
  const epoch = useRef(0)
  const toolbarId = useId()
  const contextQuery = new URLSearchParams(
    target
      ? {
          contextUid: target.uid,
          contextId: target.documentId,
          ...(target.locale ? { contextLocale: target.locale } : {}),
        }
      : {
          contextType: contextType ?? "drives",
          ...(activeOnly ? { activeContexts: "1" } : {}),
        }
  ).toString()
  const query = `${contextQuery}&limit=${compact ? 3 : 8}${language ? `&language=${encodeURIComponent(language)}` : ""}`
  useEffect(() => {
    if (!actor.ready) return
    let cancelled = false
    ++epoch.current
    Promise.resolve().then(() => {
      if (!cancelled) {
        setLoading(true)
        setError(false)
        setBusy(false)
        setMetadata(null)
        setOwnPending([])
        setTotal(null)
      }
    })
    Promise.all([
      discussionRequest<DiscussionList<DiscussionRecord>>(`threads?${query}`),
      target
        ? discussionRequest<DiscussionContextFeed>(`context?${contextQuery}`)
        : Promise.resolve(null),
      fetch("/api/relations/locales", { cache: "no-store" })
        .then(async (response) =>
          response.ok ? ((await response.json()).data ?? []) : []
        )
        .catch(() => []),
      target && actor.signedIn
        ? discussionRequest<DiscussionList<DiscussionRecord>>(
            `my/records?${new URLSearchParams({ targetUid: target.uid, targetId: target.documentId, ...(target.locale ? { targetLocale: target.locale } : {}), limit: "50" })}`
          ).catch(() => ({ data: [] }))
        : Promise.resolve({ data: [] }),
    ])
      .then(([result, context, choices, own]) => {
        if (cancelled) return
        setThreads(result.data)
        setNext(result.nextOffset ?? null)
        setTotal(result.total ?? null)
        setMetadata(context)
        setLanguages(choices)
        setOwnPending(
          own.data.filter(
            (thread) =>
              ["pending", "rejected"].includes(thread.state) ||
              thread.pendingRevision
          )
        )
      })
      .catch(() => {
        if (!cancelled) {
          setThreads([])
          setMetadata(null)
          setError(true)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
      ++epoch.current
    }
  }, [actor.ready, query, contextQuery, reload, target])
  useEffect(() => {
    if (!composeOpen || !actor.ready) return
    let cancelled = false
    discussionRequest<DiscussionList<Subject>>("subjects?limit=50")
      .then((result) => {
        if (!cancelled)
          setSubject(result.data.find((item) => item.slug === subjectSlug))
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })

    return () => {
      cancelled = true
    }
  }, [composeOpen, actor.ready, subjectSlug])
  const refresh = useCallback(() => setReload((value) => value + 1), [])
  const enabled = metadata?.enabled ?? !target
  const manage = actor.ready && actor.signedIn && metadata?.canManage
  const managing = Boolean(manage && manageOpen)
  const action = async (operation: () => Promise<unknown>) => {
    setBusy(true)
    try {
      await operation()
      refresh()
    } catch {
      setError(true)
    } finally {
      setBusy(false)
    }
  }
  const browse = `/community/discussions?${new URLSearchParams({ context: contextType ?? (target?.uid === "api::drive.drive" ? "drives" : "libraries"), ...(target ? { entity: target.documentId, ...(target.locale ? { contextLocale: target.locale } : {}) } : {}), ...(selectedLanguage !== null ? { lang: selectedLanguage || "all" } : {}) })}`
  const featuredId = metadata?.links.find(
    (link) => link.state === "visible" && link.featured
  )?.threadId
  const orderedThreads = featuredId
    ? [
        ...threads.filter((thread) => thread.id === featuredId),
        ...threads.filter((thread) => thread.id !== featuredId),
      ]
    : threads
  const pill = cn(EDITORIAL_SUBTLE_PILL, "min-h-11 px-4 text-sm")
  const contextHref = discussionHref(metadata?.projection?.url)
  const returnTo = contextHref?.startsWith("/")
    ? contextHref.split("#")[0]
    : browse
  const lead = t(
    target?.uid === "api::library.library"
      ? "feedLibraryLead"
      : target
        ? "feedDriveLead"
        : "feedDrivesLead"
  )
  if (!actor.ready)
    return (
      <section
        id={target ? "discussion" : undefined}
        aria-label={title ?? t("contextConversations")}
        className={cn(
          "grid gap-5 rounded-[28px] border border-(--t-border-line) bg-(--t-bg-deep)",
          compact ? "p-5" : "p-5 sm:p-7 lg:p-8"
        )}
      >
        <div>
          <h2 className={cn("m-0", compact ? "type-panel-title" : "type-h2")}>
            {title ?? t("contextConversations")}
          </h2>
          <p className="mt-1.5 mb-0 text-base leading-relaxed text-(--t-ink-dim)">
            {lead}
          </p>
        </div>
        <DiscussionListSkeleton variant="feed" compact={compact} />
      </section>
    )
  if (
    target &&
    metadata &&
    !enabled &&
    !manage &&
    !ownPending.length &&
    !metadata.links.some((link) => ["pending", "rejected"].includes(link.state))
  )
    return null

  return (
    <section
      id={target ? "discussion" : undefined}
      aria-label={title ?? t("contextConversations")}
      className={cn(
        "grid gap-5 rounded-[28px] border border-(--t-border-line) bg-(--t-bg-deep)",
        compact ? "p-5" : "p-5 sm:p-7 lg:p-8"
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
        <div>
          <div className="flex items-baseline gap-3">
            <h2 className={cn("m-0", compact ? "type-panel-title" : "type-h2")}>
              {title ?? t("contextConversations")}
            </h2>
            {!loading && !error && enabled && (
              <span className="rounded-full bg-(--t-bg-muted) px-2.5 py-0.5 text-sm font-bold text-(--t-ink-dim)">
                {total ?? threads.length}
                {total === null && next !== null ? "+" : ""}
              </span>
            )}
          </div>
          <p className="mt-1.5 mb-0 text-base leading-relaxed text-(--t-ink-dim)">
            {lead}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!compact && enabled && (
            <SelectField
              label={t("language")}
              value={language}
              onValueChange={setSelectedLanguage}
              className="w-auto min-w-[150px] rounded-full border-(--t-border-hi) px-4 text-sm font-semibold"
              options={[
                { value: "", label: t("allLanguages") },
                ...[
                  ...new Set([...languages.map((item) => item.code), language]),
                ]
                  .filter(Boolean)
                  .map((code) => ({
                    value: code,
                    label: languageName(code, languages, locale),
                  })),
              ]}
            />
          )}
          {manage && (
            <button
              type="button"
              aria-expanded={managing}
              aria-controls={managing ? toolbarId : undefined}
              className={cn(
                pill,
                managing
                  ? "border-[#19172c] bg-[#19172c] text-white hover:bg-[#19172c]/90"
                  : "border-dashed"
              )}
              onClick={() => setManageOpen((value) => !value)}
            >
              <Shield size={16} aria-hidden />
              {t(managing ? "feedDone" : "feedManage")}
            </button>
          )}
          {target &&
            enabled &&
            !loading &&
            !error &&
            (actor.signedIn ? (
              <button
                type="button"
                onClick={() => setComposeOpen(true)}
                className={cn(primaryCtaSm, "min-h-11 cursor-pointer")}
              >
                <Plus size={17} aria-hidden />
                {t("newThread")}
              </button>
            ) : (
              <Link
                href={`/auth/signin?callbackUrl=${encodeURIComponent(`${returnTo}#discussion`)}`}
                className={cn(primaryCtaSm, "min-h-11 no-underline")}
              >
                <Plus size={17} aria-hidden />
                {t("newThread")}
              </Link>
            ))}
        </div>
      </div>
      {managing && (
        <div id={toolbarId}>
          <EditorialToolbar
            variant="subtle"
            inlineDescription
            label={t("feedManageHeading")}
            description={t("feedManageLead")}
            className="py-3.5 [&_h2]:[font:var(--type-small-heading)] [&>div:first-child]:gap-x-1 [&>div:first-child]:text-sm"
            actions={
              <>
                {enabled && (
                  <button
                    type="button"
                    disabled={busy}
                    className={pill}
                    onClick={() => setLinkOpen(true)}
                  >
                    {t("linkConversation")}
                  </button>
                )}
                <button
                  type="button"
                  disabled={busy}
                  className={pill}
                  onClick={() =>
                    action(() =>
                      discussionRequest("context", "PUT", {
                        target,
                        enabled: !enabled,
                        baseVersion: metadata!.version,
                      })
                    )
                  }
                >
                  {t(enabled ? "disableFeed" : "enableFeed")}
                </button>
              </>
            }
          />
        </div>
      )}
      {error ? (
        <p role="alert">
          {t("error")}{" "}
          <button type="button" className="underline" onClick={refresh}>
            {t("retry")}
          </button>
        </p>
      ) : loading ? (
        <DiscussionListSkeleton variant="feed" compact={compact} />
      ) : enabled ? (
        <>
          <ul className="m-0 list-none p-0">
            {orderedThreads.map((thread, index) => {
              const featured = thread.id === featuredId && !compact
              const editableLinks = managing
                ? (metadata?.links.filter(
                    (link) =>
                      link.threadId === thread.id &&
                      link.state === "visible" &&
                      link.canManage
                  ) ?? [])
                : []

              return (
                <li
                  key={thread.id}
                  className={cn(
                    featured ? "mb-5" : "border-t border-(--t-border-line)",
                    index === 0 && !featured && "border-t-0"
                  )}
                >
                  <DiscussionFeedItem
                    thread={thread}
                    featured={featured}
                    compact={compact}
                    contextLabel={
                      !target
                        ? thread.contexts
                            ?.filter(
                              (link) =>
                                link.target.uid ===
                                  (contextType === "libraries"
                                    ? "api::library.library"
                                    : "api::drive.drive") &&
                                (!activeOnly || link.active)
                            )
                            .map((link) => link.title)
                            .join(" · ")
                        : undefined
                    }
                    actions={
                      editableLinks.length
                        ? editableLinks.map((link) => (
                            <DiscussionContextActions
                              key={`${link.id}:${link.version}`}
                              link={link}
                              size={compact ? "sm" : "md"}
                              onChanged={refresh}
                            />
                          ))
                        : undefined
                    }
                  />
                </li>
              )
            })}
          </ul>
          {!threads.length && (
            <p className="m-0 text-sm text-(--t-ink-dim)">
              {t("noContextConversations")}
            </p>
          )}
          {next !== null && !compact && (
            <button
              type="button"
              disabled={busy}
              className="justify-self-start text-sm font-semibold underline"
              onClick={async () => {
                const generation = epoch.current
                setBusy(true)
                try {
                  const result = await discussionRequest<
                    DiscussionList<DiscussionRecord>
                  >(`threads?${query}&offset=${next}`)
                  if (generation !== epoch.current) return
                  setThreads((previous) =>
                    mergeDiscussionRecords(previous, result.data)
                  )
                  setNext(result.nextOffset ?? null)
                  setTotal(result.total ?? null)
                } catch {
                  if (generation === epoch.current) setError(true)
                } finally {
                  if (generation === epoch.current) setBusy(false)
                }
              }}
            >
              {t("loadMore")}
            </button>
          )}
          <div
            className={cn(
              "flex flex-wrap items-center justify-between gap-3 border-t border-(--t-border-line) pt-3 text-sm",
              compact && "flex-col items-stretch text-base"
            )}
          >
            <p className="m-0 text-(--t-ink-dim)">{t("feedModerationLead")}</p>
            <Link
              href={browse}
              className={cn(
                "inline-flex items-center gap-1.5 font-semibold text-(--t-accent-primary) underline underline-offset-4",
                compact && "min-h-12 border-t border-(--t-border-line) py-3"
              )}
            >
              {t("viewContextConversations")}
              <ArrowRight size={17} aria-hidden />
            </Link>
            {target && !manage && metadata?.canPropose && (
              <button
                type="button"
                onClick={() => setLinkOpen(true)}
                className="text-(--t-accent-primary)"
              >
                {t("proposeContextLink")}
              </button>
            )}
          </div>
        </>
      ) : (
        <p className="m-0 text-sm text-(--t-ink-dim)">{t("feedDisabled")}</p>
      )}
      {metadata?.links
        .filter((link) => link.state === "pending")
        .map((link) => (
          <div
            key={`${link.id}:${link.version}`}
            className="grid gap-2 rounded-xl border border-(--t-palette-amber-bg) bg-[#fffcf2] p-3"
          >
            <p className="m-0 text-sm font-semibold">
              {t("pendingContextLink")} · {link.thread?.title}
            </p>
            {managing && (
              <DiscussionContextActions link={link} onChanged={refresh} />
            )}
          </div>
        ))}
      {ownPending.map((thread) => (
        <p
          key={thread.id}
          role="status"
          className="m-0 rounded-xl border border-(--t-palette-amber-bg) bg-[#fffcf2] p-3 text-sm"
        >
          <Link
            href={`/community/discussions/${encodeURIComponent(thread.id)}`}
            className="font-semibold underline"
          >
            {thread.pendingRevision?.title ?? thread.title ?? t("newThread")}
          </Link>{" "}
          ·{" "}
          {t(
            thread.pendingRevision
              ? "states.pending"
              : thread.state === "rejected"
                ? "states.rejected"
                : "states.pending"
          )}
        </p>
      ))}
      {metadata?.links
        .filter((link) => link.state === "rejected")
        .map((link) => (
          <p key={link.id} className="m-0 rounded-xl bg-[#fffcf2] p-3 text-sm">
            {link.thread?.title} · {link.feedback}
          </p>
        ))}
      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent>
          <DialogTitle className="type-h2">{t("linkConversation")}</DialogTitle>
          <DialogDescription>{t("linkConversationLead")}</DialogDescription>
          {linkOpen && (
            <DiscussionLinkPicker
              defaultLanguage={defaultLanguage}
              selected={metadata?.links
                .filter((link) => ["visible", "pending"].includes(link.state))
                .map((link) => link.threadId)}
              disabled={busy}
              onSelect={(thread) =>
                action(async () => {
                  await discussionRequest("context-links", "POST", {
                    target,
                    threadId: thread.id,
                  })
                  setLinkOpen(false)
                })
              }
            />
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogTitle className="type-h2">{t("newThread")}</DialogTitle>
          <DialogDescription>{t("reviewLead")}</DialogDescription>
          {subject ? (
            <DiscussionComposer
              subject={subject}
              target={target}
              lockLanguage={false}
              defaultLanguage={locale}
              compositionPreferences={actor.compositionPreferences}
              languages={languages}
              signedIn={actor.signedIn}
              onSubmitted={() => {
                setComposeOpen(false)
                refresh()
              }}
            />
          ) : (
            <DiscussionComposerSkeleton />
          )}
        </DialogContent>
      </Dialog>
    </section>
  )
}
