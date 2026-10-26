"use client"

import { Icon } from "@iconify/react"
import {
  WIDGET_TYPES,
  type TeamWidget,
  type WidgetType,
} from "@repo/shared-data"
import { useState } from "react"

import { Notice } from "@/components/ds/Notice"
import { SelectField } from "@/components/ds/SelectField"
import { StaffPanel, STAFF_FIELD } from "@/components/staff/StaffPanel"
import { Button } from "@/components/ui/button"
import { WidgetError, WidgetField } from "@/components/widgets/WidgetControls"
import { WidgetThumbnail } from "@/components/widgets/WidgetThumbnail"
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
      <ol
        aria-label="Create widget steps"
        className="m-0 flex list-none gap-6 border-b border-(--t-border-line) pb-5 text-sm"
      >
        {["Choose a format", "Connect your libraries"].map((label, index) => (
          <li
            key={label}
            aria-current={step === index + 1 ? "step" : undefined}
            className={`flex items-center gap-2 ${step === index + 1 ? "font-semibold text-(--t-accent-primary)" : "text-(--t-ink-dim)"}`}
          >
            <span
              className={`flex size-7 items-center justify-center rounded-full ${step === index + 1 ? "bg-(--t-accent-chip)" : "bg-(--t-bg-muted)"}`}
            >
              {index + 1}
            </span>
            {label}
          </li>
        ))}
      </ol>
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
                className="relative cursor-pointer rounded-3xl border-2 bg-(--t-bg-deep) p-5 transition-colors has-focus-visible:outline-3 has-focus-visible:outline-offset-4 has-focus-visible:outline-(--t-accent-primary)"
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
                  className="sr-only"
                />
                <div className="mb-4 h-32">
                  <WidgetThumbnail type={t} />
                </div>
                <span className="flex items-start justify-between gap-3">
                  <strong className="text-lg">{widgetTypeLabels[t]}</strong>
                  <Icon
                    aria-hidden
                    icon={
                      type === t ? "mdi:check-circle" : "mdi:circle-outline"
                    }
                    width={23}
                    className={
                      type === t
                        ? "text-(--t-accent-primary)"
                        : "text-(--t-border-hi)"
                    }
                  />
                </span>
                <span className="mt-2 block text-sm text-(--t-ink-dim)">
                  {descriptions[t]}
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
        <StaffPanel
          title="Name it and connect your libraries"
          aside={
            <div className="hidden h-20 w-40 sm:block">
              <WidgetThumbnail type={type} />
            </div>
          }
        >
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
              <SelectField
                label="Library selection"
                value={selectionId}
                onValueChange={setSelectionId}
                options={[
                  {
                    value: "",
                    label: `New selection · ${data.team.primaryNetwork?.name ?? "Team libraries"}`,
                  },
                  ...data.selections.map((item) => ({
                    value: item.documentId,
                    label: item.name,
                  })),
                ]}
                disabled={busy}
              />
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
