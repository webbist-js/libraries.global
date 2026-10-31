import { LibraryAboutDisclosure } from "@/components/library/LibraryAboutDisclosure"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Library/LibraryAboutDisclosure",
  component: LibraryAboutDisclosure,
  args: {
    label: "About this library",
    title: "A library for the whole community",
    children:
      "Explore the local history collection, find a quiet place to read or join a weekly activity.",
    links: <a href="/libraries">Browse more libraries</a>,
  },
} satisfies Meta<typeof LibraryAboutDisclosure>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
