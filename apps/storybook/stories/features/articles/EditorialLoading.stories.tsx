import {
  EditorialLoading,
  LoadingBlock,
  LoadingPanel,
  LoadingParagraph,
  LoadingSectionNavigation,
  LoadingArticleHeader,
  LoadingArticleBody,
  LoadingArticleAside,
  LoadingDiscussion,
  LoadingContributionCard,
} from "@/components/articles/EditorialLoading"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Articles/EditorialLoading",
  component: EditorialLoading,
  args: {
    children: (
      <>
        <LoadingSectionNavigation />
        <LoadingArticleHeader />
        <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
          <LoadingPanel>
            <LoadingArticleBody />
            <LoadingParagraph short />
            <LoadingDiscussion />
          </LoadingPanel>
          <aside>
            <LoadingArticleAside />
            <LoadingContributionCard />
            <LoadingBlock className="h-10" />
          </aside>
        </div>
      </>
    ),
  },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof EditorialLoading>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
