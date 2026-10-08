export async function GET(
  _req: Request,
  { params }: { params: Promise<{ locale: string }> }
) {
  const { locale } = await params
  const lang = locale === "cs" ? "cs" : "en"

  return Response.json(
    {
      name: "Libraries Global Live",
      short_name: "Libraries Live",
      id: `/${lang}/live`,
      scope: `/${lang}/live`,
      start_url: `/${lang}/live`,
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
