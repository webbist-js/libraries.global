"use client"

import { Icon } from "@iconify/react"
import { useQuery } from "@tanstack/react-query"
import { useId, useState } from "react"

import { Badge } from "@/components/ds/Badge"
import GlobalLink from "@/components/global/GlobalLink"
import type { StaffLibrarySummary } from "@/lib/access-server"
import { T, TYPE_TINT } from "@/lib/design-tokens"
import { staffLibraryHref } from "@/lib/staff/paths"
import type { StaffOverview } from "@/lib/staff/types"

export type StaffBannerMetrics = {
  suggestions: number | null
  noticesActive: number | null
  completeness: number | null
}

type BannerLibrary = Pick<
  StaffLibrarySummary,
  "id" | "slug" | "name" | "libraryType"
>

function MetricChip({
  value,
  label,
  background,
  color,
}: {
  readonly value: string | number | null
  readonly label: string
  readonly background: string
  readonly color: string
}) {
  return (
    <span
      className="inline-flex min-h-12 items-center gap-2 rounded-[16px] px-3.5 py-2"
      style={{ background }}
    >
      <span
        className="text-[29px] leading-none tabular-nums"
        style={{ fontFamily: T.font.serif, color }}
      >
        {value ?? "—"}
      </span>
      <span className="text-[14px] font-semibold" style={{ color: T.ink.base }}>
        {label}
      </span>
    </span>
  )
}

function ActionCard({
  title,
  description,
  href,
  icon,
  count,
}: {
  readonly title: string
  readonly description: string
  readonly href: string
  readonly icon: string
  readonly count?: number | null
}) {
  return (
    <GlobalLink
      href={href}
      className="group flex h-full flex-col gap-3 rounded-[20px] border border-(--t-border-line) p-5 no-underline transition-colors hover:border-(--t-accent-primary) focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--t-accent-primary) sm:p-6"
      style={{ background: T.bg.deep }}
    >
      <span className="flex items-center justify-between gap-3">
        <span
          className="flex size-11 shrink-0 items-center justify-center rounded-full"
          style={{ background: T.accent.chip, color: T.accent.primary }}
        >
          <Icon aria-hidden="true" icon={icon} width={22} height={22} />
        </span>
        {count != null && count > 0 ? (
          <span
            aria-label={`${count} ${count === 1 ? "suggestion" : "suggestions"} to review`}
            className="flex size-8 items-center justify-center rounded-full text-[15px] font-semibold tabular-nums"
            style={{ background: T.accent.primary, color: "white" }}
          >
            {count}
          </span>
        ) : null}
      </span>
      <span className="flex flex-col gap-1">
        <span
          className="text-[19px] leading-snug font-bold"
          style={{ color: T.ink.base }}
        >
          {title}
        </span>
        <span
          className="text-[15px] leading-[1.5]"
          style={{ color: T.ink.dim }}
        >
          {description}
        </span>
      </span>
    </GlobalLink>
  )
}

