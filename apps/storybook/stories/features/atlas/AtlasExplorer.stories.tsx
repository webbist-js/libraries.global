import { AtlasExplorer } from "@/components/atlas/AtlasExplorer"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: {
    docs: { story: { inline: false, height: "900px" } },
    fixtureResponses: geographyResponses,
  },
  title: "Features/Atlas/AtlasExplorer",
  component: AtlasExplorer,
  args: { scalable: false },
  decorators: [
    (Story) => (
      <div className="relative h-[800px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AtlasExplorer>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
