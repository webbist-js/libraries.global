import { DEFAULT_FIND_STATE } from "@/components/index-page/find-helpers"
import { FindDriveBanner } from "@/components/index-page/FindDriveBanner"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { drive } from "../../fixtures/public/drives"

const meta = {
  title: "Features/Library search/FindDriveBanner",
  component: FindDriveBanner,
  args: {
    drives: [drive],
    state: {
      ...DEFAULT_FIND_STATE,
      place: { level: "region", slug: "northbridge" },
      needs: ["hours"],
    },
  },
} satisfies Meta<typeof FindDriveBanner>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
