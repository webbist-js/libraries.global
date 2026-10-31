import DevNavbar from "@/app/[locale]/dev/components/DevNavbar"
import ComponentsList from "@/app/[locale]/dev/components-overview/components/ComponentsList"
import PageList from "@/app/[locale]/dev/pages-overview/components/PageList"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Developers/Overviews",
  args: {
    components: ["content.rich-text", "content.callout", "content.image"],
    pages: [
      {
        documentId: "example-page",
        title: "Contributing to the library index",
        slug: "/knowledge/contributing",
      },
    ],
  },
  render: (args) => <ComponentsList components={args.components} />,
} satisfies Meta<{
  components: string[]
  pages: { documentId: string; title: string; slug: string }[]
}>

export default meta
type Story = StoryObj<typeof meta>

export const Components: Story = {}
export const NoComponents: Story = { args: { components: [] } }
export const Pages: Story = {
  render: (args) => <PageList pages={args.pages} />,
}
export const Navigation: Story = { render: () => <DevNavbar /> }
