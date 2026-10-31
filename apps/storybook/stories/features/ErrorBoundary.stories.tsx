import { ErrorBoundary } from "@/components/elementary/ErrorBoundary"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Patterns/Error boundary",
  component: ErrorBoundary,
  args: { children: <p>The library record loaded successfully.</p> },
} satisfies Meta<typeof ErrorBoundary>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
