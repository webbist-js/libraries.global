import { WidgetWorkspaceReady } from "@/components/widgets/WidgetWorkspaceReady"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { FixtureSessionProvider } from "../../../.storybook/FixtureSession"

const meta = {
  title: "Features/Widgets/WidgetWorkspaceReady",
  component: WidgetWorkspaceReady,
  args: { children: <p>The widget workspace is ready.</p> },
} satisfies Meta<typeof WidgetWorkspaceReady>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const SessionUnavailable: Story = {
  decorators: [
    (Story) => (
      <FixtureSessionProvider
        error={{
          name: "BetterFetchError",
          message: "Session unavailable",
          status: 503,
          statusText: "Service Unavailable",
          error: null,
        }}
      >
        <Story />
      </FixtureSessionProvider>
    ),
  ],
}
