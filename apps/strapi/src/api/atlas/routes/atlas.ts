export default {
  routes: [
    {
      method: "POST",
      path: "/atlas/plans/sync",
      handler: "atlas.syncPlanCopy",
      config: { auth: false },
    },
    {
      method: "POST",
      path: "/atlas/population/local/import",
      handler: "atlas.ingestLocalPopulation",
      config: { auth: false },
    },
    {
      method: "GET",
      path: "/atlas/population/local",
      handler: "atlas.localPopulation",
      config: { auth: false },
    },
    {
      method: "POST",
      path: "/atlas/population/import",
      handler: "atlas.ingestPopulation",
      config: { auth: false },
    },
    {
      method: "GET",
      path: "/atlas/countries",
      handler: "atlas.countries",
      config: { auth: false },
    },
    {
      method: "GET",
      path: "/atlas/library",
      handler: "atlas.library",
      config: { auth: false },
    },
    {
      method: "POST",
      path: "/atlas/export-validation",
      handler: "atlas.exportValidation",
      config: { auth: false },
    },
    {
      method: "POST",
      path: "/atlas/changes",
      handler: "atlas.changes",
      config: { auth: false },
    },
    {
      method: "GET",
      path: "/atlas/archive-source",
      handler: "atlas.archive",
      config: { auth: false },
    },
    {
      method: "GET",
      path: "/atlas/projection-source",
      handler: "atlas.scan",
      config: { auth: false },
    },
    {
      method: "POST",
      path: "/atlas/projection-source",
      handler: "atlas.batch",
      config: { auth: false },
    },
    {
      method: "GET",
      path: "/atlas/state",
      handler: "atlas.state",
      config: { auth: false },
    },
  ],
}
