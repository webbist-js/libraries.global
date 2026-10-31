import { YourSubmissionsList } from "@/app/[locale]/(dashboard)/contribute/_components/hub/YourSubmissionsList"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { hubSubmissions } from "../../fixtures/public/routes"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Contribute/Routes/YourSubmissionsList",
  component: YourSubmissionsList,
  args: { submissions: hubSubmissions, username: "maya" },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof YourSubmissionsList>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Empty: Story = { args: { submissions: [] } }
