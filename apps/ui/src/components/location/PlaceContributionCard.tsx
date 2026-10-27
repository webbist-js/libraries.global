"use client"

import { Icon } from "@iconify/react"
import { useId, useState } from "react"

import GlobalLink from "@/components/global/GlobalLink"
import { useMounted } from "@/hooks/useMounted"
import { authClient } from "@/lib/auth-client"
import type { ContributionPlace } from "@/lib/contribution-place"
import { T } from "@/lib/design-tokens"

import {
  aggregateContributionGaps,
  contributionRequirement,
  type ContributionChild,
  type ContributionTask,
  featuredPlaceTask,
  GAP_TASKS,
  gapLibrariesHref,
  type PlaceContributionDrive,
} from "./place-contribution.logic"
import type { PlaceGapInsight } from "./PlaceInsights"

const LINK =
  "inline-flex min-h-[44px] items-center rounded-md text-sm font-semibold underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--t-accent-primary)"
const TINTS: Record<string, { bg: string; fg: string }> = {
  indigo: { bg: "var(--t-accent-chip)", fg: T.accent.primary },
  green: { bg: "#E6F3EE", fg: "#287456" },
  rust: { bg: "#FAEFE4", fg: "#B75A27" },
}

export function PlaceContributionCard({
  name,
  level,
  place,
  childPlaces,
  siblings = [],
  initialChildSlug,
  childNoun,
  gaps,
  drive,
  task,
}: {
  readonly name: string
  readonly level: "continent" | "country" | "region"
  readonly place: ContributionPlace
  readonly childPlaces: readonly ContributionChild[]
  readonly siblings?: readonly ContributionChild[]
  readonly initialChildSlug?: string
  readonly childNoun: string
  readonly gaps?: readonly PlaceGapInsight[] | null
  readonly drive?: PlaceContributionDrive
  readonly task?: ContributionTask | null
}) {
  const id = useId()
  const { data: session } = authClient.useSession()
  const mounted = useMounted()
  const signedIn = mounted && Boolean(session?.user)
  const [chosenSlug, setChosenSlug] = useState(initialChildSlug ?? "")
  const [siblingSlug, setSiblingSlug] = useState("")
  const [choosing, setChoosing] = useState(false)
  const child = childPlaces.find((row) => row.slug === chosenSlug)
  const sibling = siblings.find((row) => row.slug === siblingSlug)
  const totals = aggregateContributionGaps(gaps)
  const childLevel =
    level === "continent" ? "country" : level === "country" ? "region" : "area"
  const baseAsk = featuredPlaceTask({
    name,
    place,
    child: drive && sibling ? sibling : child,
    childLevel: drive && level === "region" ? "region" : childLevel,
    drive,
    gaps: totals,
    task,
  })
  const primaryGap = baseAsk.kind === "gap" ? baseAsk.gapKeys[0] : undefined
  const siblingTask =
    sibling && primaryGap
      ? {
          title: `${GAP_TASKS[primaryGap]!.title} for libraries in ${sibling.name}.`,
          description: `Choose a library you know in ${sibling.name} and help add this detail with a current source.`,
          label: GAP_TASKS[primaryGap]!.find,
          href: gapLibrariesHref(
            { ...place, region: sibling.slug },
            primaryGap
          ),
        }
      : null
  const ask = siblingTask
    ? {
        ...baseAsk,
        ...siblingTask,
        context: `Opens libraries in ${sibling!.name} ${GAP_TASKS[primaryGap!]!.need}. Pick one, then add what you know.`,
      }
    : baseAsk
  const alternatives = ["hours", "accessibility", "photo"]
    .filter((key) => !baseAsk.gapKeys.includes(key))
    .filter((key) => {
      const total = totals.find((row) => row.key === key)

      if (gaps?.length === 0) return false
      if (gaps?.every((row) => row.type === "Digital") && key !== "photo")
        return false

      return !total || (total.missing > 0 && total.eligible > 0)
    })
  const choices = (level === "region" ? siblings : childPlaces).filter(
    (row) => !drive || row.libraryCount !== 0
  )
  const canChoose =
    level === "region"
      ? Boolean((primaryGap || drive) && choices.length > 1)
      : choices.length > (drive ? 0 : 1)
  const chooserNoun = level === "region" ? "region" : childNoun
  const requirement = contributionRequirement(ask.kind, primaryGap)

  return (
    <section
      aria-labelledby={`${id}-title`}
      className={`grid gap-8 rounded-[28px] border p-5 sm:p-8 ${alternatives.length ? "lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:gap-10" : ""}`}
      style={{ background: T.bg.deep, borderColor: T.border.line }}
    >
      <div className="min-w-0">
        <p
          className="m-0 mb-3 text-sm font-semibold"
          style={{ color: T.accent.primary }}
        >
          {ask.eyebrow}
        </p>
        <h2
          id={`${id}-title`}
          aria-live="polite"
          className="type-h2 m-0 max-w-[28ch] text-balance"
          style={{
            color: T.ink.base,
          }}
        >
          {ask.title}
        </h2>
        <p
          className="mt-5 mb-6 max-w-[62ch] text-base leading-[1.65] text-pretty"
          style={{ color: T.ink.dim }}
        >
          {ask.description}
        </p>
        <GlobalLink
          href={ask.href}
          className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-(--t-accent-primary) px-6 py-3 text-center text-base font-semibold text-white no-underline hover:bg-(--t-accent-primary-hover) focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--t-accent-primary) sm:w-auto"
        >
          {ask.label}
        </GlobalLink>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
          <p className="m-0 text-sm leading-[1.6]" style={{ color: T.ink.dim }}>
            {ask.context}
          </p>
          {canChoose ? (
            <button
              type="button"
              className={`${LINK} cursor-pointer text-(--t-accent-primary)`}
              aria-expanded={choosing}
              aria-controls={`${id}-chooser`}
              onClick={() => setChoosing((value) => !value)}
            >
              {drive && !chosenSlug && !siblingSlug
                ? `Choose the ${chooserNoun} now`
                : `Choose another ${chooserNoun}`}
            </button>
          ) : null}
        </div>
        {choosing && canChoose ? (
          <div
            id={`${id}-chooser`}
            className="mt-3 rounded-2xl border p-4"
            style={{ background: T.bg.surface, borderColor: T.border.line }}
          >
            <label
              htmlFor={`${id}-place`}
              className="mb-2 block text-sm font-semibold"
            >
              Choose a {chooserNoun}
            </label>
            <select
              id={`${id}-place`}
              className="min-h-[44px] w-full rounded-xl border bg-white px-3 text-base focus-visible:outline-2 focus-visible:outline-(--t-accent-primary)"
              style={{ borderColor: T.border.hi }}
              value={
                level === "region" ? siblingSlug || place.region : chosenSlug
              }
              onChange={(event) => {
                if (level === "region")
                  setSiblingSlug(
                    event.target.value === place.region
                      ? ""
                      : event.target.value
                  )
                else setChosenSlug(event.target.value)
              }}
            >
              {level !== "region" && (!chosenSlug || drive) ? (
                <option value="" disabled={!drive}>
                  {drive
                    ? `All ${level === "continent" ? "countries" : "regions"} in ${name}`
                    : `Choose a ${chooserNoun}`}
                </option>
              ) : null}
              {level === "region" &&
              !siblings.some((row) => row.slug === place.region) ? (
                <option value={place.region}>{name}</option>
              ) : null}
              {choices.map((row) => (
                <option key={row.slug} value={row.slug}>
                  {row.name}
                </option>
              ))}
            </select>
            <p className="mt-2 mb-0 text-sm" style={{ color: T.ink.dim }}>
              Your invitation and its destination update before you start.
            </p>
          </div>
        ) : null}
        {mounted && !signedIn ? (
          <p className="mt-3 mb-0 text-sm" style={{ color: T.ink.dim }}>
            A free account is needed to contribute.
            {ask.kind === "add"
              ? " Sign in to open the form; your selected place is kept."
              : " You can choose a library first."}
          </p>
        ) : null}
        <div
          className="mt-6 border-t pt-4"
          style={{ borderColor: T.border.line }}
        >
          <div className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-lg"
              style={{ background: TINTS.green!.bg, color: TINTS.green!.fg }}
            >
              <Icon icon="mdi:check" width={16} />
            </span>
            <div className="min-w-0">
              <p
                className="m-0 text-sm leading-[1.6]"
                style={{ color: T.ink.dim }}
              >
                Add what you know with a source. A reviewer checks it, and
                accepted contributions are credited to you.
                {signedIn ? (
                  <>
                    {" "}
                    Follow progress in{" "}
                    <GlobalLink
                      href="/contribute/submissions"
                      className="inline-flex min-h-[44px] items-center rounded-sm underline underline-offset-3 focus-visible:outline-2 focus-visible:outline-(--t-accent-primary)"
                      style={{ color: T.accent.primary }}
                    >
                      Your submissions
                    </GlobalLink>
                    .
                  </>
                ) : null}
              </p>
              <details className="mt-2">
                <summary
                  className={`${LINK} w-fit cursor-pointer text-(--t-accent-primary)`}
                >
                  What do I need?
                </summary>
                <p
                  className="mt-1 mb-0 max-w-[60ch] text-sm leading-[1.6]"
                  style={{ color: T.ink.dim }}
                >
                  {requirement}
                </p>
              </details>
            </div>
          </div>
        </div>
      </div>
      {alternatives.length ? (
        <nav
          aria-labelledby={`${id}-alternatives`}
          className="flex min-w-0 flex-col rounded-[20px] border p-5 sm:p-6"
          style={{ background: T.bg.surface, borderColor: T.border.line }}
        >
          <h3 id={`${id}-alternatives`} className="type-small-heading m-0 mb-3">
            {baseAsk.kind === "gap"
              ? "Other ways to help in "
              : "Improve existing libraries in "}
            {name}
          </h3>
          <ul className="m-0 list-none space-y-2 p-0">
            {alternatives.map((key) => {
              const copy = GAP_TASKS[key]!
              const total = totals.find((row) => row.key === key)
              const tint = TINTS[copy.tint]!

              return (
                <li key={key}>
                  <GlobalLink
                    href={gapLibrariesHref(place, key)}
                    className="group -mx-2 flex min-h-[44px] items-center gap-3 rounded-xl px-2 py-4 no-underline hover:bg-(--t-bg-muted) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--t-accent-primary)"
                  >
                    <span
                      aria-hidden="true"
                      className="flex size-10 shrink-0 items-center justify-center rounded-xl"
                      style={{ background: tint.bg, color: tint.fg }}
                    >
                      <Icon icon={copy.icon} width={22} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className="block text-base leading-[1.4] font-semibold"
                        style={{ color: T.ink.base }}
                      >
                        {copy.title}
                      </span>
                      <span
                        className="mt-1 block text-sm leading-[1.5]"
                        style={{ color: T.ink.dim }}
                      >
                        {copy.benefit}
                      </span>
                      <span
                        className="mt-1 block text-sm leading-[1.5]"
                        style={{ color: T.ink.dim }}
                      >
                        {total
                          ? `Choose from ${total.missing.toLocaleString("en-GB")} ${total.missing === 1 ? "library" : "libraries"} ${copy.need}`
                          : `Choose from libraries in ${name} ${copy.need}`}
                      </span>
                    </span>
                    <Icon
                      icon="mdi:arrow-right"
                      width={20}
                      aria-hidden="true"
                      className="shrink-0 text-(--t-accent-primary)"
                    />
                  </GlobalLink>
                </li>
              )
            })}
          </ul>
          <p
            className="mt-auto mb-0 border-t pt-4 text-sm leading-[1.7]"
            style={{ borderColor: T.border.line, color: T.ink.dim }}
          >
            You don’t need to be a librarian.{" "}
            <GlobalLink
              href="/plans"
              className={LINK}
              style={{ color: T.accent.primary }}
            >
              Regular contributors can earn Pro free.
            </GlobalLink>
          </p>
        </nav>
      ) : (
        <p className="m-0 text-sm leading-[1.7]" style={{ color: T.ink.dim }}>
          You don’t need to be a librarian.{" "}
          <GlobalLink
            href="/plans"
            className={LINK}
            style={{ color: T.accent.primary }}
          >
            Regular contributors can earn Pro free.
          </GlobalLink>
        </p>
      )}
    </section>
  )
}
