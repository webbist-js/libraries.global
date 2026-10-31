import { HowReviewWorks } from "@/app/[locale]/(dashboard)/contribute/_components/hub/HowReviewWorks"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Contribute/Routes/HowReviewWorks",
  component: HowReviewWorks,
  args: {},
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof HowReviewWorks>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
