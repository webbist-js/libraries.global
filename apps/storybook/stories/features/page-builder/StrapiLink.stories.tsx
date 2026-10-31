import { StrapiLink } from "@/components/page-builder/components/utilities/StrapiLink"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Page builder/StrapiLink",
  component: StrapiLink,
  args: {
    component: {
      id: 1,
      type: "external",
      href: "https://example.invalid/library",
      label: "Visit the library website",
      newTab: true,
    },
  },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof StrapiLink>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
