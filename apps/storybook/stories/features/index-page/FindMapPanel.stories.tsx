import { FindMapPanel } from "@/components/index-page/FindMapPanel"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { findResult } from "../../fixtures/public/find"

const meta = {
  title: "Features/Library search/FindMapPanel",
  component: FindMapPanel,
  args: { hits: findResult.hits },
} satisfies Meta<typeof FindMapPanel>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const NoCoordinates: Story = { args: { hits: [] } }
