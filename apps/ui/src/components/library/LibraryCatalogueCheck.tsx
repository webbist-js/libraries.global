"use client"

import { useId, useState } from "react"

import { T, TYPE_TINT } from "@/lib/design-tokens"

interface BranchHoldings {
  branch: string
  available: number
  unavailable: number
}

interface AvailabilityResponse {
  catalogue: { name: string; system: string; url: string }
  branch: string | null
  checkedAt: string
  result: {
    found: boolean
    recordUrl?: string
    holdings: BranchHoldings[]
  } | null
  error: { code: string; message: string } | null
}

type State =
  | { kind: "idle" }
  | { kind: "loading"; isbn: string }
  | { kind: "done"; isbn: string; data: AvailabilityResponse }
  | { kind: "failed"; message: string }

const ISBN_SHAPE = /^(\d{9}[\dX]|\d{13})$/

/** Catalogue branch names can carry shelf suffixes ("Central - F9 - Children's"). */
function sameBranch(holding: string, branch: string | null): boolean {
  if (!branch) return false
  const h = holding.toLowerCase().trim()
  const b = branch.toLowerCase().trim()

  return h === b || h.startsWith(`${b} -`)
}

/** Groups shelf-level rows into one row per branch, this Library first. */
function byBranch(holdings: BranchHoldings[], branch: string | null) {
  const rows = new Map<string, BranchHoldings>()
  for (const h of holdings) {
    const name = h.branch.split(/\s+-\s+/)[0]!.trim()
    const row = rows.get(name) ?? { branch: name, available: 0, unavailable: 0 }
    row.available += h.available
    row.unavailable += h.unavailable
    rows.set(name, row)
  }

  return [...rows.values()].sort((a, b) => {
    const aHere = sameBranch(a.branch, branch) ? 1 : 0
    const bHere = sameBranch(b.branch, branch) ? 1 : 0
    if (aHere !== bHere) return bHere - aHere
    if (a.available !== b.available) return b.available - a.available

    return a.branch.localeCompare(b.branch)
  })
}

export function LibraryCatalogueCheck({
  libraryDocumentId,
  catalogueName,
  catalogueUrl,
}: {
  readonly libraryDocumentId: string
  readonly catalogueName: string
  readonly catalogueUrl: string
}) {
  const inputId = useId()
  const hintId = useId()
  const [value, setValue] = useState("")
  const [state, setState] = useState<State>({ kind: "idle" })

  async function check(e: React.FormEvent) {
    e.preventDefault()
    const isbn = value.replaceAll(/[\s-]/g, "").toUpperCase()
    if (!ISBN_SHAPE.test(isbn)) {
      setState({
        kind: "failed",
        message: "That doesn't look like an ISBN. Use the 10 or 13 digits.",
      })

      return
    }
    setState({ kind: "loading", isbn })
    try {
      const res = await fetch(
        `/api/catalogues/availability?library=${libraryDocumentId}&isbn=${isbn}`
      )
      // Errors come as { error: string } from our route or
      // { error: { message } } when Strapi rejects the request.
      const body = (await res.json().catch(() => null)) as
        | AvailabilityResponse
        | { error?: string | { message?: string } }
        | null
      if (!res.ok || !body || !("catalogue" in body)) {
        const err = body && "error" in body ? body.error : undefined
        const message = typeof err === "string" ? err : err?.message
        setState({
          kind: "failed",
          message:
            res.status === 404
              ? "This library's catalogue isn't connected yet."
              : (message ?? "We couldn't check the catalogue just now."),
        })

        return
      }
      setState({ kind: "done", isbn, data: body })
    } catch {
      setState({
        kind: "failed",
        message: "We couldn't check the catalogue just now.",
      })
    }
  }

  const loading = state.kind === "loading"

  return (
    <div>
      <form onSubmit={check} className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-[220px] flex-1 flex-col gap-1.5">
          <label
            htmlFor={inputId}
            className="text-[15px] font-semibold"
            style={{ color: T.ink.base }}
          >
            ISBN
          </label>
          <input
            id={inputId}
            aria-describedby={hintId}
            inputMode="numeric"
            autoComplete="off"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="978-0-14-118776-1"
            className="rounded-[14px] px-3.5 py-2.5 text-[16px]"
            style={{
              background: T.bg.surface,
              border: `1px solid ${T.border.hi}`,
              color: T.ink.base,
            }}
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="rounded-full bg-(--t-accent-primary) px-5 py-2.5 text-[16px] font-semibold text-white hover:bg-(--t-accent-primary-hover) disabled:opacity-60"
        >
          {loading ? "Checking…" : "Check"}
        </button>
      </form>
      <p
        id={hintId}
        className="mt-2 mb-0 text-[14px]"
        style={{ color: T.ink.dim }}
      >
        Searches {catalogueName} live. The ISBN is usually on the back cover or
        copyright page.
      </p>

      <div aria-live="polite" className="mt-4">
        {state.kind === "loading" ? (
          <p className="m-0 text-[16px]" style={{ color: T.ink.dim }}>
            Asking the catalogue about {state.isbn}…
          </p>
        ) : null}

        {state.kind === "failed" ? (
          <p
            className="m-0 rounded-2xl px-4 py-3 text-[16px]"
            style={{ background: TYPE_TINT.special.bg, color: T.accent.danger }}
          >
            <span aria-hidden="true">⚠ </span>
            {state.message}
          </p>
        ) : null}

        {state.kind === "done" ? (
          <Results
            data={state.data}
            isbn={state.isbn}
            catalogueUrl={catalogueUrl}
          />
        ) : null}
      </div>

      <p className="mt-5 mb-0 text-[13px]" style={{ color: T.ink.low }}>
        Live from the library service&apos;s own catalogue. Catalogue connectors
        adapted from{" "}
        <a
          href="https://github.com/LibrariesHacked/catalogues-library"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2"
          style={{ color: T.ink.dim }}
        >
          Libraries Hacked
        </a>
        .
      </p>
    </div>
  )
}

