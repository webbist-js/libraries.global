import { ProFreeRoutes } from "@/app/[locale]/(dashboard)/contribute/_components/membership/ProFreeRoutes"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Membership/ProFreeRoutes",
  component: ProFreeRoutes,
  args: {},
} satisfies Meta<typeof ProFreeRoutes>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
