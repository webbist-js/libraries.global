import { CorrectLibraryForm } from "@/app/[locale]/(dashboard)/contribute/correct/[slug]/_components/CorrectLibraryForm"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Contribute/Routes/CorrectLibraryForm",
  component: CorrectLibraryForm,
  args: {
    slug: "northbridge-library",
    libraryName: "Northbridge Library",
    sessionUser: {
      id: "storybook-reader",
      email: "maya@example.invalid",
      name: "Maya Example",
    },
  },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof CorrectLibraryForm>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
