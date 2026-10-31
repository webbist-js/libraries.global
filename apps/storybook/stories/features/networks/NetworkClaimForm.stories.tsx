import { NetworkClaimForm } from "@/components/networks/NetworkClaimForm"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { fn } from "storybook/test"

import { networkDetail } from "../../fixtures/public/networks"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Networks/NetworkClaimForm",
  component: NetworkClaimForm,
  args: {
    detail: networkDetail,
    libraryIds: ["example-library"],
    teamId: "example-team",
    onSaved: fn(),
  },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof NetworkClaimForm>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
