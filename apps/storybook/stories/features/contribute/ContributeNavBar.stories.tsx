import { ContributeNavBar } from "@/app/[locale]/(dashboard)/contribute/_components/ContributeNavBar"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Contribute/Routes/ContributeNavBar",
  component: ContributeNavBar,
  args: {},
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof ContributeNavBar>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
