import { MainContent } from "@/components/ds/MainContent"
import { SectionNavigation } from "@/components/ds/SectionNavigation"
import { SectionTabs } from "@/components/ds/SectionTabs"
import { StickyPageLayout } from "@/components/ds/StickyPageLayout"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Patterns/StickyPageLayout",
  component: StickyPageLayout,
  args: {
    children: (
      <>
        <header
          data-global-header
          className="sticky top-0 bg-(--t-bg-deep) p-4"
        >
          Global header
        </header>
        <SectionNavigation>
          <SectionTabs
            activeId="overview"
            label="Sections"
            tabs={[
              { id: "overview", label: "Overview", href: "/index" },
              { id: "events", label: "Events", href: "/events" },
            ]}
          />
        </SectionNavigation>
        <div className="grid gap-6 p-6 md:grid-cols-[1fr_240px]">
          <MainContent>
            <h1>Library overview</h1>
            <div className="min-h-[150vh]">
              Scroll to inspect the sticky clearance.
            </div>
          </MainContent>
          <aside className="sticky top-(--sticky-content-top) self-start">
            Sticky sidebar
          </aside>
        </div>
      </>
    ),
  },
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof StickyPageLayout>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
