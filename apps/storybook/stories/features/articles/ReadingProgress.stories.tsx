import { ReadingProgress } from "@/components/articles/ReadingProgress"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Articles/ReadingProgress",
  component: ReadingProgress,
  args: { bodyId: "example-article-body", minutes: 5 },
  render: (args) => (
    <>
      <ReadingProgress {...args} />
      <article id={args.bodyId} className="max-w-2xl space-y-10">
        {Array.from({ length: 12 }, (_, n) => (
          <p key={n}>
            A library can offer a place to read, learn and meet people. This
            synthetic article lets the real reading-progress control respond to
            scrolling.
          </p>
        ))}
      </article>
    </>
  ),
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof ReadingProgress>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
