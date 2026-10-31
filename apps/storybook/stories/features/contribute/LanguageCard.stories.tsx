import { LanguageCard } from "@/components/contribute/article-editor/ArticleSidebar"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useArgs } from "storybook/preview-api"
import { fn } from "storybook/test"

import { InteractiveArgs } from "../../../.storybook/InteractiveArgs"
import { editorLocales } from "../../fixtures/public/editor"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Contribute/LanguageCard",
  component: LanguageCard,
  args: {
    mode: "edit",
    locale: "en",
    locales: editorLocales,
    sourceLocale: "en",
    availableLocales: ["en"],
    onChange: fn(),
  },
  render: function Render(args) {
    const [, updateArgs] = useArgs()

    return (
      <InteractiveArgs args={args} onUpdate={updateArgs}>
        {(live, update) => (
          <LanguageCard
            {...live}
            onChange={(locale) => {
              live.onChange(locale)
              update({ locale })
            }}
          />
        )}
      </InteractiveArgs>
    )
  },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof LanguageCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Translation: Story = { args: { locale: "fr" } }
