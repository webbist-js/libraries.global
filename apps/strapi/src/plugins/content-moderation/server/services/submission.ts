export default ({ strapi }: { strapi: any }) => ({
  async create(data: {
    submissionType: string
    targetEntityType?: string
    targetDocumentId?: string
    targetSlug?: string
    fields?: Record<string, unknown>
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

    return strapi.documents("plugin::content-moderation.submission").create({
      data: { ...rest, status: asDraft ? "draft" : "pending" },
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
    draftData: Record<string, unknown>,
    stepCompleted: number
  ) {
    // Also sync the top-level submission fields from draftData so the
    // moderation queue always reflects the latest wizard state.
    const { editSummary, evidenceType, evidenceUrl, note, ...libraryFields } =
      draftData as Record<string, unknown>

    const updateData: Record<string, unknown> = {
      draftData,
      stepCompleted,
      fields: libraryFields,
    }
    if (editSummary !== undefined) updateData.editSummary = editSummary
    if (evidenceType !== undefined) updateData.evidenceType = evidenceType
    if (evidenceUrl !== undefined) updateData.evidenceUrl = evidenceUrl
    if (note !== undefined) updateData.note = note

    return strapi.documents("plugin::content-moderation.submission").update({
      documentId,
      data: updateData,
    })
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

    return strapi.documents("plugin::content-moderation.submission").update({
      documentId,
      data: updateData,
    })
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
})
