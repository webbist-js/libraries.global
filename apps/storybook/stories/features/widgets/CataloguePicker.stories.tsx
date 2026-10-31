import { CataloguePicker } from "@/components/widgets/WidgetControls"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { fn } from "storybook/test"

const meta = {
  title: "Features/Widgets/CataloguePicker",
  component: CataloguePicker,
  args: {
    teamId: "example-team",
    kind: "libraries",
    label: "Add a library",
    onPick: fn(),
  },
  parameters: {
    fixtureResponses: {
      "GET /api/staff/team/example-team/widgets/catalogue": {
        body: {
          rows: [
            {
              documentId: "example-library",
              name: "Northbridge Library",
              city: "Northbridge",
            },
          ],
          more: false,
          page: 1,
        },
      },
    },
    docs: { story: { inline: false } },
  },
} satisfies Meta<typeof CataloguePicker>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
