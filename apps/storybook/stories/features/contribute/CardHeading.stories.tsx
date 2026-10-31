import { CardHeading } from "@/app/[locale]/(dashboard)/contribute/_components/hub/YourSubmissionsList"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Contribute/Routes/CardHeading",
  component: CardHeading,
  args: { id: "storybook-hub-heading", children: "Your contributions" },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof CardHeading>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
