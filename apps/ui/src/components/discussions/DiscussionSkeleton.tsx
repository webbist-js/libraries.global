"use client"

import { useTranslations } from "next-intl"
import type { ReactNode } from "react"

import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/styles"

import { DiscussionReplyBranch } from "./DiscussionReplyBranch"

function LoadingRegion({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  const t = useTranslations("discussions")

  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">{t("loading")}</span>
      <div
        aria-hidden="true"
        className={cn("motion-safe:animate-pulse", className)}
      >
        {children}
      </div>
    </div>
  )
}

function Placeholder({ className }: { className: string }) {
  return (
    <Skeleton
      className={cn(
        "animate-none rounded-full bg-(--t-border-line)",
        className
      )}
    />
  )
}

function AuthorPlaceholder() {
  return (
    <div className="flex items-center gap-3">
      <Placeholder className="size-10 shrink-0" />
      <Placeholder className="h-3 w-28" />
      <Placeholder className="hidden h-3 w-20 sm:block" />
    </div>
  )
}

function TextPlaceholder() {
  return (
    <div className="grid gap-2.5">
      <Placeholder className="h-3 w-full" />
      <Placeholder className="h-3 w-[85%]" />
      <Placeholder className="h-3 w-3/5" />
    </div>
  )
}

function ActionsPlaceholder() {
  return (
    <div className="flex gap-2">
      {[0, 1, 2].map((index) => (
        <Placeholder key={index} className="h-7 w-16" />
      ))}
    </div>
  )
}

function ComposerPlaceholder({ compact = false }: { compact?: boolean }) {
  if (compact)
    return (
      <div className="flex min-h-20 items-center gap-3 rounded-[20px] border border-(--t-border-line) bg-(--t-bg-deep) px-5 py-4">
        <Placeholder className="size-10 shrink-0" />
        <div className="grid gap-2">
          <Placeholder className="h-3 w-40" />
          <Placeholder className="h-3 w-28" />
        </div>
      </div>
    )

  return (
    <div className="grid gap-4 rounded-[24px] border border-(--t-border-line) bg-(--t-bg-deep) p-5 sm:p-6">
      <Placeholder className="h-4 w-44" />
      <Placeholder className="h-[140px] w-full rounded-[16px]" />
      <div className="flex items-center justify-between gap-3">
        <Placeholder className="h-8 w-28" />
        <Placeholder className="h-10 w-36" />
      </div>
    </div>
  )
}

/** Public placeholders contain no account, moderation or previous-query data. */
export function DiscussionListSkeleton({
  variant = "board",
  compact = false,
}: {
  variant?: "board" | "feed" | "picker"
  compact?: boolean
}) {
  return (
    <LoadingRegion className={variant === "board" ? "grid gap-4" : "grid"}>
      {[0, 1, 2].map((index) =>
        variant === "board" ? (
          <div
            key={index}
            className="grid gap-5 rounded-[24px] border border-(--t-border-line) bg-(--t-bg-deep) p-5 sm:p-6"
          >
            <div className="flex gap-2">
              <Placeholder className="h-6 w-24" />
              <Placeholder className="h-6 w-40" />
            </div>
            <Placeholder className="h-8 w-4/5" />
            <TextPlaceholder />
            <AuthorPlaceholder />
          </div>
        ) : (
          <div
            key={index}
            className={cn(
              "flex items-center gap-4",
              variant === "picker"
                ? "mb-2 rounded-xl border border-(--t-border-line) bg-(--t-bg-deep) p-3"
                : "border-b border-(--t-border-line) py-4 last:border-b-0",
              compact && "gap-3"
            )}
          >
            {variant === "feed" && <Placeholder className="size-10 shrink-0" />}
            <div className="grid min-w-0 flex-1 gap-3">
              <Placeholder className="h-4 w-4/5" />
              <Placeholder className="h-3 w-1/2" />
            </div>
            {variant === "feed" && <Placeholder className="h-4 w-8" />}
          </div>
        )
      )}
    </LoadingRegion>
  )
}

export function DiscussionThreadSkeleton({
  embedded = false,
  variant = "default",
}: {
  embedded?: boolean
  variant?: "default" | "suggestion"
}) {
  const suggestion = variant === "suggestion"

  return (
    <LoadingRegion
      className={
        embedded
          ? "grid gap-6"
          : "grid items-start gap-8 text-base [--spacing:0.25rem] lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_320px] xl:gap-10"
      }
    >
      <div className="grid min-w-0 gap-6">
        {!embedded && (
          <div className="grid gap-4 border-b border-(--t-border-line) pb-6">
            <Placeholder className="h-4 w-32" />
            <div className="flex gap-2">
              <Placeholder className="h-6 w-24" />
              <Placeholder className="h-6 w-16" />
            </div>
            <Placeholder className="h-10 w-full sm:h-12" />
            <Placeholder className="h-10 w-2/3 sm:h-12" />
            <div className="mt-2 flex items-center justify-between gap-3">
              <Placeholder className="h-3 w-1/2" />
              <Placeholder className="h-9 w-28" />
            </div>
          </div>
        )}
        {!suggestion && (
          <div className="discussion-message grid gap-4">
            <AuthorPlaceholder />
            <div className="grid gap-4">
              <TextPlaceholder />
              <ActionsPlaceholder />
            </div>
          </div>
        )}
        {[0, 1, 2].map((index) => (
          <DiscussionReplyBranch
            key={index}
            depth={index === 1 ? 1 : 0}
            compact={suggestion}
          >
            <div
              className={
                suggestion
                  ? "grid gap-3 border-b border-(--t-border-line) pb-5"
                  : "discussion-message grid gap-3"
              }
            >
              <AuthorPlaceholder />
              <div className={cn("grid gap-4", suggestion && "pl-[52px]")}>
                <TextPlaceholder />
                {!suggestion && <ActionsPlaceholder />}
              </div>
            </div>
          </DiscussionReplyBranch>
        ))}
        <ComposerPlaceholder compact={!suggestion} />
      </div>
      {!embedded && (
        <div className="hidden gap-4 lg:grid">
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              className="grid gap-4 rounded-[24px] border border-(--t-border-line) bg-(--t-bg-deep) p-5"
            >
              <Placeholder className="h-5 w-2/3" />
              <TextPlaceholder />
            </div>
          ))}
        </div>
      )}
    </LoadingRegion>
  )
}

export function DiscussionComposerSkeleton() {
  return (
    <LoadingRegion>
      <ComposerPlaceholder />
    </LoadingRegion>
  )
}

export function DiscussionReviewSkeleton() {
  return (
    <LoadingRegion className="grid gap-3">
      {[0, 1].map((index) => (
        <div
          key={index}
          className="grid gap-4 rounded-[22px] border border-(--t-edge-warn) bg-(--t-palette-amber-soft) p-5"
        >
          <AuthorPlaceholder />
          <TextPlaceholder />
          <ActionsPlaceholder />
        </div>
      ))}
    </LoadingRegion>
  )
}
