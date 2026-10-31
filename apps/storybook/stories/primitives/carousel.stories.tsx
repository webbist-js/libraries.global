import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
} from "@/components/ui/carousel"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Primitives/carousel",
  component: Carousel,
  args: {},
  render: (args) => (
    <div className="mx-auto max-w-lg px-12">
      <Carousel {...args}>
        <CarouselContent>
          {["Northbridge", "Eastmere", "Westhaven"].map((name) => (
            <CarouselItem key={name}>
              <div className="rounded-2xl border p-12">{name}</div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious />
        <CarouselNext />
      </Carousel>
    </div>
  ),
} satisfies Meta<typeof Carousel>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
