import StrapiBlocksContent from "@/components/library/StrapiBlocksContent"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Editorial/StrapiBlocks",
  component: StrapiBlocksContent,
  args: {
    blocks: [
      {
        type: "heading",
        level: 2,
        children: [{ type: "text", text: "About this library" }],
      },
      {
        type: "paragraph",
        children: [
          { type: "text", text: "A synthetic example with " },
          { type: "text", text: "bold text", bold: true },
          { type: "text", text: " and a source." },
        ],
      },
    ],
  },
} satisfies Meta<typeof StrapiBlocksContent>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
