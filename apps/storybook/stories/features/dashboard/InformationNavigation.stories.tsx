import { InformationNavigation } from "@/components/dashboard/InformationNavigation"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  profileResponses,
  readerSession,
} from "../../fixtures/workspace/profile"

const meta = {
  title: "Features/Dashboard/InformationNavigation",
  component: InformationNavigation,
  args: {
    links: [
      { href: "/about", label: "About" },
      { href: "/legal/privacy", label: "Privacy" },
    ],
    label: "Information pages",
  },
  parameters: {
    fixtureSession: readerSession,
    fixtureResponses: profileResponses,
    docs: { story: { inline: false } },
  },
} satisfies Meta<typeof InformationNavigation>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
