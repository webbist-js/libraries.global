import { LegalDocumentPage } from "@/components/legal/LegalDocumentPage"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { legalDocuments } from "../../fixtures/public/homepage"
import { legalDocument } from "../../fixtures/public/knowledge"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Legal/LegalDocumentPage",
  component: LegalDocumentPage,
  args: { document: legalDocument, documents: legalDocuments, locale: "en" },
  parameters: {
    docs: {
      story: { inline: false, iframeHeight: 900 },
      description: {
        component:
          "This example runs in its own iframe to keep fixture requests, caches and page landmarks independent. Open Canvas to use the interactive Controls.",
      },
    },
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
    react: { rsc: true },
  },
} satisfies Meta<typeof LegalDocumentPage>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Dashboard: Story = { args: { dashboard: true } }
