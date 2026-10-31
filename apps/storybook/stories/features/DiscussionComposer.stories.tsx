import { DiscussionComposer } from "@/components/discussions/DiscussionComposer"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useArgs } from "storybook/preview-api"
import { expect, fn, userEvent } from "storybook/test"

import { InteractiveArgs } from "../../.storybook/InteractiveArgs"

const meta = {
  title: "Features/Discussions/Composer",
  component: DiscussionComposer,
  args: {
    threadId: "example-mobile-library",
    subjectId: "example-library-life",
    signedIn: true,
    collapsed: true,
    languages: [
      { code: "en", name: "English" },
      { code: "fr", name: "French" },
      { code: "cs", name: "Czech" },
    ],
    onSubmitted: fn(),
  },
  render: function ComposerStory(supplied) {
    const [, syncControls] = useArgs()

    return (
      <InteractiveArgs args={supplied} onUpdate={syncControls}>
        {(args, updateArgs) => (
          <DiscussionComposer
            {...args}
            onExpand={() => updateArgs({ collapsed: false })}
            onCancel={() => updateArgs({ collapsed: true })}
          />
        )}
      </InteractiveArgs>
    )
  },
  parameters: {
    docs: {
      description: {
        component:
          "The join prompt expands the existing composer. Text, language and attachments remain in component state when it closes. These stories do not submit messages or upload attachments.",
      },
    },
  },
} satisfies Meta<typeof DiscussionComposer>

export default meta
type Story = StoryObj<typeof meta>

export const JoinPrompt: Story = {
  globals: { locale: "en" },
  play: async ({ canvas }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: "Join the conversation" })
    )
    await userEvent.type(
      canvas.getByRole("textbox", { name: "Message" }),
      "Keep this draft"
    )
    await userEvent.click(canvas.getByRole("button", { name: "Cancel" }))
    await expect(
      canvas.queryByRole("textbox", { name: "Message" })
    ).not.toBeInTheDocument()
    await userEvent.click(
      canvas.getByRole("button", { name: "Join the conversation" })
    )
    await expect(canvas.getByRole("textbox", { name: "Message" })).toHaveValue(
      "Keep this draft"
    )
  },
}
export const Expanded: Story = { args: { collapsed: false } }
export const NarrowCzech: Story = {
  args: { collapsed: false },
  globals: { locale: "cs" },
  decorators: [
    (Story) => (
      <div style={{ width: 320, maxWidth: "100%" }}>
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const form = canvasElement.querySelector("form")!
    await expect(form.scrollWidth).toBeLessThanOrEqual(form.clientWidth + 1)
  },
}
