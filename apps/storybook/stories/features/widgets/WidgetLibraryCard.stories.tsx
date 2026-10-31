import { WidgetLibraryCard } from "@/components/widgets/WidgetLibraryCard"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { fn } from "storybook/test"

import { widgetData } from "../../fixtures/workspace/widgets"

const meta = {
  title: "Features/Widgets/WidgetLibraryCard",
  component: WidgetLibraryCard,
  decorators: [
    (Story) => (
      <ul className="m-0 list-none p-0">
        <Story />
      </ul>
    ),
  ],
  args: {
    r: widgetData.rows[0]!,
    c: widgetData.config,
    type: "directory",
    accent: "#4338ca",
    selected: null,
    onSelect: fn(),
    siteUrl: "https://example.invalid",
    location: null,
  },
} satisfies Meta<typeof WidgetLibraryCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
