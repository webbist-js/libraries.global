import {
  SiteSearchMount,
  SiteSearchTrigger,
} from "@/components/global/SiteSearch"
import type { SiteSearchResponse } from "@/lib/site-search"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, within } from "storybook/test"

const results = {
  items: [
    {
      id: "example-library",
      group: "libraries",
      title: "Northbridge Community Library",
      summary: "Public reading rooms and local history collections.",
      href: "/libraries/northbridge",
    },
    {
      id: "example-guide",
      group: "knowledge",
      title: "How to check opening hours",
      summary: "A guide to staffed and self-service opening periods.",
      href: "/knowledge/opening-hours",
    },
  ],
  counts: { libraries: 1, knowledge: 1 },
  estimated: [],
  unavailable: [],
} satisfies SiteSearchResponse
const meta = {
  title: "Patterns/Site search",
  component: SiteSearchMount,
  parameters: {
    docs: { story: { inline: false, height: "640px" } },
    fixtureResponses: { "GET /api/site-search": { body: results } },
  },
  render: () => (
    <>
      <SiteSearchTrigger />
      <SiteSearchMount />
    </>
  ),
} satisfies Meta<typeof SiteSearchMount>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Search: Story = {
  play: async ({ canvas, userEvent, canvasElement }) => {
    await userEvent.click(canvas.getByRole("button"))
    const page = within(canvasElement.ownerDocument.body)
    const field = await page.findByRole("combobox")
    await userEvent.type(field, "Northbridge")
    await expect(
      await page.findByRole("option", { name: /Northbridge Community Library/ })
    ).toBeVisible()
  },
}
export const NoResults: Story = {
  play: async ({ canvas, userEvent, canvasElement }) => {
    await userEvent.click(canvas.getByRole("button"))
    const page = within(canvasElement.ownerDocument.body)
    await userEvent.type(await page.findByRole("combobox"), "Northbridge")
    await expect(
      await page.findByRole("heading", {
        name: "Nothing matches “Northbridge”",
      })
    ).toBeVisible()
  },
  parameters: {
    fixtureResponses: {
      "GET /api/site-search": {
        body: { items: [], counts: {}, estimated: [], unavailable: [] },
      },
    },
  },
}
export const Unavailable: Story = {
  play: async ({ canvas, userEvent, canvasElement }) => {
    await userEvent.click(canvas.getByRole("button"))
    const page = within(canvasElement.ownerDocument.body)
    await userEvent.type(await page.findByRole("combobox"), "Northbridge")
    await expect(await page.findByRole("alert")).toBeVisible()
  },
  parameters: {
    fixtureResponses: {
      "GET /api/site-search": {
        status: 503,
        body: { error: "Example search outage" },
      },
    },
  },
}
