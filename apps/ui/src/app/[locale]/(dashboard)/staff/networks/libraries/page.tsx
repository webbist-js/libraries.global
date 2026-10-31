import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { WorkspacePageHeader } from "@/components/dashboard/WorkspaceHero"
import { Container } from "@/components/elementary/Container"
import { STAFF_FIELD, STAFF_LINK } from "@/components/staff/StaffPanel"
import { Button } from "@/components/ui/button"
import { getSessionSSR } from "@/lib/auth-server"
import { Link } from "@/lib/navigation"
import { fetchStaff } from "@/lib/staff-proxy"

export default async function ServiceStaffLibraries({
  searchParams,
}: {
  readonly searchParams: Promise<{
    networkId?: string
    page?: string
    q?: string
  }>
}) {
  const session = await getSessionSSR(await headers()),
    query = await searchParams
  if (!session?.user) redirect("/auth/signin?callbackUrl=%2Fstaff%2Fnetworks")
  const params = new URLSearchParams({
    page: String(Math.max(1, Number(query.page) || 1)),
    ...(query.networkId ? { networkId: query.networkId } : {}),
    ...(query.q ? { q: query.q.slice(0, 120) } : {}),
  })
  const result = await fetchStaff<{
      libraries: { documentId: string; name: string; slug: string }[]
      total: number
      page: number
    }>(session.user, `networks/staff?${params}`, "access"),
    data = result.body
  if (!data || result.status !== 200)
    throw new Error("Service libraries are temporarily unavailable.")
  const next = new URLSearchParams(params)
  next.set("page", String(data.page + 1))
  const previous = new URLSearchParams(params)
  previous.set("page", String(data.page - 1))

  return (
    <>
      <WorkspacePageHeader
        title="Your libraries"
        lead={`${data.total} libraries with approved staff access.`}
      />
      <Container className="space-y-6 py-10">
        <Link className={STAFF_LINK} href="/staff/networks">
          Service management
        </Link>
        <form
          method="get"
          className="flex flex-wrap items-end gap-3"
          aria-label="Find a staff library"
        >
          {query.networkId ? (
            <input type="hidden" name="networkId" value={query.networkId} />
          ) : null}
          <label className="grid gap-2">
            Library name
            <input
              name="q"
              defaultValue={query.q ?? ""}
              maxLength={120}
              className={STAFF_FIELD}
            />
          </label>
          <Button type="submit" variant="surface">
            Find libraries
          </Button>
        </form>
        {data.libraries.length === 0 ? (
          <p>No staff libraries match this selection.</p>
        ) : null}
        <ul className="m-0 grid list-none gap-4 p-0 md:grid-cols-2">
          {data.libraries.map((row) => (
            <li
              key={row.documentId}
              className="rounded-xl border border-(--t-border-line) bg-(--t-bg-deep) p-5"
            >
              <h2 className="type-h2">{row.name}</h2>
              <Link className={STAFF_LINK} href={`/staff/${row.slug}`}>
                Open Staff area
              </Link>
            </li>
          ))}
        </ul>
        <nav aria-label="Staff library pages" className="flex justify-between">
          {data.page > 1 ? (
            <Link href={`/staff/networks/libraries?${previous}`}>Previous</Link>
          ) : (
            <span />
          )}
          {data.page * 48 < data.total ? (
            <Link href={`/staff/networks/libraries?${next}`}>Next</Link>
          ) : null}
        </nav>
      </Container>
    </>
  )
}
