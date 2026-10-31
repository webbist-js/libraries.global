import { TiptapRichText } from "@/components/elementary/tiptap-editor"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Patterns/Rich text/Tiptap content",
  component: TiptapRichText,
  args: {
    content:
      "<h2>About this library</h2><p>A welcoming library with <strong>reading rooms</strong>, community activities and a local history collection.</p>",
  },
} satisfies Meta<typeof TiptapRichText>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Empty: Story = { args: { content: null } }