/** The hub's staff tools, all scoped to the library selected here. */
export function StaffContributeBanner({
  libraries,
  userId,
  initialMetrics,
}: {
  readonly libraries: readonly BannerLibrary[]
  readonly userId: string
  readonly initialMetrics: StaffBannerMetrics | null
}) {
  const [selectedId, setSelectedId] = useState(libraries[0]?.id ?? "")
  const titleId = useId()
  const selectId = useId()
  const library =
    libraries.find((item) => item.id === selectedId) ?? libraries[0]
  const id = library?.id ?? ""
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["staff-contribute-overview", userId, id],
    enabled: Boolean(id),
    staleTime: 30_000,
    retry: false,
    initialData:
      id === libraries[0]?.id ? (initialMetrics ?? undefined) : undefined,
    queryFn: async ({ signal }): Promise<StaffBannerMetrics> => {
      const response = await fetch(
        `/api/staff/${encodeURIComponent(id)}/overview`,
        {
          cache: "no-store",
          signal,
        }
      )
      if (!response.ok) throw new Error("staff_overview_unavailable")
      const overview = (await response.json()) as StaffOverview

      return {
        suggestions: overview.counts.suggestions,
        noticesActive: overview.counts.noticesActive ?? null,
        completeness: overview.library.completeness ?? null,
      }
    },
  })

  if (!library) return null
  const base = staffLibraryHref(library.slug)
  const suggestions = data?.suggestions ?? null
  const notices = data?.noticesActive ?? null
  const completeness = data?.completeness ?? null

  return (
    <section
      aria-labelledby={titleId}
      className="mb-10 grid gap-7 rounded-[28px] border p-5 sm:p-7 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] xl:gap-8 xl:p-8"
      style={{ background: T.bg.deep, borderColor: T.border.line }}
    >
      <div className="flex min-w-0 flex-col items-start">
        <div className="flex w-full flex-wrap items-center gap-2.5">
          <Badge
            label="Verified staff"
            color="ok"
            icon="mdi:shield-check-outline"
            size="md"
          />
          <label htmlFor={selectId} className="sr-only">
            Library
          </label>
          <span className="relative max-w-full min-w-0">
            <select
              id={selectId}
              className="min-h-11 w-full max-w-[320px] cursor-pointer appearance-none truncate rounded-full border py-2 pr-10 pl-4 text-[15px] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--t-accent-primary)"
              style={{
                background: T.bg.deep,
                borderColor: T.border.hi,
                color: T.ink.base,
              }}
              value={id}
              onChange={(event) => setSelectedId(event.target.value)}
            >
              {libraries.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <Icon
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2"
              icon="mdi:chevron-down"
              width={18}
              height={18}
              style={{ color: T.ink.dim }}
            />
          </span>
        </div>

        <h2
          id={titleId}
          className="m-0 mt-4 text-[clamp(30px,3.2vw,44px)] leading-[1.12] font-medium tracking-[-0.015em] break-words"
          style={{ fontFamily: T.font.serif, color: T.ink.base }}
        >
          Look after{" "}
          <em className="font-normal" style={{ color: T.accent.primary }}>
            {library.name}.
          </em>
        </h2>
        <p
          className="mt-4 mb-0 max-w-[58ch] text-[16px] leading-[1.65]"
          style={{ color: T.ink.dim }}
        >
          Your changes to this record publish straight away. For other
          libraries, you contribute like everyone else, below.
        </p>

        <div
          aria-live="polite"
          aria-busy={isPending}
          className="mt-5 flex flex-wrap gap-2.5"
        >
          <MetricChip
            value={suggestions}
            label={
              suggestions === 1
                ? "suggestion to review"
                : "suggestions to review"
            }
            background={T.accent.chip}
            color={T.accent.primary}
          />
          <MetricChip
            value={notices}
            label={notices === 1 ? "notice live" : "notices live"}
            background={TYPE_TINT.neutral.bg}
            color={T.ink.base}
          />
          <MetricChip
            value={completeness === null ? null : `${completeness}%`}
            label="record complete"
            background={TYPE_TINT.public.bg}
            color={TYPE_TINT.public.fg}
          />
          {isPending ? (
            <span className="sr-only">Loading library summary.</span>
          ) : null}
        </div>
        {isError ? (
          <p
            role="status"
            className="mt-3 mb-0 text-[14px]"
            style={{ color: T.ink.dim }}
          >
            {data
              ? "Couldn’t refresh the summary."
              : "The library summary is unavailable."}{" "}
            <button
              type="button"
              onClick={() => void refetch()}
              className="cursor-pointer font-semibold underline underline-offset-4"
              style={{ color: T.accent.primary }}
            >
              Try again
            </button>
          </p>
        ) : null}

        <p
          className="mt-7 mb-0 flex flex-wrap items-center gap-x-2 gap-y-1 pt-2 text-[14px] xl:mt-auto xl:pt-8"
          style={{ color: T.ink.dim }}
        >
          <Icon
            aria-hidden="true"
            icon="mdi:keyboard-outline"
            width={18}
            height={18}
          />
          <span>Open the staff drawer on any page with</span>
          <span className="inline-flex gap-1.5" aria-label="Alt S">
            {["Alt", "S"].map((key) => (
              <kbd
                key={key}
                className="rounded-md border px-2 py-0.5 text-[13px] font-semibold shadow-[0_1px_0_var(--t-border-hi)]"
                style={{
                  background: T.bg.surface,
                  borderColor: T.border.hi,
                  color: T.ink.base,
                  fontFamily: T.font.sans,
                }}
              >
                {key}
              </kbd>
            ))}
          </span>
        </p>
      </div>

      <div
        className="grid min-w-0 gap-3 rounded-[24px] p-3 sm:grid-cols-2 sm:p-4"
        style={{ background: T.bg.space }}
      >
        <ActionCard
          title="Review suggestions"
          description={
            suggestions === 0
              ? "Nothing waiting for review."
              : "From the community, waiting for you."
          }
          href={`${base}#suggestions`}
          icon="mdi:checkbox-marked-outline"
          count={suggestions}
        />
        <ActionCard
          title="Edit the record"
          description={
            library.libraryType === "Mobile"
              ? "Timetable, contacts, services and photos."
              : "Hours, contacts, services and photos."
          }
          href={`${base}/edit`}
          icon="mdi:pencil-outline"
        />
        <ActionCard
          title="Post a notice"
          description="Closures, changes and news."
          href={`${base}/notices#post-notice`}
          icon="mdi:bell-outline"
        />
        <ActionCard
          title="Open the Staff area"
          description="Everything for this library."
          href={base}
          icon="mdi:arrow-right"
        />
      </div>
    </section>
  )
}
