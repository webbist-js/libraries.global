import { StrapiCkEditorContent } from "@/components/page-builder/components/utilities/StrapiCkEditorContent"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Page builder/StrapiCkEditorContent",
  component: StrapiCkEditorContent,
  args: {
    component: {
      id: 1,
      content:
        "<h2>About the library</h2><p>A welcoming library for everyone.</p>",
    },
  },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof StrapiCkEditorContent>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
