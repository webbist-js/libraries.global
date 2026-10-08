"use client"

import { Icon } from "@iconify/react"
import { facilityChecklistFor, type FacilityCheck } from "@repo/shared-data"
import type React from "react"
import { useEffect, useState } from "react"

import { SegmentedControl } from "@/components/ds"
import { facilityIcon } from "@/components/library/facility-icons"
import { T } from "@/lib/design-tokens"

import { fieldHintStyle, fieldLabelStyle } from "./wizard.constants"
import type { FormData } from "./wizard.types"

type Answer = "yes" | "no" | "unsure"
type Option = { documentId: string; name: string }
const ANSWERS = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "unsure", label: "Not sure" },
] as const satisfies readonly { value: Answer; label: string }[]
const ENDPOINT = {
  accessibility: "/api/relations/accessibility",
  amenity: "/api/relations/amenities",
  service: "/api/relations/services",
} as const
const FORM_KEY = {
  accessibility: "accessibility",
  amenity: "amenities",
  service: "services",
} as const satisfies Record<FacilityCheck["collection"], keyof FormData>

/**
 * The facility checklist as Yes / No / Not sure rows, for the staff editor.
 * "Yes" links the matching option to the record; "No" and "Not sure" unlink
 * it. The difference between the two stays on this screen: the record
 * only carries what the library has.
 */
export function FacilityChecklistRows({
  f,
  setFormData,
}: {
  readonly f: FormData
  readonly setFormData: React.Dispatch<React.SetStateAction<FormData>>
}) {
  const checks = facilityChecklistFor(f.libraryType)
  const [options, setOptions] = useState<
    Record<FacilityCheck["collection"], Option[]>
  >({ accessibility: [], amenity: [], service: [] })
  const [said, setSaid] = useState<Record<string, Answer>>({})
  // Each list answers once, loaded or not; a row whose option never arrives
  // then says so instead of loading forever.
  const [settled, setSettled] = useState<
    Record<FacilityCheck["collection"], boolean>
  >({ accessibility: false, amenity: false, service: false })
  useEffect(() => {
    let cancelled = false
    for (const collection of Object.keys(ENDPOINT) as (keyof typeof ENDPOINT)[])
      fetch(ENDPOINT[collection])
        .then((r) => (r.ok ? r.json() : { data: [] }))
        .then((j) => {
          if (!cancelled)
            setOptions((all) => ({ ...all, [collection]: j.data ?? [] }))
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setSettled((all) => ({ ...all, [collection]: true }))
        })

    return () => {
      cancelled = true
    }
  }, [])
  const optionFor = (check: FacilityCheck) =>
    options[check.collection].find(
      (o) => o.name.toLowerCase() === check.name.toLowerCase()
    )
  const answerOf = (check: FacilityCheck): Answer => {
    const option = optionFor(check)
    if (option && f[FORM_KEY[check.collection]].includes(option.documentId))
      return "yes"

    return said[check.label] ?? "unsure"
  }
  const answer = (check: FacilityCheck, next: Answer) => {
    setSaid((all) => ({ ...all, [check.label]: next }))
    const option = optionFor(check)
    if (!option) return
    const key = FORM_KEY[check.collection]
    setFormData((prev) => {
      const ids = prev[key]
      const has = ids.includes(option.documentId)
      if (next === "yes" && !has)
        return { ...prev, [key]: [...ids, option.documentId] }
      if (next !== "yes" && has)
        return { ...prev, [key]: ids.filter((id) => id !== option.documentId) }

      return prev
    })
  }

  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-3 border-0 p-0">
      <legend className="p-0" style={fieldLabelStyle}>
        Facility checklist
      </legend>
      <p className="m-0" style={fieldHintStyle}>
        The questions readers ask on your page. &ldquo;Yes&rdquo; adds the
        facility to the record; &ldquo;No&rdquo; and &ldquo;Not sure&rdquo;
        leave it off.
      </p>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {checks.map((check) => {
          const option = optionFor(check)

          return (
            <li
              key={check.label}
              className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border px-4 py-2.5"
              style={{ borderColor: T.border.line, background: T.bg.deep }}
            >
              <span className="flex items-center gap-2.5 text-[15px] font-semibold">
                <Icon
                  aria-hidden="true"
                  icon={facilityIcon(check.label, check.collection)}
                  width={18}
                  height={18}
                  style={{ color: T.accent.primary }}
                />
                {check.label}
              </span>
              {option ? (
                <SegmentedControl
                  label={check.label}
                  options={ANSWERS}
                  value={answerOf(check)}
                  onChange={(value) => answer(check, value)}
                />
              ) : (
                <span
                  role="status"
                  className="text-[13px]"
                  style={{ color: T.ink.dim }}
                >
                  {settled[check.collection]
                    ? "Not available yet"
                    : "Loading options…"}
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </fieldset>
  )
}
