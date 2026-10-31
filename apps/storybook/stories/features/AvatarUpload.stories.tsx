import { AvatarUpload } from "@/components/settings/AvatarUpload"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { fn } from "storybook/test"

const meta = {
  title: "Features/Settings/AvatarUpload",
  component: AvatarUpload,
  args: { initials: "MS", onUpload: fn(), uploadEnabled: false },
} satisfies Meta<typeof AvatarUpload>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const WithPhoto: Story = {
  args: { currentUrl: "/library-placeholder.svg" },
}
export const Mint: Story = { args: { background: "mint" } }
