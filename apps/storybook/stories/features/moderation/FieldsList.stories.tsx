import { FieldsList } from "@/components/moderation/NewLibraryPanel"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Moderation/FieldsList",
  component: FieldsList,
  args: {
    fields: {
      name: "Northbridge Community Library",
      phone: "+44 20 0000 0000",
      website: "https://example.invalid",
    },
  },
} satisfies Meta<typeof FieldsList>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
