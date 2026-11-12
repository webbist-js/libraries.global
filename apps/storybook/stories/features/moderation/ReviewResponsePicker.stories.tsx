import { ReviewResponsePicker } from "@/components/moderation/ReviewResponsePicker"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useArgs } from "storybook/preview-api"

const meta = {
  title: "Features/Moderation/ReviewResponsePicker",
  component: ReviewResponsePicker,
  args: {
    context: { submissionType: "library_claim" },
    note: "",
    onChange: () => {},
  },
  render: function Render(args) {
    const [, updateArgs] = useArgs()

    return (
      <div className="max-w-xl">
        <ReviewResponsePicker
          {...args}
          onChange={(note) => updateArgs({ note })}
        />
        <textarea
          aria-label="Review note"
          className="mt-4 w-full rounded-xl border p-3"
          rows={6}
          value={args.note}
          onChange={(event) => updateArgs({ note: event.target.value })}
        />
      </div>
    )
  },
} satisfies Meta<typeof ReviewResponsePicker>

export default meta
type Story = StoryObj<typeof meta>

export const LibraryClaim: Story = {}
export const Article: Story = {
  args: { context: { submissionType: "blog_submission" } },
}
export const ExistingNote: Story = {
  args: {
    context: {
      submissionType: "option_suggestion",
      itemName: "Quiet study rooms",
    },
    note: "Thank you for the useful example.",
  },
}
export const AtCharacterLimit: Story = { args: { note: "A".repeat(2000) } }
