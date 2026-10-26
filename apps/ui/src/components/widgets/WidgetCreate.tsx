"use client"

import {
  WIDGET_TYPES,
  type TeamWidget,
  type WidgetType,
} from "@repo/shared-data"
import { useState } from "react"

import { Notice } from "@/components/ds/Notice"
import { StaffPanel, STAFF_FIELD } from "@/components/staff/StaffPanel"
import { Button } from "@/components/ui/button"
import { WidgetError, WidgetField } from "@/components/widgets/WidgetControls"
import { useRouter } from "@/lib/navigation"
import {
  widgetRequest,
  widgetTypeLabels,
  type WidgetWorkspace,
} from "@/lib/widgets/client"

const descriptions = {
  finder: "A map and searchable list of your libraries.",
  directory: "Library addresses, regular hours and links.",
  chart: "Compare recorded facts across named groups.",
  stat: "One headline number with its population and source.",
}

export function WidgetCreate({ data }: { readonly data: WidgetWorkspace }) {
  const router = useRouter(),
    [step, setStep] = useState(1),
    [type, setType] = useState<WidgetType>("finder"),
    [name, setName] = useState(""),
    [selectionId, setSelectionId] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null)
  const create = async () => {
    setBusy(true)
    setError(null)
    try {
      const w = await widgetRequest<TeamWidget>(
        data.team.documentId,
        "",
        "POST",
        { type, name, selectionId: selectionId || undefined }
      )
      router.push(`/staff/teams/widgets/${w.documentId}`)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  if (!data.team.active)
    return (
      <Notice
        title="Active Team access required"
        tone="warn"
        icon="mdi:pause-circle-outline"
      >
        Reactivate your Team from Billing & seats to create widgets.
      </Notice>
    )

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <p className="text-sm font-semibold">Step {step} of 2</p>
      <WidgetError error={error} />
      {step === 1 ? (
        <fieldset>
          <legend className="mb-5 font-serif text-3xl">
            What would you like to publish?
          </legend>
          <div className="grid gap-4 sm:grid-cols-2">
            {WIDGET_TYPES.map((t) => (
              <label
                key={t}
                className="flex cursor-pointer items-start gap-3 rounded-3xl border-2 bg-white p-6"
                style={{
                  borderColor:
                    type === t
                      ? "var(--t-accent-primary)"
                      : "var(--t-border-line)",
                }}
              >
                <input
                  type="radio"
                  name="widget-type"
                  checked={type === t}
                  onChange={() => setType(t)}
                  className="mt-1 size-5"
                />
                <span>
                  <strong className="text-lg">{widgetTypeLabels[t]}</strong>
                  <span className="mt-2 block text-sm text-(--t-ink-dim)">
                    {descriptions[t]}
                  </span>
                </span>
              </label>
            ))}
          </div>
          <Button
            className="mt-6"
            variant="primary"
            size="pill"
            onClick={() => setStep(2)}
          >
            Continue
          </Button>
        </fieldset>
      ) : (
        <StaffPanel title="Name it and choose libraries">
          <div className="space-y-6">
            <WidgetField
              label="Internal name"
              hint="Only your Team sees this. Set the public title in the builder."
            >
              <input
                className={STAFF_FIELD}
                value={name}
                maxLength={120}
                onChange={(e) => setName(e.target.value)}
              />
            </WidgetField>
            <WidgetField label="Library selection">
              <select
                className={STAFF_FIELD}
                value={selectionId}
                onChange={(e) => setSelectionId(e.target.value)}
              >
                <option value="">
                  New selection —{" "}
                  {data.team.primaryNetwork?.name ?? "Team libraries"}
                </option>
                {data.selections.map((s) => (
                  <option key={s.documentId} value={s.documentId}>
                    {s.name}
                  </option>
                ))}
              </select>
            </WidgetField>
            <p className="text-sm text-(--t-ink-dim)">
              The default uses{" "}
              {data.team.primaryNetwork
                ? "your confirmed library service"
                : "your Team’s libraries"}
              . Edit its sources or add published libraries from anywhere in the
              selection editor.
            </p>
            <div className="flex flex-wrap justify-between gap-3">
              <Button variant="surface" size="pill" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button
                variant="primary"
                size="pill"
                disabled={!name.trim() || busy}
                onClick={create}
              >
                {busy ? "Creating…" : "Create draft and open preview"}
              </Button>
            </div>
          </div>
        </StaffPanel>
      )}
    </div>
  )
}
