import { ContributeSectionHeader } from "@/app/[locale]/(dashboard)/contribute/_components/ContributeSectionHeader"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Contribute/Routes/ContributeSectionHeader",
  component: ContributeSectionHeader,
  args: {
    title: "A better index starts with you",
    lead: "Check a record, share a photo, or write about the libraries you love.",
  },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof ContributeSectionHeader>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const TaskHeader: Story = {
  args: {
    section: "Suggest a correction",
    title: "Keep the record accurate",
    compact: true,
    back: true,
  },
}
