"use client"

import { ClipboardPen, LockKeyhole, Pencil } from "lucide-react"
import { useTranslations } from "next-intl"

import { Badge } from "@/components/ds/Badge"
import { primaryCtaSm } from "@/components/ui/action-styles"
import { LIST_TINTS, type PublicSuggestion } from "@/lib/community/suggestions"
import { cn } from "@/lib/styles"

export function SuggestionChangesRequested({
  items,
  onRevise,
}: {
  readonly items: readonly PublicSuggestion[]
  readonly onRevise?: (suggestion: PublicSuggestion) => void
}) {
  const t = useTranslations("optionSuggestions")
  if (!items.length) return null

  return (
    <section
      id="suggestion-changes-requested"
      aria-labelledby="suggestion-changes-heading"
      className="grid gap-5 rounded-[28px] border border-(--t-border-line) bg-(--t-bg-deep) p-5 sm:p-6"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-(--t-palette-amber-soft) text-(--t-palette-amber-fg)"
        >
          <ClipboardPen size={20} />
        </span>
        <div className="grid gap-2">
          <h2
            id="suggestion-changes-heading"
            className="type-h2 m-0 text-(--t-ink-base)"
          >
            {t("yourRejected")}
          </h2>
          <p className="m-0 flex items-center gap-1.5 text-sm leading-relaxed text-(--t-ink-dim)">
            <LockKeyhole size={13} aria-hidden className="shrink-0" />
            {t("rejectionPrivacy")}
          </p>
        </div>
      </div>
      <ul className="m-0 grid list-none gap-3 p-0">
        {items.map((suggestion) => (
          <li
            key={suggestion.documentId}
            className="grid gap-4 rounded-[20px] border border-(--t-edge-warn) bg-(--t-palette-amber-soft) p-4 sm:p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="grid min-w-0 flex-1 basis-48 gap-2">
                <h3 className="type-card-title m-0 break-words text-(--t-ink-base)">
                  {suggestion.name}
                </h3>
                <Badge
                  label={t(`lists.${suggestion.optionKey}`)}
                  color="dim"
                  size="xs"
                  style={{
                    background: LIST_TINTS[suggestion.optionKey].bg,
                    color: LIST_TINTS[suggestion.optionKey].fg,
                    width: "fit-content",
                  }}
                />
              </div>
              <Badge
                label={t("changesRequested")}
                color="warn"
                size="sm"
                icon="mdi:pencil-outline"
              />
            </div>
            {suggestion.decisionNote && (
              <div className="grid gap-1.5 border-l-2 border-(--t-edge-warn) pl-3.5">
                <p className="m-0 text-xs font-bold tracking-[0.04em] text-(--t-palette-amber-fg) uppercase">
                  {t("reviewFeedback")}
                </p>
                <p className="m-0 text-base leading-[1.65] break-words whitespace-pre-wrap text-(--t-ink-dim)">
                  {suggestion.decisionNote}
                </p>
              </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-(--t-edge-warn) pt-4">
              <p className="m-0 max-w-[46ch] text-sm leading-relaxed text-(--t-ink-dim)">
                {t("resubmitHint")}
              </p>
              {onRevise ? (
                <button
                  type="button"
                  onClick={() => onRevise(suggestion)}
                  title={t("reviseNamed", { name: suggestion.name })}
                  className={cn(
                    primaryCtaSm,
                    "min-h-10 shrink-0 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--t-accent-primary)"
                  )}
                >
                  <Pencil size={15} aria-hidden />
                  {t("reviseSuggestion")}
                </button>
              ) : (
                <a
                  href="#suggest-option"
                  title={t("reviseNamed", { name: suggestion.name })}
                  className={cn(
                    primaryCtaSm,
                    "min-h-10 shrink-0 text-sm no-underline"
                  )}
                >
                  <Pencil size={15} aria-hidden />
                  {t("reviseSuggestion")}
                </a>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
