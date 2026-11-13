import type { useTranslations } from "next-intl"

export function createPlaygroundOperations(
  t: ReturnType<typeof useTranslations<"playgroundOperations">>
) {
  return [
    {
      id: "search",
      label: t("search"),
      method: "POST",
      path: "/api/v1/search/libraries",
    },
    {
      id: "list",
      label: t("list"),
      method: "GET",
      path: "/api/v1/libraries",
    },
    {
      id: "read",
      label: t("read"),
      method: "GET",
      path: "/api/v1/libraries/{entityRef}",
    },
    {
      id: "places",
      label: t("places"),
      method: "GET",
      path: "/api/v1/places/{country}/{region}",
    },
    {
      id: "placeLibraries",
      label: t("placeLibraries"),
      method: "GET",
      path: "/api/v1/places/{country}/{region}/{area}/libraries",
    },
    {
      id: "services",
      label: t("services"),
      method: "GET",
      path: "/api/v1/services",
    },
    {
      id: "service",
      label: t("service"),
      method: "GET",
      path: "/api/v1/services/{ref}",
    },
    {
      id: "serviceLibraries",
      label: t("serviceLibraries"),
      method: "GET",
      path: "/api/v1/services/{ref}/libraries",
    },
    {
      id: "summary",
      label: t("summary"),
      method: "POST",
      path: "/api/v1/analysis/summary",
    },
    {
      id: "reach",
      label: t("reach"),
      method: "POST",
      path: "/api/v1/analysis/reach",
    },
    {
      id: "job",
      label: t("job"),
      method: "GET",
      path: "/api/v1/analysis/jobs/{id}",
    },
    {
      id: "jobResult",
      label: t("jobResult"),
      method: "GET",
      path: "/api/v1/analysis/jobs/{id}/result",
    },
    {
      id: "proposal",
      label: t("proposal"),
      method: "GET",
      path: "/api/v1/submissions/{id}",
    },
  ] as const
}
