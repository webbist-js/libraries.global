import { IndexRecordWizard } from "@/components/library-editor/IndexRecordWizard"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { wizardForm } from "../../fixtures/geography/mobile"
import { geographyResponses } from "../../fixtures/geography/responses"
import { editorBootstrap, editorResponses } from "../../fixtures/library-editor"

const meta = {
  parameters: {
    docs: { story: { inline: false, height: "900px" } },
    fixtureResponses: geographyResponses,
  },
  title: "Features/Library editor/IndexRecordWizard",
  component: IndexRecordWizard,
  args: { mode: "new", initialData: wizardForm, initialStep: 1 },
} satisfies Meta<typeof IndexRecordWizard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Improve: Story = {
  args: { mode: "improve", ...editorBootstrap },
  parameters: { fixtureResponses: editorResponses },
}
export const Drawer: Story = {
  ...Improve,
  args: { ...Improve.args, layout: "drawer" },
}
