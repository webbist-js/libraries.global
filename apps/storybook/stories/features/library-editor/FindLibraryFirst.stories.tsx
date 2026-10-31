import { FindLibraryFirst } from "@/components/library-editor/FindLibraryFirst"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { fn } from "storybook/test"

import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Library editor/FindLibraryFirst",
  component: FindLibraryFirst,
  args: {
    needsHelp: [],
    intent: "edit",
    onChooseLibrary: fn(),
    newLibraryHref: "/contribute/add",
  },
} satisfies Meta<typeof FindLibraryFirst>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
