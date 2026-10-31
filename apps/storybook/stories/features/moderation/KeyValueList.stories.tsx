import { KeyValueList } from "@/components/moderation/KeyValueList"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Moderation/KeyValueList",
  component: KeyValueList,
  args: {
    rows: [
      { label: "Library", value: "Northbridge Library" },
      { label: "Opening hours", value: "Monday to Friday, 09:00–17:00" },
      { label: "Source", value: "https://example.invalid/library" },
    ],
  },
} satisfies Meta<typeof KeyValueList>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
