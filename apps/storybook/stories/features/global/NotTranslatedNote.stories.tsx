import { NotTranslatedNote } from "@/components/global/NotTranslatedNote"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Global/NotTranslatedNote",
  component: NotTranslatedNote,
  args: { locale: "fr" },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof NotTranslatedNote>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Czech: Story = { args: { locale: "cs" } }
