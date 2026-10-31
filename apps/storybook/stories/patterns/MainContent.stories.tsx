import { MainContent } from "@/components/ds/MainContent"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Patterns/MainContent",
  component: MainContent,
  args: {
    children: (
      <>
        <h1>Page heading</h1>
        <MainContent>
          <p>Nested content shares the outer main landmark.</p>
        </MainContent>
      </>
    ),
  },
} satisfies Meta<typeof MainContent>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
