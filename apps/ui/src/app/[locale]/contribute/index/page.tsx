import { Icon } from "@iconify/react"
import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { getSessionSSR } from "@/lib/auth-server"
import { T } from "@/lib/design-tokens"
import { privateMetadata } from "@/lib/seo/metadata"
import { fetchIncompleteLibraries } from "@/lib/strapi-api/content/server"

import { ContributeSectionHeader } from "../_components/ContributeSectionHeader"
import {
  FindLibraryFirst,
  type RecordNeedingHelp,
} from "./_components/FindLibraryFirst"

export const metadata = privateMetadata("Index editor")

const NEXT_STEPS = [
  {
    title: "You make changes.",
    body: "Your draft saves as you go.",
  },
  {
    title: "A reviewer checks the source.",
    body: "Usually within a few days.",
  },
  {
    title: "It goes live, credited to you.",
    body: "The record keeps its full history.",
  },
]

function RailStep({
  n,
  label,
  sub,
}: {
  n: number
  label: string
  sub: string
}) {
  return (
    <li className="flex items-start gap-3">
      <span
        aria-hidden="true"
        className="flex size-9 shrink-0 items-center justify-center rounded-full text-[15px] font-semibold"
        style={{
          border: `1.5px solid ${T.accent.primary}`,
          color: T.accent.primary,
          background: T.bg.deep,
        }}
      >
        {n}
      </span>
      <span className="flex flex-col pt-1">
        <span
          className="text-[17px] font-semibold"
          style={{ color: T.ink.base }}
        >
          {label}
        </span>
        <span className="text-[15px]" style={{ color: T.ink.dim }}>
          {sub}
        </span>
      </span>
    </li>
  )
}

const STEPS = [
  { n: 1, label: "Identity", sub: "Name · Type · Status" },
  { n: 2, label: "Location", sub: "Address · Coordinates" },
  { n: 3, label: "Visit", sub: "Links · Hours · Access" },
  { n: 4, label: "Collections", sub: "Holdings · Classification" },
  { n: 5, label: "History", sub: "Founding · Building" },
  { n: 6, label: "Photo", sub: "Image · Credit" },
  { n: 7, label: "Sources & send", sub: "Evidence · Review" },
]

export default async function IndexEditorPage() {
  const session = await getSessionSSR(await headers())
  if (!session?.user) redirect("/auth/signin?callbackUrl=/contribute/index")

  const needsHelp: RecordNeedingHelp[] = (await fetchIncompleteLibraries())
    .slice(0, 3)
    .map((record) => ({
      documentId: record.documentId,
      slug: record.slug,
      name: record.name,
      place: record.place,
      missing: record.missing,
    }))

  return (
    <div
      style={{ background: T.bg.void, minHeight: "100vh", color: T.ink.base }}
    >
      <ContributeSectionHeader
        section="Index editor"
        title="Add or improve *a library.*"
        lead="Search the index first. Improve the record if it’s there, or add it if it isn’t. An editor reviews every change before it goes live."
      />
      <main className="mx-auto w-full max-w-[1360px] px-4 py-8 sm:px-8 lg:py-12">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-12 xl:grid-cols-[280px_minmax(0,1fr)_340px] 2xl:grid-cols-[300px_minmax(0,1fr)_380px]">
          {/* Left — the form's steps, as a preview */}
          <div className="min-w-0 self-start lg:sticky lg:top-[128px]">
            <h2
              style={{
                fontFamily: T.font.serif,
                fontSize: "24px",
                fontWeight: 500,
                letterSpacing: "-0.01em",
                lineHeight: 1.2,
                color: T.ink.base,
                margin: "0 0 6px",
              }}
            >
              Your record
            </h2>
            <p
              className="m-0 flex items-center gap-2 text-[15px]"
              style={{ color: T.ink.dim }}
            >
              <Icon icon="mdi:circle-outline" width={16} aria-hidden="true" />
              Choose a library to start
            </p>
            <ol className="m-0 mt-6 hidden list-none flex-col gap-1 p-0 lg:flex">
              <li
                className="flex items-center gap-3.5 rounded-[16px] px-4 py-3"
                style={{
                  background: T.bg.deep,
                  border: `1px solid ${T.border.line}`,
                }}
              >
                <span
                  aria-hidden="true"
                  className="flex size-9 shrink-0 items-center justify-center rounded-full"
                  style={{ background: T.accent.primary, color: "#fff" }}
                >
                  <Icon icon="mdi:magnify" width={18} />
                </span>
                <span className="flex flex-col">
                  <span
                    className="text-[17px] font-semibold"
                    style={{ color: T.ink.base }}
                  >
                    Find existing
                  </span>
                  <span className="text-[15px]" style={{ color: T.ink.dim }}>
                    Add or improve
                  </span>
                </span>
              </li>
              {STEPS.map((step) => (
                <li
                  key={step.n}
                  className="flex items-center gap-3 px-3 py-2.5"
                >
                  <span
                    aria-hidden="true"
                    className="flex size-9 shrink-0 items-center justify-center rounded-full text-[15px] font-semibold"
                    style={{
                      border: `1.5px solid ${T.border.hi}`,
                      color: T.ink.dim,
                      background: T.bg.deep,
                    }}
                  >
                    {step.n}
                  </span>
                  <span className="flex flex-col">
                    <span
                      className="text-[17px] font-semibold"
                      style={{ color: T.ink.dim }}
                    >
                      {step.label}
                    </span>
                    <span className="text-[15px]" style={{ color: T.ink.low }}>
                      {step.sub}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          </div>

          {/* Centre — search */}
          <div className="min-w-0">
            <FindLibraryFirst needsHelp={needsHelp} />
          </div>

          {/* Right — what happens next */}
          <aside className="flex flex-col gap-5 self-start lg:col-start-2 xl:sticky xl:top-[128px] xl:col-start-auto">
            <section
              aria-labelledby="next-heading"
              className="rounded-[24px] p-7"
              style={{
                background: T.bg.deep,
                border: `1px solid ${T.border.line}`,
              }}
            >
              <h2
                id="next-heading"
                className="m-0 mb-4 text-[17px] font-bold"
                style={{ color: T.ink.base }}
              >
                What happens next
              </h2>
              <ol className="m-0 flex list-none flex-col gap-4 p-0">
                {NEXT_STEPS.map((step, i) => (
                  <RailStep
                    key={step.title}
                    n={i + 1}
                    label={step.title}
                    sub={step.body}
                  />
                ))}
              </ol>
            </section>
            <aside
              aria-label="Tip"
              className="rounded-[20px] px-6 py-5"
              style={{ background: "var(--tint-national-bg)" }}
            >
              <p
                className="m-0 mb-2 flex items-center gap-2 text-[16px] font-bold"
                style={{ color: "var(--tint-national-fg)" }}
              >
                <Icon
                  icon="mdi:lightbulb-on-outline"
                  width={20}
                  aria-hidden="true"
                />
                Why search first?
              </p>
              <p
                className="m-0 text-[15px] leading-[1.6]"
                style={{ color: T.ink.base }}
              >
                A duplicate splits contributions across two records. Improving
                the existing one keeps its history and sources together.
              </p>
            </aside>
          </aside>
        </div>
      </main>
    </div>
  )
}
