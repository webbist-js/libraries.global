import { LibraryHeroMap } from "@/components/library/LibraryHeroMap"
import { LibraryHeroMedia } from "@/components/library/LibraryHeroMedia"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Library/LibraryHeroMedia",
  component: LibraryHeroMedia,
  args: {
    photo: "/library-placeholder.svg",
    name: "Northbridge Library",
    caption: "Synthetic library illustration",
    gallery: [
      {
        url: "/library-placeholder.svg?view=reading-room",
        alt: "Reading room illustration",
        caption: "The reading room",
      },
    ],
    map: (
      <LibraryHeroMap
        name="Northbridge Library"
        lat={51.5}
        lng={-0.1}
        neighbours={[]}
        directionsUrl="https://example.invalid/directions"
        atlasHref="/atlas"
      />
    ),
    atlasHref: "/atlas",
  },
} satisfies Meta<typeof LibraryHeroMedia>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const NoPhoto: Story = { args: { photo: null, gallery: [] } }
