import { LibrarySearchBox } from "@/components/index-page/LibrarySearchBox"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useId } from "react"
import { fn } from "storybook/test"

import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Library search/LibrarySearchBox",
  component: LibrarySearchBox,
  args: {
    id: "storybook-library-search",
    defaultQuery: "",
    onSubmit: fn(),
    onClear: fn(),
    onNearMe: fn(),
    nearActive: false,
    locating: false,
  },
  render: function Example(args) {
    const id = useId()

    return <LibrarySearchBox {...args} id={id} />
  },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof LibrarySearchBox>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const WithQuery: Story = { args: { defaultQuery: "Northbridge" } }
export const Locating: Story = { args: { locating: true } }
export const NearMe: Story = { args: { nearActive: true } }
