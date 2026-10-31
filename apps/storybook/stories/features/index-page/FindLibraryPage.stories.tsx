import { FindLibraryPage } from "@/components/index-page/FindLibraryPage"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { drive } from "../../fixtures/public/drives"
import { findResult } from "../../fixtures/public/find"

const meta = {
  title: "Features/Library search/FindLibraryPage",
  component: FindLibraryPage,
  args: { initial: findResult, statsTotal: 1200, drives: [drive] },
} satisfies Meta<typeof FindLibraryPage>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const NoResults: Story = {
  args: { initial: { ...findResult, hits: [], total: 0, pageCount: 0 } },
}
