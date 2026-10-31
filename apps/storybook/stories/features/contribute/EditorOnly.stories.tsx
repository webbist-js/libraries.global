import { EditorOnly } from "@/components/contribute/EditorOnly"
import { Button } from "@/components/ui/button"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"
import {
  contributorSession,
  editorSession,
} from "../../fixtures/public/session"

const meta = {
  title: "Features/Contribute/EditorOnly",
  component: EditorOnly,
  args: {
    kind: "knowledge",
    children: <Button>Open article editor</Button>,
    fallback: <a href="/contribute/knowledge/apply">Apply to be an editor</a>,
  },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
    fixtureSession: editorSession,
  },
} satisfies Meta<typeof EditorOnly>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Reader: Story = {
  parameters: { fixtureSession: contributorSession },
}
