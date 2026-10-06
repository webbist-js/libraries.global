// No REST routes. A hidden ledger: written and read only by
// `api::drive.drive`'s `holdLibrary`/`releaseHold`/`activeHolds`, through
// the bridge-gated `/drives/:documentId/holds` routes on the drive router.
export default { routes: [] }
