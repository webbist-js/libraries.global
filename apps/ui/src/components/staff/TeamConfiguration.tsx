"use client"
import { useTranslations } from "next-intl"
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
  const tStatic = useTranslations("staticUi")

  const tExisting = useTranslations()

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
          failure instanceof Error
            ? failure.message
            : tExisting("apiIndividualCheckout.retry")
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
        title={tStatic("staff.team_details_and_libraries")}
      >
        <form
          className="min-w-0 space-y-5"
          aria-busy={pending}
          onSubmit={saveTeam}
        >
          <label className="grid gap-2 text-base font-semibold">
            {tStatic("staff.team_name")}
            <input
              className={STAFF_FIELD}
              disabled={pending}
              required
              maxLength={120}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <p className="rounded-2xl bg-(--t-bg-surface) p-4 text-sm leading-relaxed text-(--t-ink-dim)">
            {tStatic(
              "staff.choose_the_libraries_your_team_covers_adding_a_library_does_not_verify_staff_access_removing_one_end"
            )}
          </p>
          <ul className="m-0 list-none divide-y divide-(--t-border-line) p-0">
            {libraries.map((library) => (
              <li
                className="flex items-center justify-between gap-3 py-3 text-sm"
                key={library.documentId}
              >
                <span>{library.name}</span>
                <button
                  className="min-h-11 shrink-0 rounded-full border border-(--t-border-line) px-4 py-2 text-sm font-semibold disabled:opacity-50"
                  type="button"
                  disabled={pending}
                  onClick={() => removeLibrary(library.documentId)}
                  aria-label={`Remove ${library.name}`}
                >
                  {tExisting("ui.remove")}
                </button>
              </li>
            ))}
          </ul>
          <label className="grid gap-2 text-base font-semibold">
            {tStatic("staff.find_a_library")}
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
                      className="min-h-11 shrink-0 rounded-full border border-(--t-border-line) px-4 py-2 text-sm font-semibold disabled:opacity-50"
                      type="button"
                      disabled={pending || libraries.length >= 200}
                      onClick={() => {
                        setLibraries((rows) => [...rows, library])
                        setQuery("")
                        setResults([])
                      }}
                    >
                      {tExisting("ui.add")} {library.name}
                    </button>
                  </li>
                ))}
            </ul>
          ) : null}
          {error ? (
            <p
              role="alert"
              className="rounded-2xl bg-(--t-palette-coral-soft) p-4 text-sm text-(--t-palette-coral-fg)"
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
              {pending ? tExisting("ui.saving") : "Save Team details"}
            </Button>
            <Button
              type="button"
              variant="surface"
              size="pill"
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              {tExisting("ui.cancel")}
            </Button>
          </div>
        </form>
      </Sheet>
    </>
  )
}
