"use client"

import { useLocale, useTranslations } from "next-intl"
import { useEffect, useRef, useState } from "react"

import {
  discussionRequest,
  type DiscussionContextFeed,
  type DiscussionLanguage,
} from "@/components/discussions/api"
import { DiscussionLinkPicker } from "@/components/discussions/DiscussionLinkPicker"
import { useDiscussionActor } from "@/components/discussions/useDiscussionActor"
import { SelectField } from "@/components/ds/SelectField"
import { compositionLanguage } from "@/lib/composition-language"
import { preferredContentLanguage } from "@/lib/content-language"

export type DriveDiscussionSetup = {
  enabled: boolean
  threadIds: string[]
  baseVersion?: number
  featuredThreadId?: string
  start?: { title: string; body: string; language: string }
}

export function DriveDiscussionOptions({
  driveId,
  value,
  onChange,
  proposing = false,
  disabled = false,
}: {
  driveId?: string
  value?: DriveDiscussionSetup
  onChange: (value: DriveDiscussionSetup) => void
  proposing?: boolean
  disabled?: boolean
}) {
  const actor = useDiscussionActor()

  return (
    <DriveDiscussionOptionsPanel
      key={`${actor.scope}:${driveId ?? "new"}`}
      driveId={driveId}
      value={value}
      onChange={onChange}
      proposing={proposing}
      disabled={disabled}
      actor={actor}
    />
  )
}
function DriveDiscussionOptionsPanel({
  driveId,
  value,
  onChange,
  proposing,
  disabled,
  actor,
}: {
  driveId?: string
  value?: DriveDiscussionSetup
  onChange: (value: DriveDiscussionSetup) => void
  proposing: boolean
  disabled: boolean
  actor: ReturnType<typeof useDiscussionActor>
}) {
  const t = useTranslations("discussions"),
    locale = useLocale()
  const [loaded, setLoaded] = useState(!driveId)
  const [failed, setFailed] = useState(false)
  const [labels, setLabels] = useState<Record<string, string>>({})
  const [languages, setLanguages] = useState<DiscussionLanguage[]>([])
  const start = Boolean(value?.start)
  const [retry, setRetry] = useState(0)
  const hydrated = useRef(false)
  useEffect(() => {
    if (!actor.ready) return
    let cancelled = false
    if (driveId && !hydrated.current)
      discussionRequest<DiscussionContextFeed>(
        `context?${new URLSearchParams({ contextUid: "api::drive.drive", contextId: driveId, contextLocale: locale })}`
      )
        .then((meta) => {
          if (cancelled) return
          if (!value)
            onChange({
              enabled: meta.enabled,
              threadIds: meta.links
                .filter((link) => link.state === "visible")
                .map((link) => link.threadId),
              baseVersion: meta.version,
              featuredThreadId: meta.links.find((link) => link.featured)
                ?.threadId,
            })
          setLabels(
            Object.fromEntries(
              meta.links.map((link) => [
                link.threadId,
                link.thread?.title ?? t("selectedContext"),
              ])
            )
          )
          setLoaded(true)
          setFailed(false)
          hydrated.current = true
        })
        .catch(() => {
          if (!cancelled) setFailed(true)
        })
    fetch("/api/relations/locales", { cache: "no-store" })
      .then(async (response) =>
        response.ok ? ((await response.json()).data ?? []) : []
      )
      .then((choices) => {
        if (!cancelled) setLanguages(choices)
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
    // A freshly mounted account loads once; user edits must not trigger hydration.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actor.ready, driveId, locale, retry])
  const current = value ?? { enabled: false, threadIds: [] }
  const language =
    current.start?.language ??
    compositionLanguage({
      preferences: actor.compositionPreferences,
      available: languages.map((item) => item.code),
      fallback: locale,
    })
  const changeStart = (
    change: Partial<NonNullable<DriveDiscussionSetup["start"]>>
  ) =>
    onChange({
      ...current,
      start: {
        title: current.start?.title ?? "",
        body: current.start?.body ?? "",
        language,
        ...change,
      },
    })
  if (failed)
    return (
      <p role="alert">
        {t("error")}{" "}
        <button
          type="button"
          className="underline"
          onClick={() => {
            setFailed(false)
            setRetry((count) => count + 1)
          }}
        >
          {t("retry")}
        </button>
      </p>
    )
  if (!loaded || !actor.ready) return <p role="status">{t("loading")}</p>

  return (
    <div className="grid gap-3">
      <SelectField
        label={t("driveConversations")}
        value={current.enabled ? "on" : "off"}
        disabled={disabled}
        onValueChange={(choice) =>
          onChange({ ...current, enabled: choice === "on" })
        }
        options={[
          { value: "off", label: t("feedOff") },
          { value: "on", label: t(proposing ? "requestFeed" : "enableFeed") },
        ]}
      />
      {current.enabled && (
        <>
          <p className="m-0 text-sm text-(--t-ink-dim)">
            {t("linkConversationLead")}
          </p>
          <ul className="m-0 grid list-none gap-2 p-0">
            {current.threadIds.map((id) => (
              <li
                key={id}
                className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm"
              >
                <span>{labels[id] ?? t("linked")}</span>
                <button
                  type="button"
                  disabled={disabled}
                  className="font-semibold text-(--t-palette-coral-fg)"
                  onClick={() =>
                    onChange({
                      ...current,
                      threadIds: current.threadIds.filter(
                        (item) => item !== id
                      ),
                      featuredThreadId:
                        current.featuredThreadId === id
                          ? undefined
                          : current.featuredThreadId,
                    })
                  }
                >
                  {t("unlinkConversation")}
                </button>
              </li>
            ))}
          </ul>
          {current.threadIds.length > 0 && (
            <SelectField
              label={t("featuredConversation")}
              value={current.featuredThreadId ?? ""}
              disabled={disabled}
              onValueChange={(featuredThreadId) =>
                onChange({ ...current, featuredThreadId })
              }
              options={[
                { value: "", label: t("noFeaturedConversation") },
                ...current.threadIds.map((id) => ({
                  value: id,
                  label: labels[id] ?? t("linked"),
                })),
              ]}
            />
          )}
          <DiscussionLinkPicker
            defaultLanguage={preferredContentLanguage(
              locale,
              actor.compositionPreferences,
              languages.length ? languages.map((item) => item.code) : undefined
            )}
            selected={current.threadIds}
            disabled={disabled || current.threadIds.length >= 10}
            onSelect={(thread) => {
              setLabels((before) => ({
                ...before,
                [thread.id]: thread.title ?? t("linked"),
              }))
              onChange({
                ...current,
                threadIds: [...current.threadIds, thread.id],
              })
            }}
          />
          {!proposing && (
            <>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={start}
                  disabled={disabled}
                  onChange={(event) => {
                    onChange({
                      ...current,
                      start: event.target.checked
                        ? { title: "", body: "", language }
                        : undefined,
                    })
                  }}
                />
                {t("startDriveConversation")}
              </label>
              {start && (
                <div className="grid gap-3">
                  <label className="text-sm">
                    {t("threadTitle")}
                    <input
                      required={start}
                      disabled={disabled}
                      value={current.start?.title ?? ""}
                      onChange={(event) =>
                        changeStart({ title: event.target.value })
                      }
                      maxLength={250}
                      className="mt-1 block w-full rounded-xl border p-3"
                    />
                  </label>
                  <label className="text-sm">
                    {t("body")}
                    <textarea
                      required={start}
                      disabled={disabled}
                      value={current.start?.body ?? ""}
                      onChange={(event) =>
                        changeStart({ body: event.target.value })
                      }
                      maxLength={20000}
                      rows={4}
                      className="mt-1 block w-full rounded-xl border p-3"
                    />
                  </label>
                  <SelectField
                    label={t("language")}
                    value={language}
                    disabled={disabled}
                    onValueChange={(language) => changeStart({ language })}
                    options={languages.map((item) => ({
                      value: item.code,
                      label: item.name,
                    }))}
                  />
                  <p className="text-xs text-(--t-ink-dim)">
                    {t("reviewLead")}
                  </p>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
