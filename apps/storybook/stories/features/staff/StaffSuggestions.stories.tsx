import { StaffSuggestions } from "@/app/[locale]/(dashboard)/staff/_components/StaffSuggestions"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Staff/StaffSuggestions",
  component: StaffSuggestions,
  parameters: {
    fixtureResponses: {
      "GET /api/staff/example-library/suggestions": {
        body: {
          data: [
            {
              documentId: "example-hours-suggestion",
              kind: "fields",
              rows: [
                {
                  field: "openingHours",
                  label: "Tuesday opening hours",
                  now: "09:00–17:00",
                  suggested: "09:00–19:00",
                },
              ],
              evidence:
                "The library posted a revised timetable on its public noticeboard.",
              byName: "Maya Example",
              createdAt: "2026-01-15T12:00:00Z",
              actions: ["approve", "done", "reject"],
            },
          ],
          meta: { total: 1 },
        },
      },
    },
    docs: { story: { inline: false } },
  },
  args: {
    libraryDocumentId: "example-library",
    publicPath: "/libraries/northbridge",
  },
} satisfies Meta<typeof StaffSuggestions>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Empty: Story = {
  parameters: {
    fixtureResponses: {
      "GET /api/staff/example-library/suggestions": {
        body: { data: [], meta: { total: 0 } },
      },
    },
    docs: { story: { inline: false } },
  },
}
