"use client"

import { Icon } from "@iconify/react"
import {
  WIDGET_TYPES,
  type TeamWidget,
  type WidgetType,
} from "@repo/shared-data"
import { useTranslations } from "next-intl"
import { useState } from "react"

import { Notice } from "@/components/ds/Notice"
import { SelectField } from "@/components/ds/SelectField"
import { StaffPanel, STAFF_FIELD } from "@/components/staff/StaffPanel"
import { Button } from "@/components/ui/button"
import { WidgetError, WidgetField } from "@/components/widgets/WidgetControls"
import { WidgetThumbnail } from "@/components/widgets/WidgetThumbnail"
import { useRouter } from "@/lib/navigation"
import { widgetRequest, type WidgetWorkspace } from "@/lib/widgets/client"

export function WidgetCreate({ data }: { readonly data: WidgetWorkspace }) {
  const tSettings = useTranslations("widgetSettings")
  const tStatic = useTranslations("staticUi")

  const tExisting = useTranslations()

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
        title={tStatic("widget.this_workspace_is_closed")}
        tone="warn"
        icon="mdi:pause-circle-outline"
      >
        {tStatic(
          "widget.the_site_team_has_closed_this_workspace_so_new_widgets_can_t_be_created_contact_them_through_the_contact_page_"
        )}
      </Notice>
    )

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <ol
        aria-label={tStatic("widget.create_widget_steps")}
        className="m-0 flex list-none gap-6 border-b border-(--t-border-line) pb-5 text-sm"
      >
        {[tSettings("chooseFormat"), tSettings("connectLibraries")].map(
          (label, index) => (
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
          )
        )}
      </ol>
      <WidgetError error={error} />
      {step === 1 ? (
        <fieldset>
          <legend className="mb-5 font-sans text-3xl">
            {tStatic("widget.what_would_you_like_to_publish")}
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
                  <strong className="text-lg">{tSettings(t)}</strong>
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
                  {tSettings(`${t}Description`)}
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
            {tExisting("ui.continue")}
          </Button>
        </fieldset>
      ) : (
        <StaffPanel
          title={tStatic("widget.name_it_and_connect_your_libraries")}
          aside={
            <div className="hidden h-20 w-40 sm:block">
              <WidgetThumbnail type={type} />
            </div>
          }
        >
          <div className="space-y-6">
            <WidgetField
              label={tStatic("widget.internal_name")}
              hint={tStatic(
                "widget.only_your_team_sees_this_set_the_public_title_in_the_builder"
              )}
            >
              <input
                className={STAFF_FIELD}
                value={name}
                maxLength={120}
                onChange={(e) => setName(e.target.value)}
              />
            </WidgetField>
            <WidgetField label={tStatic("common.librarySelection")}>
              <SelectField
                label={tStatic("common.librarySelection")}
                value={selectionId}
                onValueChange={setSelectionId}
                options={[
                  {
                    value: "",
                    label: `New selection · ${data.team.primaryNetwork?.name ?? tStatic("widget.team_libraries")}`,
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
              {tStatic(
                data.team.primaryNetwork
                  ? "widget.defaultNetwork"
                  : "widget.defaultTeam"
              )}
            </p>
            <div className="flex flex-wrap justify-between gap-3">
              <Button variant="surface" size="pill" onClick={() => setStep(1)}>
                {tExisting("ui.back")}
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
