import { AtlasExplorer } from "@/components/atlas/AtlasExplorer"
import { DashboardFrame } from "@/components/dashboard/DashboardFrame"
import { DashboardNavigation } from "@/components/dashboard/DashboardNavigation"
import { MainContent } from "@/components/ds/MainContent"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, waitFor } from "storybook/test"

import { geographyResponses } from "../../fixtures/geography/responses"

function AtlasMobileViewport() {
  return (
    // Mobile browser chrome can make a 100vh document taller than the 100dvh
    // workspace. Keep that difference reproducible in desktop browser reviews.
    <div style={{ minHeight: "calc(100dvh + 64px)" }}>
      <DashboardFrame
        navigation={
          <DashboardNavigation
            links={[
              { href: "/map", label: "Atlas", icon: "atlas" },
              { href: "/community", label: "Community", icon: "community" },
              { href: "/journal", label: "Journal", icon: "journal" },
            ]}
            auth={null}
          />
        }
      >
        <MainContent className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-clip">
          <AtlasExplorer scalable={false} />
        </MainContent>
      </DashboardFrame>
    </div>
  )
}

const meta = {
  title: "Features/Atlas/Mobile viewport",
  component: AtlasMobileViewport,
  parameters: {
    layout: "fullscreen",
    fixtureResponses: geographyResponses,
    nextjs: { navigation: { pathname: "/map" } },
    docs: {
      story: { inline: false, height: "750px" },
      description: {
        component:
          "Review below 768px wide. The document is deliberately taller than the visible viewport to reproduce mobile browser chrome and document scroll. The Atlas must stay flush with the bottom navigation.",
      },
    },
  },
} satisfies Meta<typeof AtlasMobileViewport>

export default meta
type Story = StoryObj<typeof meta>

export const ScrolledDocument: Story = {
  play: async ({ canvasElement }) => {
    const document = canvasElement.ownerDocument
    const window = document.defaultView!
    if (window.innerWidth >= 768) return
    window.scrollTo(0, 64)
    await waitFor(() => {
      const atlas = canvasElement.querySelector(".atlas-motion")!
      const navigation = canvasElement.querySelector(
        ".dashboard-global-actions"
      )!
      expect(
        Math.abs(
          atlas.getBoundingClientRect().bottom -
            navigation.getBoundingClientRect().top
        )
      ).toBeLessThanOrEqual(1)
    })
  },
}
