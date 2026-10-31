import { StaffPublishControls } from "@/components/library-editor/StaffPublishControls"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { fn } from "storybook/test"

import { wizardForm } from "../../fixtures/geography/mobile"
import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Library editor/StaffPublishControls",
  component: StaffPublishControls,
  args: {
    id: "example-library",
    initial: wizardForm,
    current: wizardForm,
    draftId: null,
    onPublished: fn(),
    onDiscard: fn(),
  },
} satisfies Meta<typeof StaffPublishControls>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
