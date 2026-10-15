import { DEFAULT_LOCALE, isSupportedLocale } from "@repo/shared-data"

import { mobilePath } from "@/lib/mobile-app"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ locale: string }> }
) {
  const { locale } = await params
  const lang = isSupportedLocale(locale) ? locale : DEFAULT_LOCALE
  const mobile = req.headers.get("x-mobile-app") === "true"

  return Response.json(
    {
      name: "Libraries Global Live",
      short_name: "Libraries Live",
      id: mobile ? "/" : `/${lang}/live`,
      scope: mobile ? "/" : `/${lang}/live`,
      start_url: mobile ? mobilePath(undefined, lang) : `/${lang}/live`,
      display: "standalone",
      background_color: "#F7F5EF",
      theme_color: "#3730A3",
      icons: [
        {
          src: "/live-icon.svg",
          sizes: "any",
          type: "image/svg+xml",
          purpose: "any maskable",
        },
      ],
    },
    {
      headers: {
        "Content-Type": "application/manifest+json",
        "Cache-Control": "public, max-age=3600",
      },
    }
  )
}
