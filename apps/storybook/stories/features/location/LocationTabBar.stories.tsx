import { LocationTabBar } from "@/components/location/LocationTabBar"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Location/LocationTabBar",
  component: LocationTabBar,
  args: {
    tabs: [
      { id: "libraries", label: "Libraries" },
      { id: "regions", label: "Regions" },
    ],
    activeTabId: "libraries",
  },
} satisfies Meta<typeof LocationTabBar>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
