import { SubmissionsShell } from "@/app/[locale]/(dashboard)/contribute/submissions/_components/SubmissionsShell"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { readerSession } from "../../../.storybook/FixtureSession"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Contribute/Routes/SubmissionsShell",
  component: SubmissionsShell,
  args: { username: "maya" },
  parameters: {
    docs: {
      story: { inline: false, iframeHeight: 900 },
      description: {
        component:
          "This example runs in its own iframe to keep fixture requests, caches and page landmarks independent. Open Canvas to use the interactive Controls.",
      },
    },
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
    fixtureSession: readerSession,
  },
} satisfies Meta<typeof SubmissionsShell>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
