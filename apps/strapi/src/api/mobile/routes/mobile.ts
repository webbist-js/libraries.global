export default {
  routes: [
    {
      method: "GET",
      path: "/mobile/:documentId/timetable",
      handler: "mobile.timetable",
      config: { auth: false },
    },
  ],
}
