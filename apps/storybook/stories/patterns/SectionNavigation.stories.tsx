import { SectionNavigation } from "@/components/ds/SectionNavigation"
import { SectionTabs } from "@/components/ds/SectionTabs"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Patterns/Section navigation",
  component: SectionNavigation,
  args: {
    children: (
      <SectionTabs
        label="Sections"
        activeId="knowledge"
        tabs={[
          { id: "knowledge", label: "Knowledge", href: "/knowledge" },
          { id: "journal", label: "Journal", href: "/journal" },
        ]}
      />
    ),
  },
} satisfies Meta<typeof SectionNavigation>

export default meta
export const Default: StoryObj<typeof meta> = {}
