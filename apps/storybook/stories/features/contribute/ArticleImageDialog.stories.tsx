import { ArticleImageDialog } from "@/components/contribute/article-editor/ArticleImageDialog"
import { Button } from "@/components/ui/button"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useState, type ComponentProps } from "react"
import { fn } from "storybook/test"

import { articleImageFile } from "../../fixtures/public/image"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

function ImageDialogPreview(args: ComponentProps<typeof ArticleImageDialog>) {
  const [open, setOpen] = useState(true)

  return open ? (
    <ArticleImageDialog
      {...args}
      onClose={() => {
        args.onClose()
        setOpen(false)
      }}
    />
  ) : (
    <Button onClick={() => setOpen(true)}>Choose an article image</Button>
  )
}
const meta = {
  title: "Features/Contribute/ArticleImageDialog",
  component: ArticleImageDialog,
  args: {
    file: articleImageFile,
    requireCredit: true,
    readOnly: false,
    onClose: fn(),
    onChooseAnother: fn(),
    onInsert: async () => true,
  },
  render: (args) => <ImageDialogPreview {...args} />,
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
    docs: {
      description: {
        component:
          "This example runs in its own iframe to keep fixture requests, caches and page landmarks independent. Open Canvas to use the interactive Controls.",
      },
      story: { inline: false, iframeHeight: 800 },
    },
  },
} satisfies Meta<typeof ArticleImageDialog>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const ReadOnly: Story = { args: { readOnly: true } }

export const UnsupportedFile: Story = {
  args: {
    file: new File(["Example unsupported image data"], "example.txt", {
      type: "text/plain",
    }),
  },
}
