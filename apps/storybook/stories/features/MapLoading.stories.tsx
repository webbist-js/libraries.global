import { MapLoading } from "@/components/map/MapLoading"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Map/MapLoading",
  component: MapLoading,
  args: {},
} satisfies Meta<typeof MapLoading>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
