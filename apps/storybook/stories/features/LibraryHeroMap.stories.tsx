import { LibraryHeroMap } from "@/components/library/LibraryHeroMap"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Library/LibraryHeroMap",
  component: LibraryHeroMap,
  args: {
    name: "Northbridge Library",
    lat: 51.5,
    lng: -0.1,
    neighbours: [],
    directionsUrl: "https://example.invalid/directions",
    atlasHref: "/atlas",
  },
} satisfies Meta<typeof LibraryHeroMap>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
