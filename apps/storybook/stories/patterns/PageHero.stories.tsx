import { PageHero } from "@/components/ds/PageHero"
import { SectionTabs } from "@/components/ds/SectionTabs"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Patterns/PageHero",
  component: PageHero,
  args: {
    title: "Find your next *library*",
    eyebrow: "The library index",
    lead: "Explore libraries, archives and reading rooms around the world.",
    compact: false,
    variant: "band",
  },
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Editorial headers for public pages. Staff and API page headers use Features/Dashboard/WorkspacePageHeader, which fixes the geometry and provides page/task densities. The Workspace example here is PageHero’s existing inline editor mode.",
      },
    },
  },
} satisfies Meta<typeof PageHero>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Compact: Story = { args: { compact: true } }
export const Card: Story = { args: { variant: "card" } }
export const Workspace: Story = {
  args: { workspace: true, title: "Edit library details" },
}
export const PlainUserTitle: Story = {
  args: { title: "My *literal* library name", plainTitle: true },
}
export const WithTabs: Story = {
  args: {
    tabs: (
      <SectionTabs
        label="Library sections"
        activeId="overview"
        tabs={[
          { id: "overview", label: "Overview", href: "/index" },
          { id: "events", label: "Events", href: "/events" },
        ]}
      />
    ),
  },
}
