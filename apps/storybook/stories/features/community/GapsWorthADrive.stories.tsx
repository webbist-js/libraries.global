import { GapsWorthADrive } from "@/app/[locale]/(dashboard)/community/_components/GapsWorthADrive"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Community/Routes/GapsWorthADrive",
  component: GapsWorthADrive,
  args: {
    gaps: [
      {
        key: "hours",
        title: "Opening hours missing",
        count: 24,
        place: { level: "region", slug: "northbridge", name: "Northbridge" },
        href: "/libraries?needs=hours&region=northbridge",
      },
      {
        key: "photo",
        title: "No photo yet",
        count: 16,
        place: { level: "region", slug: "northbridge", name: "Northbridge" },
        href: "/libraries?needs=photo&region=northbridge",
      },
    ],
  },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof GapsWorthADrive>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
