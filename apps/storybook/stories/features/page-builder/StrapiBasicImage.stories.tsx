import { StrapiBasicImage } from "@/components/page-builder/components/utilities/StrapiBasicImage"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Page builder/StrapiBasicImage",
  component: StrapiBasicImage,
  args: {
    component: {
      id: 1,
      media: {
        url: "/library-placeholder.svg",
        alternativeText: "Synthetic library illustration",
        width: 480,
        height: 320,
      },
      width: 480,
      height: 320,
      alt: "Synthetic library illustration",
    },
  },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof StrapiBasicImage>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
