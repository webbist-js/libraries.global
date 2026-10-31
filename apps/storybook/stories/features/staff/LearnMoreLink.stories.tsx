import { LearnMoreLink } from "@/components/staff/LearnMoreLink"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { asyncStory } from "../../../.storybook/AsyncStory"
import { wikiArticle } from "../../fixtures/public/knowledge"
import {
  readerSession,
  profileResponses,
} from "../../fixtures/workspace/profile"

const meta = {
  title: "Features/Staff/LearnMoreLink",
  component: LearnMoreLink,
  render: asyncStory(LearnMoreLink),
  args: { slug: "staff", locale: "en" },
  parameters: {
    react: { rsc: true },
    serverFixtures: { "content.fetchWikiArticle": { data: wikiArticle } },
    fixtureSession: readerSession,
    fixtureResponses: profileResponses,
    docs: { story: { inline: false } },
  },
} satisfies Meta<typeof LearnMoreLink>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
