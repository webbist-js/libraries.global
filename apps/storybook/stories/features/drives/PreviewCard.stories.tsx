import { PreviewCard } from "@/components/drives/DriveBuilderRail"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { driveView } from "../../fixtures/public/drives"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Drives/PreviewCard",
  component: PreviewCard,
  args: { view: driveView },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof PreviewCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
