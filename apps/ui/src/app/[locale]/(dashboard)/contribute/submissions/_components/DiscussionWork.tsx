"use client"

import { useQuery } from "@tanstack/react-query"
import { useLocale, useTranslations } from "next-intl"
import { useState } from "react"

import {
  discussionRequest,
  discussionRecordState,
  type DiscussionList,
  type DiscussionRecord,
} from "@/components/discussions/api"
import { useHydratedSession } from "@/lib/access-client"
import { languageName } from "@/lib/locale-fallback"
import { Link } from "@/lib/navigation"

export function DiscussionWork() {
  const p = useTranslations("publishing")
  const discussions = useTranslations("discussions")
  const locale = useLocale()
  const actor = useHydratedSession()
  const userId =
    !actor.isPending && !actor.error ? actor.data?.user?.id : undefined
  const [kind, setKind] = useState<"thread" | "reply">("thread")
  const [state, setState] = useState("")
  const [offset, setOffset] = useState(0)
  const result = useQuery({
    queryKey: ["my-discussion-records", userId ?? null, kind, state, offset],
    enabled: Boolean(userId),
    queryFn: () =>
      userId
        ? discussionRequest<DiscussionList<DiscussionRecord>>(
            `my/records?${new URLSearchParams({ kind, limit: "20", offset: String(offset), ...(state ? { state } : {}) })}`
          )
        : Promise.resolve({ data: [] }),
  })
  const records = userId ? (result.data?.data ?? []) : []

  return (
    <section className="rounded-3xl border bg-(--t-bg-deep) p-6">
      <h2 className="type-h2 mt-0">{p("discussionWork")}</h2>
      <div className="flex flex-wrap gap-3">
        <label>
          {p("recordType")}{" "}
          <select
            value={kind}
            onChange={(event) => {
              setKind(event.target.value === "reply" ? "reply" : "thread")
              setOffset(0)
            }}
            className="rounded-lg border p-2"
          >
            <option value="thread">{p("threads")}</option>
            <option value="reply">{p("replies")}</option>
          </select>
        </label>
        <label>
          {p("status")}{" "}
          <select
            value={state}
            onChange={(event) => {
              setState(event.target.value)
              setOffset(0)
            }}
            className="rounded-lg border p-2"
          >
            <option value="">{p("allWork")}</option>
            <option value="pending">{p("inReview")}</option>
            <option value="visible">{p("accepted")}</option>
            <option value="rejected">{p("notAccepted")}</option>
            <option value="removed">{p("removed")}</option>
          </select>
        </label>
      </div>
      {(actor.isPending || result.isLoading) && (
        <p role="status">{p("loadingWork")}</p>
      )}
      {(actor.error || result.isError) && (
        <p role="alert">
          {p("workFailed")}{" "}
          <button
            type="button"
            className="underline"
            onClick={() => {
              result.refetch()
            }}
          >
            {p("retrySave")}
          </button>
        </p>
      )}
      {!result.isLoading && !result.isError && userId && !records.length && (
        <p>{p("noDiscussionWork")}</p>
      )}
      <ul className="mt-4 grid list-none gap-3 p-0">
        {records.map((record) => (
          <li key={record.id} className="rounded-xl border p-4">
            <p className="mt-0 text-xs text-(--t-ink-dim)">
              {p(kind === "thread" ? "threads" : "replies")} ·{" "}
              {languageName(record.language, [], locale)} ·{" "}
              {discussions(`states.${discussionRecordState(record)}`)}
            </p>
            <h3 className="type-h3 my-2">
              {record.latestRevision?.title ?? record.title ?? p("reply")}
            </h3>
            <p className="line-clamp-3 break-words whitespace-pre-wrap">
              {record.latestRevision?.body ?? record.body}
            </p>
            {record.latestRevision && (
              <p className="text-sm">
                {p("revisionState", {
                  state: discussions(
                    `states.${record.latestRevision.state === "changes_requested" ? "changesRequested" : record.latestRevision.state === "approved" ? "visible" : record.latestRevision.state}`
                  ),
                })}
              </p>
            )}
            {record.latestRevision?.feedback && (
              <p className="rounded-lg bg-(--t-accent-chip) p-3">
                <strong>{p("reviewNote")}</strong>{" "}
                {record.latestRevision.feedback}
              </p>
            )}
            <Link
              href={`/community/discussions/${encodeURIComponent(kind === "thread" ? record.id : (record.threadId ?? record.id))}`}
              className="underline"
            >
              {p("openConversation")}
            </Link>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex justify-between">
        <button
          disabled={!offset}
          onClick={() => setOffset(Math.max(0, offset - 20))}
          className="underline disabled:opacity-40"
        >
          {p("previous")}
        </button>
        {result.data?.nextOffset != null && (
          <button
            onClick={() => setOffset(result.data!.nextOffset!)}
            className="underline"
          >
            {p("next")}
          </button>
        )}
      </div>
    </section>
  )
}
