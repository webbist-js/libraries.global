/** Narrow server-side Document Service boundary used by access workflows. */
export type Identity = { documentId: string }
export type RecordInput = Record<string, unknown>
export type DocumentStore<Row> = {
  findOne: (args: Record<string, unknown>) => Promise<Row | null>
  findFirst: (args: Record<string, unknown>) => Promise<Row | null>
  findMany: (args: Record<string, unknown>) => Promise<Row[]>
  count: (args: Record<string, unknown>) => Promise<number>
  create: (args: Record<string, unknown>) => Promise<Row>
  update: (args: Record<string, unknown>) => Promise<Row>
}
export type DocumentRuntime = {
  documents: (uid: string) => unknown
  db: {
    transaction: <T>(
      work: (state: {
        trx: { raw: (sql: string, bindings: string[]) => Promise<unknown> }
      }) => Promise<T>
    ) => Promise<T>
  }
}
