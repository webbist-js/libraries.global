import { GlobalLink } from "@/components/global/GlobalLink"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Global/GlobalLink",
  component: GlobalLink,
  args: { href: "/libraries", children: "Browse libraries" },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof GlobalLink>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const External: Story = {
  args: {
    href: "https://example.org/library",
    children: "Official library website",
  },
}
export const WithoutDestination: Story = {
  args: { href: null, children: "Details not available" },
}
export const PageAnchor: Story = {
  args: { href: "#example-section", children: "Jump to the example section" },
}
