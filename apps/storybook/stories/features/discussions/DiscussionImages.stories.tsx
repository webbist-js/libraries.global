import { DiscussionImages } from "@/components/discussions/DiscussionPresentation"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { image } from "../../fixtures/workspace/discussions"

const meta = {
  title: "Features/Discussions/DiscussionImages",
  component: DiscussionImages,
  args: { images: [image] },
  parameters: { docs: { story: { inline: false, height: "900px" } } },
} satisfies Meta<typeof DiscussionImages>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
