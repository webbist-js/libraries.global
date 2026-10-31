import { CommunitySectionHeader } from "@/app/[locale]/(dashboard)/community/_components/CommunitySectionHeader"
import { DashboardOverlayContext } from "@/components/dashboard/DashboardOverlayContext"
import { WorkspacePageHeader } from "@/components/dashboard/WorkspaceHero"
import { DiscussionThreadHeading } from "@/components/discussions/DiscussionThreadHeading"
import { Badge } from "@/components/ds/Badge"
import { PageHero } from "@/components/ds/PageHero"
import { Button } from "@/components/ui/button"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, fn } from "storybook/test"

const shell = {
  panel: null,
  trigger: null,
  handleToggle: fn(),
  handleClose: fn(),
}
const meta = {
  title: "Features/Page compositions",
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Actual production header compositions, chosen by purpose. The shell owns section navigation, task headers keep controls near the work, and discussion readers own a single literal title. Synthetic content; no session/CMS providers.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="bg-(--t-bg-space) p-5">
        <Story />
      </div>
    ),
  ],
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const EditorialDirectory: Story = {
  render: () => (
    <PageHero
      variant="card"
      title="Stories *from libraries*"
      lead="Read stories, reports and ideas from the library community."
      eyebrow="Journal"
    />
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getAllByRole("heading", { level: 1 })).toHaveLength(1)
  },
}
export const CommunityInWorkspace: Story = {
  render: () => (
    <DashboardOverlayContext value={shell}>
      <CommunitySectionHeader
        title="The *noticeboard*"
        crumbs={[{ label: "Current work" }]}
        counts={{ noticeboard: 4 }}
        lead="Choose a shared task, join a conversation or follow a drive."
      />
    </DashboardOverlayContext>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getAllByRole("heading", { level: 1 })).toHaveLength(1)
    await expect(canvas.queryByRole("navigation")).not.toBeInTheDocument()
  },
}
export const CommunityStandalone: Story = {
  render: () => (
    <CommunitySectionHeader
      title="Library *conversations*"
      crumbs={[{ label: "Discussions" }]}
      lead="Share what works and ask the community."
    />
  ),
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole("link", { name: /^Community$/ })
    ).toHaveAttribute("href", "/community")
  },
}
export const Task: Story = {
  render: () => (
    <DashboardOverlayContext value={shell}>
      <WorkspacePageHeader
        density="task"
        title="Edit Every *Library* drive"
        context="Community"
        lead="Update the task and review the preview before saving."
        actions={
          <Button size="pill-sm" variant="surface">
            Preview drive
          </Button>
        }
      />
    </DashboardOverlayContext>
  ),
  play: async ({ canvas }) => {
    const heading = canvas.getByRole("heading", {
      name: "Edit Every *Library* drive",
      level: 1,
    })
    await expect(heading.querySelector("em")).toBeNull()
    await expect(
      canvas.getByRole("button", { name: "Preview drive" })
    ).toBeVisible()
  },
}
export const DiscussionReader: Story = {
  render: () => (
    <DiscussionThreadHeading
      title="How do you keep *mobile* stops up to date?"
      language="en"
      context={<Badge color="violet" label="Library life" />}
      activity={
        <span className="text-sm text-(--t-ink-dim)">3 replies · 4 people</span>
      }
      action={
        <Button size="pill-sm" variant="surface">
          Follow conversation
        </Button>
      }
    />
  ),
  play: async ({ canvas }) => {
    const heading = canvas.getByRole("heading", {
      name: "How do you keep *mobile* stops up to date?",
      level: 1,
    })
    await expect(canvas.getAllByRole("heading", { level: 1 })).toHaveLength(1)
    await expect(heading.querySelector("em")).toBeNull()
    await expect(
      canvas.getByRole("link", { name: "All conversations" })
    ).toHaveAttribute("href", "/community/discussions")
  },
}
export const NarrowReader: Story = {
  ...DiscussionReader,
  decorators: [
    (Story) => (
      <div style={{ width: 320, maxWidth: "100%" }}>
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const header = canvasElement.querySelector("header")!
    await expect(header.scrollWidth).toBeLessThanOrEqual(header.clientWidth + 1)
  },
}
