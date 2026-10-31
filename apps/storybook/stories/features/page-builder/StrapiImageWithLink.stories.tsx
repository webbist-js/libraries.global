import { StrapiImageWithLink } from "@/components/page-builder/components/utilities/StrapiImageWithLink"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Page builder/StrapiImageWithLink",
  component: StrapiImageWithLink,
  args: {
    component: {
      id: 1,
      image: {
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
      link: {
        id: 1,
        type: "external",
        href: "https://example.invalid/library",
        label: "Visit the library website",
        newTab: true,
      },
    },
  },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof StrapiImageWithLink>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
