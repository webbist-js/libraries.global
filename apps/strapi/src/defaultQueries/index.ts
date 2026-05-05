import mergeWith from "lodash/mergeWith"

const mergeQueryCustomizer = (objValue: unknown, srcValue: unknown) => {
  if (Array.isArray(srcValue)) {
    return srcValue
  }
}

export const seoPopulate = {
  populate: {
    metaImage: true,
    openGraph: { populate: { ogImage: true } },
  },
}

export const linkPopulate = {
  populate: {
    page: { fields: ["slug"] },
    decorations: { populate: { leftIcon: true, rightIcon: true } },
  },
}

export const basicImagePopulate = { populate: { media: true } }

export const homepageLibraryPopulate = {
  fields: [
    "name",
    "shortName",
    "summary",
    "slug",
    "city",
    "libraryType",
    "website",
  ],
  populate: {
    heroImage: true,
    country: { fields: ["name"] },
    continent: { fields: ["name", "code"] },
  },
}

export const pageDefaultQuery = {
  localizations: true,
  populate: {
    seo: seoPopulate,
  },
}

export const homepageDefaultQuery = {
  localizations: true,
  populate: {
    seo: seoPopulate,
    featuredLibraries: homepageLibraryPopulate,
    featuredServices: {
      fields: ["name", "summary", "category", "icon"],
    },
  },
}

export const footerDefaultQuery = {
  populate: {
    sections: { populate: { links: linkPopulate } },
    links: linkPopulate,
    socialLinks: true,
  },
}

export function applyDefaultQuery(
  query: Record<string, unknown> | undefined,
  defaultQuery: Record<string, unknown>
) {
  return mergeWith({}, defaultQuery, query ?? {}, mergeQueryCustomizer)
}
