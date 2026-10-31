import { AboutPhotoSequence } from "@/components/about/AboutPhotoSequence"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { aboutLibraries } from "../../fixtures/public/about"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/About/AboutPhotoSequence",
  component: AboutPhotoSequence,
  args: { libraries: aboutLibraries },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof AboutPhotoSequence>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
