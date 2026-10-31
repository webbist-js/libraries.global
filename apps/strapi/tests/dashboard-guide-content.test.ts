import { expect, it } from "vitest"

import { dashboardGuideBody } from "../scripts/dashboard-guide-content.mjs"

it("updates retired moderation links in any guide without changing unrelated content", () => {
  const doc = {
    slug: "how-review-works",
    body: [
      {
        __component: "content.rich-text",
        id: 3,
        body: [
          {
            type: "paragraph",
            children: [
              { type: "text", text: "Review the source." },
              {
                type: "link",
                url: "/contribute/moderation?queue=index",
                children: [{ type: "text", text: "Moderation" }],
              },
            ],
          },
        ],
      },
    ],
  }
  const revised = dashboardGuideBody(doc, "en")
  expect(JSON.stringify(revised)).toContain('"url":"/moderation?queue=index"')
  expect(JSON.stringify(revised)).toContain('"text":"Review the source."')
  expect(doc.body[0].body[0].children[1].url).toBe(
    "/contribute/moderation?queue=index"
  )
  expect(dashboardGuideBody({ ...doc, body: revised }, "en")).toEqual(revised)
})
it.each(["en", "fr", "cs"])(
  "adds profile-drawer guidance once in %s",
  (locale) => {
    const doc = {
      slug: "your-account-and-profile",
      body: [
        {
          __component: "content.rich-text",
          body: [
            {
              type: "paragraph",
              children: [{ type: "text", text: "Existing privacy choices." }],
            },
          ],
        },
      ],
    }
    const revised = dashboardGuideBody(doc, locale)
    expect(revised[0].body).toHaveLength(3)
    expect(dashboardGuideBody({ ...doc, body: revised }, locale)).toEqual(
      revised
    )
    expect(revised[0].body[0]).toEqual(doc.body[0].body[0])
  }
)
