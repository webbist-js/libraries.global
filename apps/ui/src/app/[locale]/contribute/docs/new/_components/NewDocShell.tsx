"use client"

import { useSearchParams } from "next/navigation"
import { Suspense, useState } from "react"

import { DOCS_SECTIONS } from "@/components/docs/docs.config"
import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"

import { ContributeSubpageHero } from "../../../_components/ContributeSubpageHero"

export function NewDocShell() {
  return (
    <Suspense fallback={null}>
      <NewDocShellInner />
    </Suspense>
  )
}

function NewDocShellInner() {
  const searchParams = useSearchParams()
  const preselected = searchParams.get("section")
  const [section, setSection] = useState(
    () =>
      DOCS_SECTIONS.find((s) => s.key === preselected)?.key ??
      DOCS_SECTIONS[0]!.key
  )
  const [title, setTitle] = useState("")
  const [summary, setSummary] = useState("")
  const [outline, setOutline] = useState("")
  const [state, setState] = useState<"idle" | "saving" | "done" | "error">(
    "idle"
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !outline.trim()) return
    setState("saving")
    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionType: "wiki_edit",
          targetEntityType: "wiki_article",
          fields: {
            proposalKind: "new_doc",
            title: title.trim(),
            docsSection: section,
            summary: summary.trim(),
            outline: outline.trim(),
          },
          editSummary: `Proposed new doc: ${title.trim()}`,
        }),
      })
      if (!res.ok) throw new Error("submit failed")
      setState("done")
    } catch {
      setState("error")
    }
  }

  return (
    <div
      className="relative isolate flex min-h-screen w-full flex-col"
      style={{ background: T.bg.void, color: T.ink.base }}
    >
      <main className="relative z-10 flex-1">
        <ContributeSubpageHero
          section="Write a doc"
          heading="Write a doc for the"
          headingItalic="knowledge base."
          accentColor={T.accent.primary}
          body="Propose a new documentation page. A reviewer will help shape it, and published pages are credited to you."
        />

        <div className="mx-auto w-full max-w-[1360px] px-4 pt-8 pb-20 sm:px-8">
          {state === "done" ? (
            <div
              className="mx-auto max-w-[640px] rounded-[20px] border p-8 text-center"
              style={{ background: T.bg.deep, borderColor: T.border.line }}
            >
              <h2
                className="m-0"
                style={{
                  fontFamily: T.font.serif,
                  fontSize: "26px",
                  fontWeight: 500,
                }}
              >
                Proposal sent
              </h2>
              <p className="mt-2 mb-0 text-[16px]" style={{ color: T.ink.dim }}>
                A reviewer will pick it up. Follow its status from{" "}
                <GlobalLink
                  href="/contribute"
                  className="underline underline-offset-[3px]"
                  style={{ color: T.accent.primary }}
                >
                  your submissions
                </GlobalLink>
                .
              </p>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="mx-auto flex max-w-[640px] flex-col gap-5 rounded-[20px] border p-7"
              style={{ background: T.bg.deep, borderColor: T.border.line }}
            >
              <label className="flex flex-col gap-1.5 text-[14px] font-medium">
                Title
                <input
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. How the review process works"
                  className="rounded-[12px] border px-3.5 py-2.5 text-[15px] font-normal"
                  style={{
                    background: T.bg.deep,
                    borderColor: T.border.hi,
                    color: T.ink.base,
                  }}
                />
              </label>

              <label className="flex flex-col gap-1.5 text-[14px] font-medium">
                Section
                <select
                  value={section}
                  onChange={(e) =>
                    setSection(
                      e.target.value as (typeof DOCS_SECTIONS)[number]["key"]
                    )
                  }
                  className="rounded-[12px] border px-3.5 py-2.5 text-[15px] font-normal"
                  style={{
                    background: T.bg.deep,
                    borderColor: T.border.hi,
                    color: T.ink.base,
                  }}
                >
                  {DOCS_SECTIONS.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.title}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1.5 text-[14px] font-medium">
                Summary
                <span
                  className="text-[13px] font-normal"
                  style={{ color: T.ink.low }}
                >
                  One or two sentences on what the page covers.
                </span>
                <textarea
                  rows={2}
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  className="resize-y rounded-[12px] border px-3.5 py-2.5 text-[15px] leading-[1.55] font-normal"
                  style={{
                    background: T.bg.deep,
                    borderColor: T.border.hi,
                    color: T.ink.base,
                  }}
                />
              </label>

              <label className="flex flex-col gap-1.5 text-[14px] font-medium">
                Outline or draft
                <span
                  className="text-[13px] font-normal"
                  style={{ color: T.ink.low }}
                >
                  Headings, bullet points or a full draft — whatever you have.
                </span>
                <textarea
                  required
                  rows={10}
                  value={outline}
                  onChange={(e) => setOutline(e.target.value)}
                  className="resize-y rounded-[12px] border px-3.5 py-2.5 text-[15px] leading-[1.55] font-normal"
                  style={{
                    background: T.bg.deep,
                    borderColor: T.border.hi,
                    color: T.ink.base,
                  }}
                />
              </label>

              {state === "error" ? (
                <p
                  role="alert"
                  className="m-0 text-[14px] font-semibold"
                  style={{ color: T.accent.danger }}
                >
                  Couldn&rsquo;t send — please try again.
                </p>
              ) : null}

              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={state === "saving"}
                  className="rounded-full px-6 py-2.5 text-[15px] font-semibold text-white transition-colors disabled:opacity-60"
                  style={{ background: T.accent.primary }}
                >
                  {state === "saving" ? "Sending…" : "Send proposal"}
                </button>
                <GlobalLink
                  href="/docs"
                  className="text-[15px] underline underline-offset-[3px]"
                  style={{ color: T.ink.dim }}
                >
                  Cancel
                </GlobalLink>
              </div>
            </form>
          )}
        </div>
      </main>
    </div>
  )
}
