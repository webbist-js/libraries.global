export const IRISH_FEEDS = [
  {
    key: "ie-fingal-libraries",
    catalogue: "libraries-fcc2",
    publisher: "Fingal County Council",
    region: "Dublin",
    idField: "F__REF",
    expected: 12,
    service:
      "https://services5.arcgis.com/CI1e5PKQXvJgmJK8/arcgis/rest/services/Libraries__FCC/FeatureServer/0",
  },
  {
    key: "ie-roscommon-libraries",
    catalogue: "libraries-roscommon6",
    publisher: "Roscommon County Council",
    region: "Roscommon",
    idField: "GlobalID",
    expected: 6,
    service:
      "https://services1.arcgis.com/0g8o874l5un2eDgz/arcgis/rest/services/County_Roscommon__Libraries/FeatureServer/0",
  },
  {
    key: "ie-galway-libraries",
    catalogue: "gcc-libraries1",
    publisher: "Galway County Council",
    region: "Galway",
    idField: "GlobalID",
    expected: 30,
    service:
      "https://services1.arcgis.com/mJI7JYqAOKXPG7Hh/arcgis/rest/services/GCC_CS_Libraries/FeatureServer/0",
  },
  {
    key: "ie-south-dublin-libraries",
    catalogue: "library-services-sdcc3",
    publisher: "South Dublin County Council",
    region: "Dublin",
    idField: "Council_ID",
    expected: 7,
    service:
      "https://services1.arcgis.com/PxbTDTskGHCe4sv6/arcgis/rest/services/South_Dublin_Libraries/FeatureServer/0",
  },
] as const

export type IrishFeed = (typeof IRISH_FEEDS)[number]
