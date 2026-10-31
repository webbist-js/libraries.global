import { RolesTable } from "@/app/[locale]/(dashboard)/contribute/_components/hub/RolesTable"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Contribute/Routes/RolesTable",
  component: RolesTable,
  args: {},
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof RolesTable>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
