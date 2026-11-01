import { ContributionHeatmap } from "@/app/[locale]/profile/[username]/_components/ContributionHeatmap"
import { Switch } from "@/components/atlas/atlas-ui"
import { CheckoutSteps } from "@/components/billing/CheckoutPresentation"
import { DriveProgressSummary } from "@/components/drives/DriveProgressSummary"
import { EDITORIAL_DANGER_PILL } from "@/components/ds/EditorialToolbar"
import CkEditorRenderer from "@/components/elementary/ck-editor"
import { LibraryHoursTable } from "@/components/library/LibraryHoursTable"
import { Button } from "@/components/ui/button"
import { WidgetChart } from "@/components/widgets/WidgetChart"
import { WidgetStat } from "@/components/widgets/WidgetStat"
import { WidgetThumbnail } from "@/components/widgets/WidgetThumbnail"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useState, type ReactNode } from "react"

import { splitHours } from "../fixtures/opening-times"
import { widgetData } from "../fixtures/workspace/widgets"

function Surface({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="min-w-0 rounded-2xl border border-(--t-border-line) bg-(--t-bg-deep) p-5">
      <h2 className="type-small-heading mt-0 mb-4">{title}</h2>
      {children}
    </section>
  )
}

function ThemeSurfaces() {
  const [checked, setChecked] = useState(false)

  return (
    <div className="mx-auto grid max-w-6xl gap-5 text-(--t-ink-base) md:grid-cols-2">
      <Surface title="Checkout steps and actions">
        <CheckoutSteps step="details" />
        <div className="mt-5 flex items-center gap-4">
          <Switch
            label="Show library locations"
            checked={checked}
            onChange={() => setChecked(!checked)}
          />
          <span>Library locations</span>
          <Button className={EDITORIAL_DANGER_PILL}>Reject draft</Button>
        </div>
      </Surface>
      <Surface title="Widget placeholders">
        <div className="flex gap-3">
          {(["finder", "directory", "chart", "stat"] as const).map((type) => (
            <div key={type} className="min-w-0 flex-1">
              <WidgetThumbnail type={type} />
            </div>
          ))}
        </div>
      </Surface>
      <Surface title="Opening hours and split sessions">
        <LibraryHoursTable
          openingTimes={splitHours}
          timezone="Europe/London"
          dashboard
        />
      </Surface>
      <div className="flex min-w-0 flex-col gap-5">
        <Surface title="Recorded and missing widget data">
          <WidgetChart
            data={{
              ...widgetData,
              type: "chart",
              config: { ...widgetData.config, metric: "facility", facility: 0 },
              rows: ["yes", "no", "unknown"].map((answer, index) => ({
                ...widgetData.rows[0]!,
                documentId: `example-${index}`,
                facilities: [answer as "yes" | "no" | "unknown"],
              })),
            }}
          />
        </Surface>
        <Surface title="Contribution progress">
          <DriveProgressSummary
            progress={{ total: 100, done: 30, inReview: 20 }}
            unit="library"
            gapPhrase="have opening hours"
            goalPercent={75}
            helpers={12}
          />
        </Surface>
      </div>
      <Surface title="Profile activity">
        <ContributionHeatmap
          submissions={[]}
          now={Date.parse("2026-01-15T12:00:00Z")}
        />
      </Surface>
      <Surface title="Widget data colours">
        <div className="grid grid-cols-3 gap-4">
          {(["indigo", "green", "rust", "slate", "ink"] as const).map(
            (accent) => (
              <div key={accent}>
                <span className="text-sm capitalize">{accent}</span>
                <WidgetStat
                  data={{
                    ...widgetData,
                    type: "stat",
                    config: {
                      ...widgetData.config,
                      metric: "libraries",
                      accent,
                    },
                  }}
                />
              </div>
            )
          )}
        </div>
      </Surface>
      <Surface title="Article tables, captions and code">
        <CkEditorRenderer
          className="ck-content"
          htmlContent='<figure class="table"><table><thead><tr><th>Library</th><th>Recorded hours</th></tr></thead><tbody><tr><td>Northbridge</td><td>09:00–17:00</td></tr></tbody></table><figcaption>Community contributions</figcaption></figure><p>Use <code>openingHours</code> to read the timetable.</p><div class="page-break"><span class="page-break__label">Page break</span></div>'
        />
      </Surface>
    </div>
  )
}

const meta = {
  title: "Patterns/Theme surfaces",
  component: ThemeSurfaces,
  parameters: { layout: "padded" },
} satisfies Meta<typeof ThemeSurfaces>

export default meta
type Story = StoryObj<typeof meta>

export const Light: Story = { globals: { appearance: "light" } }
export const Dark: Story = { globals: { appearance: "dark" } }