function Results({
  data,
  isbn,
  catalogueUrl,
}: {
  readonly data: AvailabilityResponse
  readonly isbn: string
  readonly catalogueUrl: string
}) {
  const openLink = (
    <a
      href={data.result?.recordUrl ?? catalogueUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="font-semibold underline underline-offset-[3px]"
      style={{ color: T.accent.primary }}
    >
      Open in the catalogue ↗
    </a>
  )

  if (data.error || !data.result) {
    return (
      <p className="m-0 text-[16px]" style={{ color: T.ink.dim }}>
        <span aria-hidden="true">⚠ </span>
        {data.error?.code === "unsupported"
          ? "This catalogue can't be searched from here."
          : "The catalogue didn't answer properly just now."}{" "}
        {openLink}
      </p>
    )
  }

  if (!data.result.found || data.result.holdings.length === 0) {
    return (
      <p className="m-0 text-[16px]" style={{ color: T.ink.dim }}>
        {data.result.found
          ? `${data.catalogue.name} has a record for ${isbn} but no copies listed.`
          : `No record of ${isbn} in ${data.catalogue.name}. Other editions may have a different ISBN.`}{" "}
        {data.result.found ? openLink : null}
      </p>
    )
  }

  const rows = byBranch(data.result.holdings, data.branch)
  const totalAvailable = rows.reduce((n, r) => n + r.available, 0)

  return (
    <div>
      <p className="mt-0 mb-3 text-[16px]" style={{ color: T.ink.base }}>
        {totalAvailable > 0 ? (
          <span style={{ color: T.accent.ok }}>
            <span aria-hidden="true">● </span>
            {totalAvailable} {totalAvailable === 1 ? "copy" : "copies"} on the
            shelf
          </span>
        ) : (
          <span style={{ color: T.ink.dim }}>
            <span aria-hidden="true">○ </span>
            All copies are out
          </span>
        )}{" "}
        across {rows.length} {rows.length === 1 ? "branch" : "branches"}.{" "}
        {openLink}
      </p>
      <div
        className="max-h-[360px] overflow-y-auto rounded-2xl"
        style={{ border: `1px solid ${T.border.line}` }}
      >
        <table className="w-full border-collapse text-[15px]">
          <caption className="sr-only">
            Copies of {isbn} by branch, {data.catalogue.name}
          </caption>
          <thead>
            <tr style={{ background: T.bg.surface, color: T.ink.dim }}>
              <th scope="col" className="px-3.5 py-2 text-left font-semibold">
                Branch
              </th>
              <th scope="col" className="px-3.5 py-2 text-right font-semibold">
                On shelf
              </th>
              <th scope="col" className="px-3.5 py-2 text-right font-semibold">
                Out
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const here = sameBranch(r.branch, data.branch)

              return (
                <tr
                  key={r.branch}
                  style={{
                    borderTop: `1px solid ${T.border.divider}`,
                    background: here ? T.accent.chip : undefined,
                  }}
                >
                  <th
                    scope="row"
                    className="px-3.5 py-2 text-left font-normal"
                    style={{ color: T.ink.base }}
                  >
                    {r.branch}
                    {here ? (
                      <span
                        className="ml-2 text-[13px] font-semibold"
                        style={{ color: T.accent.primary }}
                      >
                        This library
                      </span>
                    ) : null}
                  </th>
                  <td
                    className="px-3.5 py-2 text-right font-semibold"
                    style={{ color: r.available > 0 ? T.accent.ok : T.ink.dim }}
                  >
                    {r.available}
                  </td>
                  <td
                    className="px-3.5 py-2 text-right"
                    style={{ color: T.ink.dim }}
                  >
                    {r.unavailable}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 mb-0 text-[13px]" style={{ color: T.ink.low }}>
        Checked{" "}
        {new Date(data.checkedAt).toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
        })}
        . Counts can lag the shelf by a few minutes.
      </p>
    </div>
  )
}
