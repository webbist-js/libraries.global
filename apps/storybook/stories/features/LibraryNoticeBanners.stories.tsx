import { LibraryNoticeBanners } from "@/components/library/LibraryNoticeBanners"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Library/LibraryNoticeBanners",
  component: LibraryNoticeBanners,
  args: {
    timezone: "Europe/London",
    notices: [
      {
        id: "example-service",
        type: "service",
        scope: "library",
        scopeWeek: null,
        scopeDay: null,
        stopId: null,
        from: "2020-01-01",
        to: "2099-12-31",
        endedAt: null,
        message:
          "The reading room is open while the entrance is being improved. Please use the garden door.",
        reason: null,
      },
    ],
  },
} satisfies Meta<typeof LibraryNoticeBanners>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Empty: Story = { args: { notices: [] } }
