"use client"

import { type FormEvent, useEffect, useState, useTransition } from "react"

import { useMembershipRefresh } from "@/components/billing/useMembershipRefresh"
import { Sheet } from "@/components/ds/Sheet"
import { Button } from "@/components/ui/button"
import type { TeamDetail, TeamLibrary } from "@/lib/staff/types"

import { STAFF_FIELD } from "./StaffPanel"

export function TeamConfiguration({
  team,
  label = "Edit Team details",
}: {
  readonly team: TeamDetail
  readonly label?: string
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(team.name)
  const [libraries, setLibraries] = useState(team.libraries)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<TeamLibrary[]>([])
  const [error, setError] = useState("")
  const [pending, startTransition] = useTransition()
  const refresh = useMembershipRefresh()
  useEffect(() => {
    if (query.trim().length < 2 || !open) return
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/staff/team/libraries?q=${encodeURIComponent(query.trim())}`,
          { signal: controller.signal, cache: "no-store" }
        )
        if (response.ok) setResults((await response.json()).libraries)
      } catch {
        /* A cancelled search needs no error. */
      }
    }, 300)

    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [query, open])
  const removeLibrary = (id: string) =>
    setLibraries((rows) => rows.filter((library) => library.documentId !== id))
  const saveTeam = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    startTransition(async () => {
      setError("")
      try {
        const response = await fetch(`/api/staff/team/${team.documentId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            libraryDocumentIds: libraries.map((l) => l.documentId),
          }),
        })
        const body = await response.json()
        if (!response.ok)
          throw new Error(
            body.error?.code === "library_verification_required"
              ? "To add a library to a verified Team, you must already be its verified owner. Request library access first."
              : "Team details could not be saved."
          )
        await refresh()
        setOpen(false)
      } catch (failure) {
        setError(
          failure instanceof Error ? failure.message : "Please try again."
        )
      }
    })
  }
  if (team.viewerRole !== "organiser") return null

  return (
    <>
      <Button
        type="button"
        variant="surface"
        size="pill"
        onClick={() => {
          setName(team.name)
          setLibraries(team.libraries)
          setQuery("")
          setResults([])
          setError("")
          setOpen(true)
        }}
      >
        {label}
      </Button>
      <Sheet
        open={open}
        onClose={() => {
          if (!pending) setOpen(false)
        }}
        side="right"
        size="lg"
        title="Team details and libraries"
      >
        <form
          className="min-w-0 space-y-5"
          aria-busy={pending}
          onSubmit={saveTeam}
        >
          <label className="grid gap-2 text-[15px] font-semibold">
            Team name
            <input
              className={STAFF_FIELD}
              disabled={pending}
              required
              maxLength={120}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <p className="rounded-2xl bg-(--t-bg-surface) p-4 text-[14px] leading-relaxed text-(--t-ink-dim)">
            Choose the Libraries your Team covers. Adding a Library does not
            verify staff access. Removing one ends the staff access this Team
            assigned there.
          </p>
          <ul className="m-0 list-none divide-y divide-(--t-border-line) p-0">
            {libraries.map((library) => (
              <li
                className="flex items-center justify-between gap-3 py-3 text-[14px]"
                key={library.documentId}
              >
                <span>{library.name}</span>
                <button
                  className="min-h-11 shrink-0 rounded-full border border-(--t-border-line) px-4 py-2 text-[14px] font-semibold disabled:opacity-50"
                  type="button"
                  disabled={pending}
                  onClick={() => removeLibrary(library.documentId)}
                  aria-label={`Remove ${library.name}`}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
          <label className="grid gap-2 text-[15px] font-semibold">
            Find a Library
            <input
              className={STAFF_FIELD}
              disabled={pending}
              maxLength={120}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setResults([])
              }}
            />
          </label>
          {query.trim().length >= 2 ? (
            <ul className="m-0 list-none space-y-2 p-0">
              {results
                .filter(
                  (l) =>
                    !libraries.some((own) => own.documentId === l.documentId)
                )
                .map((library) => (
                  <li key={library.documentId}>
                    <button
                      className="min-h-11 shrink-0 rounded-full border border-(--t-border-line) px-4 py-2 text-[14px] font-semibold disabled:opacity-50"
                      type="button"
                      disabled={pending || libraries.length >= 200}
                      onClick={() => {
                        setLibraries((rows) => [...rows, library])
                        setQuery("")
                        setResults([])
                      }}
                    >
                      Add {library.name}
                    </button>
                  </li>
                ))}
            </ul>
          ) : null}
          {error ? (
            <p
              role="alert"
              className="rounded-2xl bg-red-50 p-4 text-[14px] text-red-900"
            >
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-3 border-t border-(--t-border-line) pt-5">
            <Button
              type="submit"
              variant="primary"
              size="pill"
              disabled={pending}
            >
              {pending ? "Saving…" : "Save Team details"}
            </Button>
            <Button
              type="button"
              variant="surface"
              size="pill"
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Sheet>
    </>
  )
}
