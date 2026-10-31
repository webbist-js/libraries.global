import {
  DismissiblePrompt,
  PromptDismissButton,
} from "@/components/ds/DismissiblePrompt"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect } from "storybook/test"

const meta = {
  title: "Patterns/DismissiblePrompt",
  component: DismissiblePrompt,
  args: {
    prompt: "find-contribute",
    signedIn: false,
    children: (
      <div className="flex items-center justify-between gap-4 rounded-xl border p-5">
        <p>Help keep library records current.</p>
        <PromptDismissButton
          label="Hide prompt"
          className="rounded-full border p-3"
        />
      </div>
    ),
  },
} satisfies Meta<typeof DismissiblePrompt>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Dismiss: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Hide prompt" }))
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "Hidden until you close your browser."
    )
    await expect(canvas.getByRole("status")).toHaveFocus()
  },
}
