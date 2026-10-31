import { ArticleReaderActions } from "@/components/articles/ArticleReaderActions"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { blogArticle } from "../../fixtures/public/articles"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Articles/ArticleReaderActions",
  component: ArticleReaderActions,
  args: {
    kind: "journal",
    slug: blogArticle.slug!,
    path: "/journal/a-reading-room-for-everyone",
    contentLocale: "en",
    interfaceLocale: "en",
    availableLocales: ["en", "fr"],
    authorUsername: "example-maya",
  },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof ArticleReaderActions>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
