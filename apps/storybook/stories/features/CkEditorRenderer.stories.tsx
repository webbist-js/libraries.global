import CkEditorRenderer from "@/components/elementary/ck-editor"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Editorial/Legacy rich text",
  component: CkEditorRenderer,
  args: {
    htmlContent:
      '<h2>Discover the reading rooms</h2><p>A welcoming library with <strong>local history collections</strong> and quiet places to study.</p><ul><li>Step-free access</li><li>Public computers</li></ul><p><a href="/libraries">Browse the library catalogue</a></p><blockquote><p>Everyone is welcome to read, learn and connect.</p></blockquote>',
    variant: "page",
  },
  decorators: [
    (Story) => (
      <div className="max-w-3xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CkEditorRenderer>

export default meta
type Story = StoryObj<typeof meta>

export const Page: Story = {}
export const Blog: Story = { args: { variant: "blog" } }
export const Empty: Story = { args: { htmlContent: null } }
