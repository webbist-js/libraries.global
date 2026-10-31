import StrapiTipTapEditorContent from "@/components/page-builder/components/utilities/StrapiTipTapEditorContent"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Page builder/StrapiTipTapEditorContent",
  component: StrapiTipTapEditorContent,
  args: {
    component: {
      id: 1,
      content:
        "<h2>Library collections</h2><p>Explore books, newspapers and local history.</p>",
    },
  },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof StrapiTipTapEditorContent>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
