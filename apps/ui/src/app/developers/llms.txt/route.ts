import { renderDevelopersLlmsTxt } from "@/lib/agent-discovery"

export const dynamic = "force-dynamic"

export function GET() {
  return new Response(renderDevelopersLlmsTxt(), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  })
}
