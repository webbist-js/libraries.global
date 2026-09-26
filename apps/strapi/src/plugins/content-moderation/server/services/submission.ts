import { payloadHash } from "../utils/payload-hash"

export default ({ strapi }: { strapi: any }) => ({
  async create(data: {
    submissionType: string
    targetEntityType?: string
    targetDocumentId?: string
    targetSlug?: string
    fields?: Record<string, unknown>
    draftData?: Record<string, unknown>
    note?: string
    verificationMethod?: string
    editSummary?: string
    evidenceType?: string
    evidenceUrl?: string
    submittedByUserId: string
    submittedByEmail: string
    submittedByName?: string
    asDraft?: boolean
  }) {
    const { asDraft, ...rest } = data
    const status = asDraft ? "draft" : "pending"

    return strapi.documents("plugin::content-moderation.submission").create({
      data: {
        ...rest,
        status,
        ...(status === "pending" ? { payloadHash: payloadHash(rest) } : {}),
      },
    })
  },

  async findAll(status?: string) {
    const filters: Record<string, unknown> = {
      status: status ? status : { $ne: "draft" },
    }

    // Default to all non-draft statuses when no filter is specified
    return strapi.documents("plugin::content-moderation.submission").findMany({
      filters,
      sort: { createdAt: "desc" },
      limit: 200,
    })
  },

  async findByUser(userId: string) {
    return strapi.documents("plugin::content-moderation.submission").findMany({
      filters: { submittedByUserId: userId },
      sort: { createdAt: "desc" },
      limit: 100,
    })
  },

  async updateStatus(
    documentId: string,
    status: "approved" | "rejected" | "needs_info" | "pending",
    reviewedByUserId: string,
    reviewNote?: string
  ) {
    const submission = await strapi
      .documents("plugin::content-moderation.submission")
      .findOne({ documentId })

    const updated = await strapi
      .documents("plugin::content-moderation.submission")
      .update({
        documentId,
        data: { status, reviewedByUserId, reviewNote, reviewedAt: new Date() },
      })

    // Side-effect: if approving a new_library, create a draft library entry
    if (status === "approved" && submission?.submissionType === "new_library") {
      const f = (submission.fields ?? {}) as Record<string, unknown>
      const tempRef = `PENDING-${Date.now()}`

      // Convert plain-text notes to Strapi blocks format
      const toBlocks = (text: unknown) =>
        text
          ? [
              {
                type: "paragraph",
                children: [{ type: "text", text: String(text) }],
              },
            ]
          : undefined

      // Uploaded images: find hero and gallery
      type UploadedImage = { strapiId: number; url: string; isHero: boolean }
      const uploadedImages = Array.isArray(f.uploadedImages)
        ? (f.uploadedImages as UploadedImage[])
        : []
      const heroImage =
        uploadedImages.find((img) => img.isHero) ?? uploadedImages[0] ?? null
      const galleryImages = uploadedImages.filter((img) => img !== heroImage)

      // Social links: filter to valid entries
      const socialLinksData = Array.isArray(f.socialLinks)
        ? (
            f.socialLinks as { platform: string; url: string; label?: string }[]
          ).filter((s) => s.platform && s.url)
        : []

      try {
        const newLibrary = await strapi
          .documents("api::library.library")
          .create({
            data: {
              name: String(f.name ?? "Unnamed Library"),
              libraryType: (f.libraryType as string) ?? "Other",
              operationalStatus: (f.operationalStatus as string) ?? "unknown",
              operatorType: (f.operatorType as string) || undefined,
              entityRef: tempRef,
              shortName: (f.shortName as string) || undefined,
              summary: (f.summary as string) || undefined,
              streetAddress: (f.streetAddress as string) || undefined,
              city: (f.city as string) || undefined,
              district: (f.district as string) || undefined,
              postalCode: (f.postalCode as string) || undefined,
              website: (f.website as string) || undefined,
              catalogueUrl: (f.catalogueUrl as string) || undefined,
              planVisitUrl: (f.planVisitUrl as string) || undefined,
              membershipUrl: (f.membershipUrl as string) || undefined,
              bookingUrl: (f.bookingUrl as string) || undefined,
              donationUrl: (f.donationUrl as string) || undefined,
              virtualTourUrl: (f.virtualTourUrl as string) || undefined,
              virtualTourEmbed: (f.virtualTourEmbed as string) || undefined,
              email: (f.email as string) || undefined,
              phone: (f.phone as string) || undefined,
              admissionInfo: (f.admissionInfo as string) || undefined,
              transitInfo: (f.transitInfo as string) || undefined,
              languagesServed: (f.languagesServed as string) || undefined,
              foundedYear: (f.foundedYear as string) || undefined,
              openedYear: (f.openedYear as string) || undefined,
              closedYear: (f.closedYear as string) || undefined,
              architect: (f.architect as string) || undefined,
              buildingInfo: (f.buildingInfo as string) || undefined,
              iiifEndpoint: (f.iiifEndpoint as string) || undefined,
              classificationSystem:
                (f.classificationSystem as string) || undefined,
              source: (f.source as string) || undefined,
              sourceUrl: (f.sourceUrl as string) || undefined,
              closureReason: (f.closureReason as string) || undefined,
              openingTimes: f.openingTimes || undefined,
              accessibilityNotes: toBlocks(f.accessibilityNotes),
              visitNotes: toBlocks(f.visitNotes),
              lastVerifiedAt: new Date(),
              contentUpdatedAt: new Date(),
              location:
                f.lat && f.lng
                  ? {
                      lat: Number.parseFloat(String(f.lat)),
                      lng: Number.parseFloat(String(f.lng)),
                    }
                  : undefined,
              continent: (f.continentDocumentId as string)
                ? { connect: [{ documentId: f.continentDocumentId as string }] }
                : undefined,
              country: (f.countryDocumentId as string)
                ? { connect: [{ documentId: f.countryDocumentId as string }] }
                : undefined,
              region: (f.regionDocumentId as string)
                ? { connect: [{ documentId: f.regionDocumentId as string }] }
                : undefined,
              area: (f.areaDocumentId as string)
                ? { connect: [{ documentId: f.areaDocumentId as string }] }
                : undefined,
              heroImage: heroImage
                ? { connect: [{ id: heroImage.strapiId }] }
                : undefined,
              gallery:
                galleryImages.length > 0
                  ? {
                      connect: galleryImages.map((img) => ({
                        id: img.strapiId,
                      })),
                    }
                  : undefined,
              socialLinks:
                socialLinksData.length > 0 ? socialLinksData : undefined,
              services:
                Array.isArray(f.services) && f.services.length > 0
                  ? {
                      connect: (f.services as string[]).map((id) => ({
                        documentId: id,
                      })),
                    }
                  : undefined,
              amenities:
                Array.isArray(f.amenities) && f.amenities.length > 0
                  ? {
                      connect: (f.amenities as string[]).map((id) => ({
                        documentId: id,
                      })),
                    }
                  : undefined,
              accessibility:
                Array.isArray(f.accessibility) && f.accessibility.length > 0
                  ? {
                      connect: (f.accessibility as string[]).map((id) => ({
                        documentId: id,
                      })),
                    }
                  : undefined,
            },
            status: "draft",
          })
        strapi.log.info(
          `[content-moderation] Auto-created draft library "${f.name}" from approved submission ${documentId}`
        )

        // Auto-claim: create a library-affiliation for the original submitter
        if (submission.submittedByUserId && newLibrary?.id) {
          await strapi
            .documents("api::library-affiliation.library-affiliation")
            .create({
              data: {
                baUserId: submission.submittedByUserId,
                library: { connect: [{ id: newLibrary.id }] },
                role: null,
                department: null,
                verificationMethod: "contact_us",
              } as any,
            })
          await strapi.db.query("api::user-profile.user-profile").update({
            where: { baUserId: submission.submittedByUserId },
            data: {
              isVerifiedLibrarian: true,
              contributorRole: "verified_librarian",
            },
          })
          strapi.log.info(
            `[content-moderation] Auto-claimed library "${f.name}" for submitter ${submission.submittedByUserId}`
          )
        }
      } catch (err) {
        strapi.log.error(
          `[content-moderation] Failed to auto-create library from approved submission ${documentId}:`,
          err
        )
      }
    }

    // Side-effect: if approving a library_claim, create affiliation record + mark profile verified
    if (
      status === "approved" &&
      submission?.submissionType === "library_claim"
    ) {
      const fields = (submission.fields ?? {}) as Record<string, unknown>

      // Find the library by entityRef to get its documentId for the relation
      const targetLibrary = fields.entityRef
        ? await strapi.db
            .query("api::library.library")
            .findOne({ where: { entityRef: fields.entityRef } })
        : null

      try {
        const affiliationData: Record<string, unknown> = {
          baUserId: submission.submittedByUserId,
          role: (fields.role as string) ?? null,
          department: (fields.department as string) ?? null,
          verificationMethod:
            (submission.verificationMethod as string) ?? "contact_us",
        }
        if (targetLibrary) {
          affiliationData.library = { connect: [{ id: targetLibrary.id }] }
        }
        await strapi
          .documents("api::library-affiliation.library-affiliation")
          .create({
            data: affiliationData as any,
          })
      } catch (err) {
        strapi.log.error(
          "[content-moderation] Failed to create library-affiliation:",
          err
        )
      }

      // Mark the user profile as a verified librarian
      await strapi.db.query("api::user-profile.user-profile").update({
        where: { baUserId: submission.submittedByUserId },
        data: {
          isVerifiedLibrarian: true,
          contributorRole: "verified_librarian",
        },
      })
    }

    // Side-effect: if approving a topic_suggestion, approve the topic
    if (
      status === "approved" &&
      submission?.submissionType === "topic_suggestion"
    ) {
      const fields = (submission.fields ?? {}) as Record<string, unknown>
      if (fields.topicDocumentId) {
        await strapi.documents("api::topic.topic").update({
          documentId: fields.topicDocumentId as string,
          data: { status: "approved" },
        })
      }
    }

    // ── wiki_edit approval ─────────────────────────────────────────────
    if (status === "approved" && submission?.submissionType === "wiki_edit") {
      await (this as any).applyWikiEdit(submission)
    }

    // Award points for new_library approval — non-fatal
    if (status === "approved" && submission?.submissionType === "new_library") {
      try {
        await strapi
          .plugin("rewards")
          .service("points")
          .award(submission.submittedByUserId, "new_library_approved", 50, {
            submissionId: documentId,
            libraryName: String(
              (submission.fields as Record<string, unknown>)?.name ?? ""
            ),
          })
      } catch (err) {
        strapi.log.warn("[content-moderation] rewards.award failed:", err)
      }
    }

    // Award points for library_edit approval (minor: 1–3 fields, major: 4+)
    if (
      status === "approved" &&
      submission?.submissionType === "library_edit"
    ) {
      try {
        const fields = (submission.fields ?? {}) as Record<string, unknown>
        const fieldCount = Object.keys(fields).filter(
          (k) =>
            fields[k] !== null && fields[k] !== undefined && fields[k] !== ""
        ).length
        const action =
          fieldCount >= 4 ? "edit_accepted_major" : "edit_accepted_minor"
        const pts = fieldCount >= 4 ? 15 : 5

        await strapi
          .plugin("rewards")
          .service("points")
          .award(submission.submittedByUserId, action, pts, {
            submissionId: documentId,
            fieldCount,
          })
      } catch (err) {
        strapi.log.warn(
          "[content-moderation] rewards.award (edit) failed:",
          err
        )
      }
    }

    // Award points for correction approval — 2pts
    if (status === "approved" && submission?.submissionType === "correction") {
      try {
        await strapi
          .plugin("rewards")
          .service("points")
          .award(submission.submittedByUserId, "correction_approved", 2, {
            submissionId: documentId,
          })
      } catch (err) {
        strapi.log.warn(
          "[content-moderation] rewards.award (correction) failed:",
          err
        )
      }
    }

    // Award points for library_claim approval — 10pts
    if (
      status === "approved" &&
      submission?.submissionType === "library_claim"
    ) {
      try {
        await strapi
          .plugin("rewards")
          .service("points")
          .award(submission.submittedByUserId, "claim_approved", 10, {
            submissionId: documentId,
          })
      } catch (err) {
        strapi.log.warn(
          "[content-moderation] rewards.award (claim) failed:",
          err
        )
      }
    }

    // Award points for wiki_edit approval
    if (status === "approved" && submission?.submissionType === "wiki_edit") {
      try {
        const fields = (submission.fields ?? {}) as Record<string, unknown>
        const isTranslation = fields.isTranslation === true
        await strapi
          .plugin("rewards")
          .service("points")
          .award(
            submission.submittedByUserId,
            isTranslation ? "wiki_translated" : "edit_accepted_minor",
            isTranslation ? 15 : 5,
            { submissionId: documentId }
          )
      } catch (err) {
        strapi.log.warn(
          "[content-moderation] rewards.award (wiki) failed:",
          err
        )
      }
    }

    // Invalidate quick wins for the submitter after approval
    if (status === "approved" && submission?.submittedByUserId) {
      try {
        await strapi
          .service("api::user-profile.quick-wins")
          .computeAndSave(submission.submittedByUserId)
      } catch (err) {
        strapi.log.warn("[quick-wins] Post-approval recompute failed:", err)
      }
    }

    return updated
  },

  async saveDraft(
    documentId: string,
    userId: string,
    draftData: Record<string, unknown>,
    stepCompleted: number
  ): Promise<
    { error: "not_found" | "forbidden" | "not_draft" } | { data: unknown }
  > {
    const existing = await strapi
      .documents("plugin::content-moderation.submission")
      .findOne({ documentId })
    if (!existing) return { error: "not_found" }
    if (existing.submittedByUserId !== userId) return { error: "forbidden" }
    // A1: once a submission is in review (or decided) its content is frozen.
    if (existing.status !== "draft") return { error: "not_draft" }

    const safeDraft =
      draftData && typeof draftData === "object" ? draftData : {}
    // Also sync the top-level submission fields from draftData so the
    // moderation queue always reflects the latest wizard state.
    const { editSummary, evidenceType, evidenceUrl, note, ...libraryFields } =
      safeDraft as Record<string, unknown>

    const updateData: Record<string, unknown> = {
      draftData: safeDraft,
      stepCompleted,
      fields: libraryFields,
    }
    if (editSummary !== undefined) updateData.editSummary = editSummary
    if (evidenceType !== undefined) updateData.evidenceType = evidenceType
    if (evidenceUrl !== undefined) updateData.evidenceUrl = evidenceUrl
    if (note !== undefined) updateData.note = note

    const data = await strapi
      .documents("plugin::content-moderation.submission")
      .update({ documentId, data: updateData })

    return { data }
  },

  async finalizeDraft(
    documentId: string,
    userId: string,
    formData: Record<string, unknown>
  ) {
    const existing = await strapi
      .documents("plugin::content-moderation.submission")
      .findOne({ documentId })

    if (!existing) return null
    if (existing.submittedByUserId !== userId) return null
    if (existing.status !== "draft") return null

    const { editSummary, evidenceType, evidenceUrl, note, ...libraryFields } =
      formData as Record<string, unknown>

    const updateData: Record<string, unknown> = {
      status: "pending",
      fields: libraryFields,
    }
    if (editSummary) updateData.editSummary = editSummary
    if (evidenceType) updateData.evidenceType = evidenceType
    if (evidenceUrl) updateData.evidenceUrl = evidenceUrl
    if (note) updateData.note = note

    const next = { ...existing, ...updateData }
    updateData.payloadHash = payloadHash(next)

    return strapi.documents("plugin::content-moderation.submission").update({
      documentId,
      data: updateData,
    })
  },

  /**
   * Public revision history for a library: the most recent approved
   * submissions targeting that library, sanitized for anonymous display.
   * Never exposes emails, reviewer identity, or review notes.
   */
  async findLibraryRevisions(libraryDocumentId: string, limit = 10) {
    const submissions = await strapi
      .documents("plugin::content-moderation.submission")
      .findMany({
        filters: {
          targetDocumentId: libraryDocumentId,
          status: "approved",
        } as any,
        sort: { reviewedAt: "desc" },
        limit,
      })

    // Resolve submitter usernames (batch, by baUserId)
    const userIds = [
      ...new Set(
        submissions.map((s: any) => s.submittedByUserId).filter(Boolean)
      ),
    ]
    const usernameByBaUserId: Record<string, string> = {}
    if (userIds.length > 0) {
      const profiles = await strapi
        .documents("api::user-profile.user-profile")
        .findMany({
          filters: { baUserId: { $in: userIds } } as any,
          fields: ["baUserId", "username"] as any,
          limit: userIds.length,
        })
      for (const p of profiles as any[]) {
        if (p.baUserId && p.username)
          usernameByBaUserId[p.baUserId] = p.username
      }
    }

    const KIND_MAP: Record<string, "edit" | "addition" | "import"> = {
      correction: "edit",
      library_edit: "edit",
      new_library: "addition",
      library_claim: "edit",
    }

    return submissions.map((s: any) => ({
      kind: KIND_MAP[s.submissionType] ?? "edit",
      summary:
        s.editSummary ??
        (s.fields && typeof s.fields === "object"
          ? `Updated ${Object.keys(s.fields).join(", ")}`
          : "Record updated"),
      fieldsChanged:
        s.fields && typeof s.fields === "object" ? Object.keys(s.fields) : [],
      submittedByUsername: s.submittedByUserId
        ? (usernameByBaUserId[s.submittedByUserId] ?? null)
        : null,
      decidedAt: s.reviewedAt ?? s.updatedAt ?? null,
    }))
  },

  async findPublicByDocumentId(documentId: string) {
    // Resolve the profile to get baUserId via Document Service
    const profile = await strapi
      .documents("api::user-profile.user-profile")
      .findOne({ documentId, fields: ["baUserId"] as any })
    if (!profile?.baUserId) return []

    return (this as any).findPublicByBaUserId(profile.baUserId)
  },

  async findPublicByBaUserId(baUserId: string) {
    const submissions = await strapi
      .documents("plugin::content-moderation.submission")
      .findMany({
        filters: {
          submittedByUserId: baUserId,
          status: { $ne: "draft" },
        },
        sort: { createdAt: "desc" },
        limit: 200,
      })

    const libSlugs = new Set<string>()
    for (const s of submissions) {
      if (
        (s.submissionType === "library_edit" ||
          s.submissionType === "correction") &&
        s.targetSlug
      ) {
        libSlugs.add(s.targetSlug)
      }
    }
    const libNameMap: Record<string, string> = {}
    if (libSlugs.size > 0) {
      try {
        const libs = await strapi.db.query("api::library.library").findMany({
          where: { slug: { $in: [...libSlugs] } },
          select: ["slug", "name"],
        })
        for (const lib of libs as { slug: string; name: string }[]) {
          libNameMap[lib.slug] = lib.name
        }
      } catch {
        // non-fatal
      }
    }

    return submissions.map((s: any) => {
      let targetLabel: string | null = null
      const f = (s.fields ?? {}) as Record<string, unknown>
      switch (s.submissionType) {
        case "new_library":
          targetLabel = (f.name as string) ?? s.targetSlug ?? null
          break
        case "library_edit":
        case "correction":
          targetLabel =
            (s.targetSlug ? libNameMap[s.targetSlug] : null) ??
            s.targetSlug ??
            null
          break
        case "library_claim":
          targetLabel =
            (f.libraryName as string) ??
            (f.entityRef as string) ??
            s.targetSlug ??
            null
          break
        case "wiki_edit":
          targetLabel = s.targetSlug
            ? s.targetSlug
                .split("-")
                .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
                .join(" ")
            : null
          break
        case "topic_suggestion":
          targetLabel = (f.name as string) ?? s.targetSlug ?? null
          break

        default:
          targetLabel = s.targetSlug ?? null
      }

      return {
        documentId: s.documentId,
        submissionType: s.submissionType,
        status: s.status,
        targetEntityType: s.targetEntityType ?? null,
        targetSlug: s.targetSlug ?? null,
        targetLabel,
        editSummary: s.editSummary ?? null,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        reviewedAt: s.reviewedAt ?? null,
      }
    })
  },

  async findPublicByUsername(username: string) {
    // Resolve the profile to get baUserId via Document Service
    const results = await strapi
      .documents("api::user-profile.user-profile")
      .findMany({
        filters: { username: { $eq: username } } as any,
        fields: ["baUserId"] as any,
        limit: 1,
      })
    const profile = results[0] ?? null
    if (!profile?.baUserId) return []

    return (this as any).findPublicByBaUserId(profile.baUserId)
  },

  async findDraft(userId: string, submissionType: string, targetSlug?: string) {
    const filters: Record<string, unknown> = {
      submittedByUserId: userId,
      submissionType,
      status: "draft",
    }
    if (targetSlug) filters.targetSlug = targetSlug
    const results = await strapi
      .documents("plugin::content-moderation.submission")
      .findMany({
        filters,
        sort: { updatedAt: "desc" },
        limit: 1,
      })

    return results[0] ?? null
  },

  async applyWikiEdit(submission: any): Promise<void> {
    try {
      const draftData = submission.draftData ?? {}
      const slug: string | undefined = draftData.targetSlug
      if (!slug) return

      const locale = (draftData.locale as string | undefined) ?? "en"

      const articles = await strapi
        .documents("api::wiki-article.wiki-article" as any)
        .findMany({
          filters: { slug: { $eq: slug } } as any,
          limit: 1,
        })
      const article = (articles as any[])[0] ?? null
      if (!article) return

      const updateData: Record<string, unknown> = {}
      if (draftData.title) updateData.title = draftData.title
      if (Array.isArray(draftData.body)) updateData.body = draftData.body

      if (Object.keys(updateData).length === 0) {
        strapi.log.warn(
          "[content-moderation] applyWikiEdit: draftData has no title or body, skipping update"
        )

        return
      }

      await strapi.documents("api::wiki-article.wiki-article" as any).update({
        documentId: article.documentId,
        locale,
        status: "published",
        data: updateData,
      })

      // Connect submitter to contributors relation (additive — never removes)
      if (submission.submittedByUserId) {
        const profile = await strapi.db
          .query("api::user-profile.user-profile")
          .findOne({ where: { baUserId: submission.submittedByUserId } })
        if (profile) {
          await strapi.db.query("api::wiki-article.wiki-article").update({
            where: { id: article.id },
            data: { contributors: { connect: [{ id: profile.id }] } },
          })
        }
      }
    } catch (err) {
      strapi.log.error("[content-moderation] applyWikiEdit failed", err)
    }
  },
})
