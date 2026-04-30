type QuickWin = {
  winId: string
  type:
    | "add_library"
    | "add_nearby_library"
    | "verify_hours"
    | "add_hero_image"
    | "translate_wiki"
  title: string
  description: string
  points: number
  estimatedMinutes: number
  rewardLabel: string
  actionUrl: string
  targetEntityRef?: string
  targetSlug?: string
  computedForCountry?: string
  computedForLanguage?: string
}

export default ({ strapi }: { strapi: any }) => ({
  // ── Public API ────────────────────────────────────────────────────────────

  async computeAndSave(baUserId: string): Promise<void> {
    const wins = await (this as any).computeForUser(baUserId)

    const profile = await strapi.db
      .query("api::user-profile.user-profile")
      .findOne({ where: { baUserId } })
    if (!profile) return

    await strapi.documents("api::user-profile.user-profile" as any).update({
      documentId: profile.documentId,
      data: {
        quickWins: wins,
        quickWinsComputedAt: new Date(),
      },
    })
  },

  async computeForUser(baUserId: string): Promise<QuickWin[]> {
    const profile = await strapi.db
      .query("api::user-profile.user-profile")
      .findOne({ where: { baUserId }, populate: { languages: true } })

    if (!profile) return []

    const [libraryWins, nearbyWins, hoursWins, imageWins, wikiWins] =
      await Promise.all([
        (this as any).ruleAddLibrary(profile),
        (this as any).ruleAddNearbyLibrary(profile),
        (this as any).ruleVerifyHours(profile),
        (this as any).ruleAddHeroImage(profile),
        (this as any).ruleTranslateWiki(profile),
      ])

    const all: QuickWin[] = [
      ...libraryWins,
      ...nearbyWins,
      ...hoursWins,
      ...imageWins,
      ...wikiWins,
    ]

    // Deduplicate by winId
    const seen = new Set<string>()
    const deduped = all.filter((w) => {
      if (seen.has(w.winId)) return false
      seen.add(w.winId)

      return true
    })

    // Sort: profile country match first → higher points → shorter time
    const profileCountry = profile.country ?? null
    deduped.sort((a, b) => {
      const aMatch = a.computedForCountry === profileCountry ? 1 : 0
      const bMatch = b.computedForCountry === profileCountry ? 1 : 0
      if (bMatch !== aMatch) return bMatch - aMatch
      if (b.points !== a.points) return b.points - a.points

      return a.estimatedMinutes - b.estimatedMinutes
    })

    return deduped.slice(0, 20)
  },

  // ── Rules ─────────────────────────────────────────────────────────────────

  async ruleAddLibrary(profile: any): Promise<QuickWin[]> {
    const wins: QuickWin[] = []

    if (profile.country) {
      // Find matching country doc
      const countryDoc = await strapi.db.query("api::country.country").findOne({
        where: { name: { $containsi: profile.country } },
      })

      if (countryDoc) {
        const count = await strapi.db.query("api::library.library").count({
          where: {
            country: { id: countryDoc.id },
            publishedAt: { $ne: null },
          },
        })
        if (count < 50) {
          wins.push({
            winId: `add_library-${profile.country.toLowerCase().replaceAll(/\s+/g, "-")}`,
            type: "add_library",
            title: `Add a library in ${countryDoc.name}`,
            description: `${countryDoc.name} has only ${count} ${count === 1 ? "library" : "libraries"} in the index. Add one you know.`,
            points: 50,
            estimatedMinutes: 10,
            rewardLabel: "CARTOGRAPHER",
            actionUrl: "/contribute/add",
            computedForCountry: profile.country,
          })
        }
      }
    }

    // Always add a generic global win as fallback
    wins.push({
      winId: "add_library-global",
      type: "add_library",
      title: "Add a missing library",
      description:
        "Know a library that isn't in the atlas? Add it and earn 50 points.",
      points: 50,
      estimatedMinutes: 10,
      rewardLabel: "CARTOGRAPHER",
      actionUrl: "/contribute/add",
    })

    return wins
  },

  async ruleAddNearbyLibrary(profile: any): Promise<QuickWin[]> {
    if (!profile.city) return []

    // Find published libraries in the same city
    const libraries = await strapi.db.query("api::library.library").findMany({
      where: {
        city: { $containsi: profile.city },
        publishedAt: { $ne: null },
      },
      limit: 3,
      select: ["id", "name", "slug", "entityRef", "city"],
    })

    return libraries.map((lib: any) => ({
      winId: `add_nearby_library-${lib.entityRef ?? lib.slug}`,
      type: "add_nearby_library" as const,
      title: `Add a branch near ${lib.name}`,
      description: `${lib.name} in ${lib.city} may have branches not yet in the atlas. Add one you know.`,
      points: 12,
      estimatedMinutes: 2,
      rewardLabel: "PIN",
      actionUrl: "/contribute/add",
      targetEntityRef: lib.entityRef ?? undefined,
      computedForCountry: profile.country ?? undefined,
    }))
  },

  async ruleVerifyHours(profile: any): Promise<QuickWin[]> {
    const cutoff = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000)
    const where: Record<string, unknown> = {
      publishedAt: { $ne: null },
      $or: [
        { lastVerifiedAt: { $lt: cutoff.toISOString() } },
        { lastVerifiedAt: { $null: true } },
      ],
    }

    // Try country-filtered first
    if (profile.country) {
      const countryDoc = await strapi.db
        .query("api::country.country")
        .findOne({ where: { name: { $containsi: profile.country } } })
      if (countryDoc) {
        where.country = { id: countryDoc.id }
      }
    }

    const libraries = await strapi.db.query("api::library.library").findMany({
      where,
      orderBy: { lastVerifiedAt: "asc" },
      limit: 4,
      select: ["id", "name", "slug", "entityRef", "lastVerifiedAt"],
    })

    return libraries.map((lib: any) => {
      const monthsAgo = lib.lastVerifiedAt
        ? Math.floor(
            (Date.now() - new Date(lib.lastVerifiedAt).getTime()) /
              (30 * 24 * 60 * 60 * 1000)
          )
        : null
      const ageText = monthsAgo
        ? `Last verified ${monthsAgo} month${monthsAgo === 1 ? "" : "s"} ago.`
        : "Never verified."

      return {
        winId: `verify_hours-${lib.entityRef ?? lib.slug}`,
        type: "verify_hours" as const,
        title: `Confirm hours · ${lib.name}`,
        description: `${ageText} Has anything changed?`,
        points: 5,
        estimatedMinutes: 1,
        rewardLabel: "VERIFIER",
        actionUrl: `/contribute/edit/${lib.slug}`,
        targetEntityRef: lib.entityRef ?? undefined,
        computedForCountry: profile.country ?? undefined,
      }
    })
  },

  async ruleAddHeroImage(profile: any): Promise<QuickWin[]> {
    const where: Record<string, unknown> = {
      publishedAt: { $ne: null },
      heroImage: { $null: true },
    }

    if (profile.country) {
      const countryDoc = await strapi.db
        .query("api::country.country")
        .findOne({ where: { name: { $containsi: profile.country } } })
      if (countryDoc) {
        where.country = { id: countryDoc.id }
      }
    }

    const libraries = await strapi.db.query("api::library.library").findMany({
      where,
      limit: 3,
      select: ["id", "name", "slug", "entityRef"],
    })

    return libraries.map((lib: any) => ({
      winId: `add_hero_image-${lib.entityRef ?? lib.slug}`,
      type: "add_hero_image" as const,
      title: `Add a hero image`,
      description: `${lib.name} has no photography in the atlas yet.`,
      points: 8,
      estimatedMinutes: 3,
      rewardLabel: "PHOTOGRAPHER",
      actionUrl: `/contribute/edit/${lib.slug}`,
      targetEntityRef: lib.entityRef ?? undefined,
      computedForCountry: profile.country ?? undefined,
    }))
  },

  async ruleTranslateWiki(profile: any): Promise<QuickWin[]> {
    const languages: { code: string }[] = Array.isArray(profile.languages)
      ? profile.languages
      : []
    if (languages.length === 0) return []

    const wins: QuickWin[] = []

    for (const lang of languages.slice(0, 3)) {
      // Find wiki articles that don't have a localisation for this language
      // Query articles in English that are missing the target locale
      try {
        const articles = await strapi.db
          .query("api::wiki-article.wiki-article")
          .findMany({
            where: {
              publishedAt: { $ne: null },
              locale: "en",
            },
            limit: 2,
            select: ["id", "documentId", "title", "slug"],
          })

        for (const article of articles) {
          // Check if a localisation exists for this language
          const localised = await strapi.db
            .query("api::wiki-article.wiki-article")
            .findOne({
              where: { documentId: article.documentId, locale: lang.code },
            })

          if (!localised) {
            wins.push({
              winId: `translate_wiki-${article.slug}-${lang.code}`,
              type: "translate_wiki",
              title: `Translate one wiki page`,
              description: `"${article.title}" is missing ${lang.code.toUpperCase()}. You're a marked native reviewer.`,
              points: 15,
              estimatedMinutes: 5,
              rewardLabel: "TRANSLATOR",
              actionUrl: `/contribute/wiki/${article.slug}`,
              targetSlug: article.slug,
              computedForLanguage: lang.code,
            })
            break // one win per language
          }
        }
      } catch {
        // wiki-article content type may not exist — skip silently
      }
    }

    return wins
  },
})
