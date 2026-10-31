import { Container } from "@/components/elementary/Container"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Patterns/Layout/Container",
  component: Container,
  args: {
    children: (
      <div className="rounded-xl border p-6">
        Content aligns with the site’s standard gutters and maximum width.
      </div>
    ),
  },
} satisfies Meta<typeof Container>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const WithoutGutters: Story = { args: { hideDefaultPadding: true } }
