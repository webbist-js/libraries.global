import { HeaderDropdownTrigger } from "@/components/global/HeaderDropdown"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { HeaderDropdownExample } from "../../fixtures/public/header-dropdown"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Global/HeaderDropdownTrigger",
  component: HeaderDropdownTrigger,
  args: { kind: "menu" },
  render: (args) => (
    <HeaderDropdownExample kind={args.kind} openOnMount={false} />
  ),
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
    docs: {
      story: { inline: false, iframeHeight: 500 },
      description: {
        component:
          "Real dropdown, select and popover contexts preserve keyboard and focus behavior. Open Canvas for Controls.",
      },
    },
  },
} satisfies Meta<typeof HeaderDropdownTrigger>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Select: Story = { args: { kind: "select" } }
export const Popover: Story = { args: { kind: "popover" } }
