import {
  ApiPlaygroundNavigation,
  ApiPlaygroundNavigationProvider,
} from "@/components/developers/ApiPlaygroundNavigation"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Developers/ApiPlaygroundNavigation",
  component: ApiPlaygroundNavigation,
  decorators: [
    (Story) => (
      <ApiPlaygroundNavigationProvider sidebar>
        <div className="max-w-xs">
          <Story />
        </div>
      </ApiPlaygroundNavigationProvider>
    ),
  ],
} satisfies Meta<typeof ApiPlaygroundNavigation>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
