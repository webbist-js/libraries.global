import { ReportProblemForm } from "@/app/[locale]/(dashboard)/contribute/knowledge/[slug]/_components/ReportProblemForm"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Contribute/Routes/ReportProblemForm",
  component: ReportProblemForm,
  args: {
    slug: "welcoming-a-new-reader",
    title: "Welcoming a new reader",
    editHref: "/contribute/knowledge/welcoming-a-new-reader",
    canEdit: false,
    contentLocale: "en",
  },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof ReportProblemForm>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Editor: Story = { args: { canEdit: true } }
