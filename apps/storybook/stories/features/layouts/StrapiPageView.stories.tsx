import StrapiPageView from "@/components/layouts/StrapiPageView"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Layouts/StrapiPageView",
  component: StrapiPageView,
  args: { params: { locale: "en", rest: ["example-public-page"] } },
  parameters: {
    react: { rsc: true },
    serverFixtures: {
      "content.fetchPage": {
        data: {
          id: 1,
          documentId: "example-page",
          title: "Example public page",
          slug: "example-public-page",
          seo: {
            structuredData: {
              "@context": "https://schema.org",
              "@type": "WebPage",
              name: "Example public page",
            },
          },
        },
      },
    },
    docs: {
      story: { inline: false, iframeHeight: 900 },
      description: {
        component:
          "The production CMS route shell. Its current implementation renders an empty MainContent landmark; CMS component rendering is covered separately in Page Builder." +
          " This example runs in its own iframe to keep fixture requests, caches and page landmarks independent. Open Canvas to use the interactive Controls.",
      },
    },
  },
} satisfies Meta<typeof StrapiPageView>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
