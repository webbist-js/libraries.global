import { ArticleReviewPanel } from "@/components/moderation/ArticleReviewPanel"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Moderation/ArticleReviewPanel",
  component: ArticleReviewPanel,
  args: {
    detail: {
      locale: "en",
      fields: { title: "A welcoming reading room" },
      status: "pending",
      editSummary: "Added practical information for visitors.",
      draftData: {
        title: "A welcoming reading room",
        summary: "A synthetic example article.",
      },
      submissionType: "journal_article",
      targetSlug: "welcoming-reading-room",
      article: {
        current: {
          title: "A reading room",
          summary: "Original summary",
          body: [],
        },
        source: null,
      },
      canPublish: true,
    },
  },
} satisfies Meta<typeof ArticleReviewPanel>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
