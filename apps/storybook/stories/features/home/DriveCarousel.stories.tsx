import { DriveCarousel } from "@/components/home/DriveCarousel"
import { HomeDriveCard } from "@/components/home/sections/HomeDriveCard"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { homepageDrives } from "../../fixtures/public/homepage"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Home/DriveCarousel",
  component: DriveCarousel,
  args: {
    label: "Community drives",
    children: (
      <>
        <HomeDriveCard view={homepageDrives[0]!} index={0} />
        <HomeDriveCard view={homepageDrives[0]!} index={1} />
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
} satisfies Meta<typeof DriveCarousel>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
