import { BoardCard } from "@/components/drives/DriveBuilderRail"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Drives/BoardCard",
  component: BoardCard,
  args: { editing: false },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof BoardCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
