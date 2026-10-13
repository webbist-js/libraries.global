import { readFileSync } from "node:fs"
import { parseEnv } from "node:util"

/** Official remote MCP transport. Keys stay in memory; callers redact results. */
export class StripeMcpClient {
  constructor(mode = "sandbox") {
    if (!["sandbox", "live"].includes(mode))
      throw new Error("Invalid Stripe mode")
    const source = parseEnv(
      readFileSync(new URL("../../strapi/.env", import.meta.url), "utf8")
    )
    this.mode = mode
    Object.defineProperty(this, "key", {
      value: mode === "live" ? source.STRIPE_MCP : source.STRIPE_SANDBOX,
    })
    const suffix = mode === "live" ? "live" : "test"
    if (
      !this.key?.startsWith(`sk_${suffix}_`) &&
      !this.key?.startsWith(`rk_${suffix}_`)
    )
      throw new Error("Stripe MCP credential mode mismatch")
    this.nextId = 0
  }

  async rpc(method, params, notification = false) {
    const id = ++this.nextId
    const response = await fetch("https://mcp.stripe.com", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.key}`,
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        "MCP-Protocol-Version": "2025-03-26",
        ...(this.session ? { "Mcp-Session-Id": this.session } : {}),
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        ...(notification ? {} : { id }),
        method,
        params,
      }),
      signal: AbortSignal.timeout(45_000),
    })
    this.session = response.headers.get("mcp-session-id") ?? this.session
    if (!response.ok) throw new Error(`Stripe MCP HTTP ${response.status}`)
    const body = await response.text()
    if (!body) return null
    let message
    message = body.trimStart().startsWith("{")
      ? JSON.parse(body)
      : body
          .split("\n")
          .filter((line) => line.startsWith("data:"))
          .map((line) => JSON.parse(line.slice(5)))
          .find((value) => value.id === id)
    if (!message || message.error)
      throw new Error(
        `Stripe MCP protocol error ${message?.error?.code ?? "response_missing"}`
      )

    return message.result
  }

  async initialize() {
    const result = await this.rpc("initialize", {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "libraries-global-billing", version: "2.0.0" },
    })
    if (result?.serverInfo?.name !== "stripe-mcp")
      throw new Error("Unexpected Stripe MCP server")
    await this.rpc("notifications/initialized", {}, true)
  }

  async call(name, args = {}) {
    const allowed = [
      "get_stripe_account_info",
      "stripe_api_search",
      "stripe_api_details",
      "stripe_api_read",
      "stripe_api_write",
    ]
    if (!allowed.includes(name)) throw new Error("Unsupported billing MCP tool")
    const result = await this.rpc("tools/call", { name, arguments: args })
    if (result?.isError) {
      const error = new Error(
        "Stripe MCP tool refused the request; inspect privately"
      )
      Object.defineProperty(error, "privateResult", { value: result })
      throw error
    }
    const text =
      result?.content
        ?.filter((item) => item.type === "text")
        .map((item) => item.text)
        .join("\n") ?? ""
    try {
      return JSON.parse(text)
    } catch {
      return { text }
    }
  }
}
