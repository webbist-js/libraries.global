import { PillarCarousel } from "@/components/home/PillarCarousel"
import { FeaturedLibraryCard } from "@/components/library/FeaturedLibraryCard"
import { CarouselItem } from "@/components/ui/carousel"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Home/PillarCarousel",
  component: PillarCarousel,
  args: {
    children: (
      <>
        <CarouselItem>
          <FeaturedLibraryCard
            href="/libraries/northbridge"
            name="Northbridge Library"
            city="Northbridge"
            imageUrl="/library-placeholder.svg"
          />
        </CarouselItem>
        <CarouselItem>
          <FeaturedLibraryCard
            href="/libraries/archive"
            name="Example archive"
            imageUrl="/library-placeholder.svg"
          />
        </CarouselItem>
      </>
    ),
  },
  decorators: [
    (Story) => (
      <div data-homepage>
        <Story />
      </div>
    ),
  ],
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof PillarCarousel>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
