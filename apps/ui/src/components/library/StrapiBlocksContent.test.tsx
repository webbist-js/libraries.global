import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

import { StrapiBlocksContent } from "./StrapiBlocksContent"

vi.mock("@/components/global/GlobalLink", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode
    href: string
  }) => <a href={href}>{children}</a>,
}))

describe("public nested lists", () => {
  it("renders the nested list inside its parent list item and retains text and marks", () => {
    const html = renderToStaticMarkup(
      <StrapiBlocksContent
        blocks={[
          {
            type: "list",
            format: "unordered",
            children: [
              {
                type: "list-item",
                children: [{ type: "text", text: "Parent", bold: true }],
              },
              {
                type: "list",
                format: "ordered",
                children: [
                  {
                    type: "list-item",
                    children: [{ type: "text", text: "Child" }],
                  },
                ],
              },
              {
                type: "list-item",
                children: [{ type: "text", text: "Sibling" }],
              },
            ],
          },
        ]}
      />
    )
    expect(html).toMatch(
      /<li>.*<strong[^>]*>Parent<\/strong>.*<ol[^>]*>.*Child.*<\/ol><\/li><li>/
    )
    expect(html).toContain("Sibling")
  })
})
