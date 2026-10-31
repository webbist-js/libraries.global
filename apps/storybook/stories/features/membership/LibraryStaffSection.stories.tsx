import { LibraryStaffSection } from "@/app/[locale]/(dashboard)/contribute/_components/membership/LibraryStaffSection"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Membership/LibraryStaffSection",
  component: LibraryStaffSection,
  args: { isStaff: false },
} satisfies Meta<typeof LibraryStaffSection>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Staff: Story = { args: { isStaff: true } }
export const Compact: Story = { args: { compact: true } }
