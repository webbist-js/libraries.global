/**
 * Minimal client for Strapi's built-in MCP server (Streamable HTTP, POST /mcp).
 *
 * Every call runs through the content-manager tools the server exposes
 * (list_library, create_library, publish_library, ...), so imports get the
 * same validation and RBAC as an editor working in the admin panel.
 *
 * Env: STRAPI_URL (default http://127.0.0.1:1337), STRAPI_MCP_TOKEN (admin token)
 */

const STRAPI_URL = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"

export class McpToolError extends Error {
  constructor(
    public tool: string,
    message: string
  ) {
    super(`${tool}: ${message}`)
  }
}

export interface ListResult<T> {
  results: T[]
  pagination?: {
    page: number
    pageSize: number
    pageCount: number
    total: number
  }
}

export class StrapiMcpClient {
  private sessionId: string | null = null
  private nextId = 1

  constructor(
    private token = process.env.STRAPI_MCP_TOKEN ?? "",
    private url = `${STRAPI_URL}/mcp`
  ) {
    if (!token) throw new Error("STRAPI_MCP_TOKEN is not set")
  }

  private async rpc(method: string, params: unknown): Promise<unknown> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.token}`,
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    }
    if (this.sessionId) headers["Mcp-Session-Id"] = this.sessionId

    const res = await fetch(this.url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: this.nextId++,
        method,
        params,
      }),
    })
    const session = res.headers.get("mcp-session-id")
    if (session) this.sessionId = session

    const text = await res.text()
    if (!res.ok)
      throw new Error(`MCP HTTP ${res.status}: ${text.slice(0, 500)}`)

    const body = text.trimStart().startsWith("{")
      ? text
      : text
          .split("\n")
          .filter((l) => l.startsWith("data:"))
          .map((l) => l.slice(5))
          .join("")
    const msg = JSON.parse(body) as {
      result?: unknown
      error?: { message: string }
    }
    if (msg.error) throw new Error(`MCP ${method}: ${msg.error.message}`)

    return msg.result
  }

  async initialize(): Promise<void> {
    await this.rpc("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "libraryon-import", version: "1.0.0" },
    })
  }

  /** Calls a tool and returns its parsed JSON payload. */
  async call<T = unknown>(
    tool: string,
    args: Record<string, unknown>
  ): Promise<T> {
    const result = (await this.rpc("tools/call", {
      name: tool,
      arguments: args,
    })) as { content?: { type: string; text: string }[]; isError?: boolean }
    const text = result.content?.find((c) => c.type === "text")?.text ?? ""
    if (result.isError) throw new McpToolError(tool, text.slice(0, 1000))
    try {
      return JSON.parse(text) as T
    } catch {
      return text as T
    }
  }

  /** Pages through a list_* tool and returns every result. */
  async listAll<T>(
    contentType: string,
    args: Record<string, unknown> = {}
  ): Promise<T[]> {
    const all: T[] = []
    for (let page = 1; ; page++) {
      const res = await this.call<ListResult<T>>(`list_${contentType}`, {
        ...args,
        page,
        pageSize: 100,
      })
      all.push(...res.results)
      if (!res.pagination || page >= res.pagination.pageCount) break
    }

    return all
  }
}
