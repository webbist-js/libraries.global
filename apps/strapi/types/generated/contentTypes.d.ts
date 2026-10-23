import type { Schema, Struct } from "@strapi/strapi"

export interface AdminApiToken extends Struct.CollectionTypeSchema {
  collectionName: "strapi_api_tokens"
  info: {
    description: ""
    displayName: "Api Token"
    name: "Api Token"
    pluralName: "api-tokens"
    singularName: "api-token"
  }
  options: {
    draftAndPublish: false
  }
  pluginOptions: {
    "content-manager": {
      visible: false
    }
    "content-type-builder": {
      visible: false
    }
  }
  attributes: {
    accessKey: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1
      }>
    adminPermissions: Schema.Attribute.Relation<
      "oneToMany",
      "admin::permission"
    >
    adminUserOwner: Schema.Attribute.Relation<"manyToOne", "admin::user">
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    description: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1
      }> &
      Schema.Attribute.DefaultTo<"">
    encryptedKey: Schema.Attribute.Text &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1
      }>
    expiresAt: Schema.Attribute.DateTime
    kind: Schema.Attribute.Enumeration<["content-api", "admin"]> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<"content-api">
    lastUsedAt: Schema.Attribute.DateTime
    lifespan: Schema.Attribute.BigInteger
    locale: Schema.Attribute.String & Schema.Attribute.Private
    localizations: Schema.Attribute.Relation<"oneToMany", "admin::api-token"> &
      Schema.Attribute.Private
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1
      }>
    permissions: Schema.Attribute.Relation<
      "oneToMany",
      "admin::api-token-permission"
    >
    publishedAt: Schema.Attribute.DateTime
    type: Schema.Attribute.Enumeration<["read-only", "full-access", "custom"]> &
      Schema.Attribute.DefaultTo<"read-only">
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
  }
}

export interface AdminApiTokenPermission extends Struct.CollectionTypeSchema {
  collectionName: "strapi_api_token_permissions"
  info: {
    description: ""
    displayName: "API Token Permission"
    name: "API Token Permission"
    pluralName: "api-token-permissions"
    singularName: "api-token-permission"
  }
  options: {
    draftAndPublish: false
  }
  pluginOptions: {
    "content-manager": {
      visible: false
    }
    "content-type-builder": {
      visible: false
    }
  }
  attributes: {
    action: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1
      }>
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    locale: Schema.Attribute.String & Schema.Attribute.Private
    localizations: Schema.Attribute.Relation<
      "oneToMany",
      "admin::api-token-permission"
    > &
      Schema.Attribute.Private
    publishedAt: Schema.Attribute.DateTime
    token: Schema.Attribute.Relation<"manyToOne", "admin::api-token">
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
  }
}

export interface AdminPermission extends Struct.CollectionTypeSchema {
  collectionName: "admin_permissions"
  info: {
    description: ""
    displayName: "Permission"
    name: "Permission"
    pluralName: "permissions"
    singularName: "permission"
  }
  options: {
    draftAndPublish: false
  }
  pluginOptions: {
    "content-manager": {
      visible: false
    }
    "content-type-builder": {
      visible: false
    }
  }
  attributes: {
    action: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1
      }>
    actionParameters: Schema.Attribute.JSON & Schema.Attribute.DefaultTo<{}>
    apiToken: Schema.Attribute.Relation<"manyToOne", "admin::api-token">
    conditions: Schema.Attribute.JSON & Schema.Attribute.DefaultTo<[]>
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    locale: Schema.Attribute.String & Schema.Attribute.Private
    localizations: Schema.Attribute.Relation<"oneToMany", "admin::permission"> &
      Schema.Attribute.Private
    properties: Schema.Attribute.JSON & Schema.Attribute.DefaultTo<{}>
    publishedAt: Schema.Attribute.DateTime
    role: Schema.Attribute.Relation<"manyToOne", "admin::role">
    subject: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1
      }>
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
  }
}

export interface AdminRole extends Struct.CollectionTypeSchema {
  collectionName: "admin_roles"
  info: {
    description: ""
    displayName: "Role"
    name: "Role"
    pluralName: "roles"
    singularName: "role"
  }
  options: {
    draftAndPublish: false
  }
  pluginOptions: {
    "content-manager": {
      visible: false
    }
    "content-type-builder": {
      visible: false
    }
  }
  attributes: {
    code: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1
      }>
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    description: Schema.Attribute.String
    locale: Schema.Attribute.String & Schema.Attribute.Private
    localizations: Schema.Attribute.Relation<"oneToMany", "admin::role"> &
      Schema.Attribute.Private
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1
      }>
    permissions: Schema.Attribute.Relation<"oneToMany", "admin::permission">
    publishedAt: Schema.Attribute.DateTime
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    users: Schema.Attribute.Relation<"manyToMany", "admin::user">
  }
}

export interface AdminSession extends Struct.CollectionTypeSchema {
  collectionName: "strapi_sessions"
  info: {
    description: "Session Manager storage"
    displayName: "Session"
    name: "Session"
    pluralName: "sessions"
    singularName: "session"
  }
  options: {
    draftAndPublish: false
  }
  pluginOptions: {
    "content-manager": {
      visible: false
    }
    "content-type-builder": {
      visible: false
    }
    i18n: {
      localized: false
    }
  }
  attributes: {
    absoluteExpiresAt: Schema.Attribute.DateTime & Schema.Attribute.Private
    childId: Schema.Attribute.String & Schema.Attribute.Private
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    deviceId: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Private
    expiresAt: Schema.Attribute.DateTime &
      Schema.Attribute.Required &
      Schema.Attribute.Private
    locale: Schema.Attribute.String & Schema.Attribute.Private
    localizations: Schema.Attribute.Relation<"oneToMany", "admin::session"> &
      Schema.Attribute.Private
    metadata: Schema.Attribute.JSON & Schema.Attribute.Private
    origin: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Private
    publishedAt: Schema.Attribute.DateTime
    sessionId: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Private &
      Schema.Attribute.Unique
    status: Schema.Attribute.String & Schema.Attribute.Private
    type: Schema.Attribute.String & Schema.Attribute.Private
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    userId: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Private
  }
}

export interface AdminTransferToken extends Struct.CollectionTypeSchema {
  collectionName: "strapi_transfer_tokens"
  info: {
    description: ""
    displayName: "Transfer Token"
    name: "Transfer Token"
    pluralName: "transfer-tokens"
    singularName: "transfer-token"
  }
  options: {
    draftAndPublish: false
  }
  pluginOptions: {
    "content-manager": {
      visible: false
    }
    "content-type-builder": {
      visible: false
    }
  }
  attributes: {
    accessKey: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1
      }>
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    description: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1
      }> &
      Schema.Attribute.DefaultTo<"">
    expiresAt: Schema.Attribute.DateTime
    lastUsedAt: Schema.Attribute.DateTime
    lifespan: Schema.Attribute.BigInteger
    locale: Schema.Attribute.String & Schema.Attribute.Private
    localizations: Schema.Attribute.Relation<
      "oneToMany",
      "admin::transfer-token"
    > &
      Schema.Attribute.Private
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1
      }>
    permissions: Schema.Attribute.Relation<
      "oneToMany",
      "admin::transfer-token-permission"
    >
    publishedAt: Schema.Attribute.DateTime
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
  }
}

export interface AdminTransferTokenPermission
  extends Struct.CollectionTypeSchema {
  collectionName: "strapi_transfer_token_permissions"
  info: {
    description: ""
    displayName: "Transfer Token Permission"
    name: "Transfer Token Permission"
    pluralName: "transfer-token-permissions"
    singularName: "transfer-token-permission"
  }
  options: {
    draftAndPublish: false
  }
  pluginOptions: {
    "content-manager": {
      visible: false
    }
    "content-type-builder": {
      visible: false
    }
  }
  attributes: {
    action: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1
      }>
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    locale: Schema.Attribute.String & Schema.Attribute.Private
    localizations: Schema.Attribute.Relation<
      "oneToMany",
      "admin::transfer-token-permission"
    > &
      Schema.Attribute.Private
    publishedAt: Schema.Attribute.DateTime
    token: Schema.Attribute.Relation<"manyToOne", "admin::transfer-token">
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
  }
}

export interface AdminUser extends Struct.CollectionTypeSchema {
  collectionName: "admin_users"
  info: {
    description: ""
    displayName: "User"
    name: "User"
    pluralName: "users"
    singularName: "user"
  }
  options: {
    draftAndPublish: false
  }
  pluginOptions: {
    "content-manager": {
      visible: false
    }
    "content-type-builder": {
      visible: false
    }
  }
  attributes: {
    apiTokens: Schema.Attribute.Relation<"oneToMany", "admin::api-token"> &
      Schema.Attribute.Private
    blocked: Schema.Attribute.Boolean &
      Schema.Attribute.Private &
      Schema.Attribute.DefaultTo<false>
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    email: Schema.Attribute.Email &
      Schema.Attribute.Required &
      Schema.Attribute.Private &
      Schema.Attribute.Unique &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 6
      }>
    firstname: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1
      }>
    isActive: Schema.Attribute.Boolean &
      Schema.Attribute.Private &
      Schema.Attribute.DefaultTo<false>
    lastname: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1
      }>
    locale: Schema.Attribute.String & Schema.Attribute.Private
    localizations: Schema.Attribute.Relation<"oneToMany", "admin::user"> &
      Schema.Attribute.Private
    password: Schema.Attribute.Password &
      Schema.Attribute.Private &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 6
      }>
    preferedLanguage: Schema.Attribute.String
    publishedAt: Schema.Attribute.DateTime
    registrationToken: Schema.Attribute.String & Schema.Attribute.Private
    resetPasswordToken: Schema.Attribute.String & Schema.Attribute.Private
    resetPasswordTokenExpiresAt: Schema.Attribute.DateTime &
      Schema.Attribute.Private
    roles: Schema.Attribute.Relation<"manyToMany", "admin::role"> &
      Schema.Attribute.Private
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    username: Schema.Attribute.String
  }
}

export interface ApiAccessibilityAccessibility
  extends Struct.CollectionTypeSchema {
  collectionName: "accessibility_features"
  info: {
    description: ""
    displayName: "Accessibility"
    pluralName: "accessibility-features"
    singularName: "accessibility"
  }
  options: {
    draftAndPublish: true
  }
  pluginOptions: {
    i18n: {
      localized: true
    }
  }
  attributes: {
    category: Schema.Attribute.Enumeration<
      [
        "Mobility",
        "Sensory",
        "Communication",
        "Cognitive",
        "Facilities",
        "Staff Support",
        "Other",
      ]
    > &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    description: Schema.Attribute.Blocks &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    featured: Schema.Attribute.Boolean &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }> &
      Schema.Attribute.DefaultTo<false>
    icon: Schema.Attribute.JSON &
      Schema.Attribute.CustomField<
        "plugin::strapi-plugin-iconhub.iconhub",
        {
          storeIconData: true
        }
      > &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    libraries: Schema.Attribute.Relation<"manyToMany", "api::library.library"> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    locale: Schema.Attribute.String
    localizations: Schema.Attribute.Relation<
      "oneToMany",
      "api::accessibility.accessibility"
    >
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    publishedAt: Schema.Attribute.DateTime
    summary: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
  }
}

export interface ApiAmenityAmenity extends Struct.CollectionTypeSchema {
  collectionName: "amenities"
  info: {
    description: ""
    displayName: "Amenity"
    pluralName: "amenities"
    singularName: "amenity"
  }
  options: {
    draftAndPublish: true
  }
  pluginOptions: {
    i18n: {
      localized: true
    }
  }
  attributes: {
    category: Schema.Attribute.Enumeration<
      [
        "Building",
        "Workspace",
        "Technology",
        "Family",
        "Food and Drink",
        "Travel",
        "Comfort",
        "Access",
        "Other",
      ]
    > &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    description: Schema.Attribute.Blocks &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    featured: Schema.Attribute.Boolean &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }> &
      Schema.Attribute.DefaultTo<false>
    icon: Schema.Attribute.JSON &
      Schema.Attribute.CustomField<
        "plugin::strapi-plugin-iconhub.iconhub",
        {
          storeIconData: true
        }
      > &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    libraries: Schema.Attribute.Relation<"manyToMany", "api::library.library"> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    locale: Schema.Attribute.String
    localizations: Schema.Attribute.Relation<
      "oneToMany",
      "api::amenity.amenity"
    >
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    publishedAt: Schema.Attribute.DateTime
    summary: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
  }
}

export interface ApiAnnouncementAnnouncement
  extends Struct.CollectionTypeSchema {
  collectionName: "notification_announcements"
  info: {
    description: "Publish an operational project notice or an opt-in product update. Publication queues notifications; unpublish before delivery to cancel unsent emails."
    displayName: "Notification announcement"
    pluralName: "announcements"
    singularName: "announcement"
  }
  options: {
    draftAndPublish: true
  }
  attributes: {
    body: Schema.Attribute.Text &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 3000
      }>
    channel: Schema.Attribute.Enumeration<
      ["editorialMessages", "marketing", "transactional"]
    > &
      Schema.Attribute.Required
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    href: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 500
      }>
    locale: Schema.Attribute.String & Schema.Attribute.Private
    localizations: Schema.Attribute.Relation<
      "oneToMany",
      "api::announcement.announcement"
    > &
      Schema.Attribute.Private
    publishedAt: Schema.Attribute.DateTime
    title: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 180
      }>
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
  }
}

export interface ApiAreaArea extends Struct.CollectionTypeSchema {
  collectionName: "areas"
  info: {
    description: "Sub-regional administrative division \u2014 borough, district, municipality, canton, arrondissement, etc. Sits below Region in the geographic hierarchy."
    displayName: "Area"
    pluralName: "areas"
    singularName: "area"
  }
  options: {
    draftAndPublish: true
  }
  pluginOptions: {
    i18n: {
      localized: true
    }
  }
  attributes: {
    country: Schema.Attribute.Relation<"manyToOne", "api::country.country"> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    entityRef: Schema.Attribute.String &
      Schema.Attribute.Unique &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    geonamesId: Schema.Attribute.String &
      Schema.Attribute.Unique &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    gssCode: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    libraries: Schema.Attribute.Relation<"oneToMany", "api::library.library"> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    locale: Schema.Attribute.String
    localizations: Schema.Attribute.Relation<"oneToMany", "api::area.area">
    mapConfig: Schema.Attribute.Component<"shared.map-config", false> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    population: Schema.Attribute.BigInteger &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }> &
      Schema.Attribute.SetMinMax<
        {
          min: 0
        },
        number
      >
    populationCoverage: Schema.Attribute.JSON &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    populationEstimates: Schema.Attribute.JSON &
      Schema.Attribute.Private &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    populationLicence: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    populationMethod: Schema.Attribute.Enumeration<
      ["direct", "sum_complete_children"]
    > &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    populationReportingCode: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    populationRetrievedAt: Schema.Attribute.DateTime &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    populationSource: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    populationSourceUrl: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    populationYear: Schema.Attribute.Integer &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }> &
      Schema.Attribute.SetMinMax<
        {
          max: 2100
          min: 1900
        },
        number
      >
    publishedAt: Schema.Attribute.DateTime
    region: Schema.Attribute.Relation<"manyToOne", "api::region.region"> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    shortName: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    slug: Schema.Attribute.UID<"name"> &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    sourceAttribution: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    summary: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    typeLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
  }
}

export interface ApiArticleChangeArticleChange
  extends Struct.CollectionTypeSchema {
  collectionName: "article_changes"
  info: {
    description: "Article Changes: one append-only row per Knowledge or Journal article write. Written only by the change-records document middleware."
    displayName: "Article Change"
    pluralName: "article-changes"
    singularName: "article-change"
  }
  options: {
    draftAndPublish: false
  }
  pluginOptions: {
    "content-manager": {
      visible: true
    }
    "content-type-builder": {
      visible: true
    }
  }
  attributes: {
    actorId: Schema.Attribute.String
    actorKind: Schema.Attribute.Enumeration<
      ["contributor", "admin", "token", "system"]
    >
    actorName: Schema.Attribute.String
    articleDocumentId: Schema.Attribute.String
    articleKind: Schema.Attribute.Enumeration<["wiki", "blog"]>
    bodyHash: Schema.Attribute.String
    changedAt: Schema.Attribute.DateTime
    contentLocale: Schema.Attribute.String
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    editSummary: Schema.Attribute.Text
    kind: Schema.Attribute.Enumeration<
      ["created", "edited", "translated", "published", "unpublished", "deleted"]
    >
    locale: Schema.Attribute.String & Schema.Attribute.Private
    localizations: Schema.Attribute.Relation<
      "oneToMany",
      "api::article-change.article-change"
    > &
      Schema.Attribute.Private
    publishedAt: Schema.Attribute.DateTime
    reviewerId: Schema.Attribute.String
    slug: Schema.Attribute.String
    submissionDocumentId: Schema.Attribute.String
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    versionStatus: Schema.Attribute.Enumeration<["draft", "published"]>
  }
}

export interface ApiArticleProjectionJobArticleProjectionJob
  extends Struct.CollectionTypeSchema {
  collectionName: "article_projection_jobs"
  info: {
    displayName: "Article projection retry"
    pluralName: "article-projection-jobs"
    singularName: "article-projection-job"
  }
  options: {
    draftAndPublish: false
  }
  pluginOptions: {
    "content-manager": {
      visible: false
    }
    "content-type-builder": {
      visible: false
    }
  }
  attributes: {
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    key: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Private &
      Schema.Attribute.Unique
    locale: Schema.Attribute.String & Schema.Attribute.Private
    localizations: Schema.Attribute.Relation<
      "oneToMany",
      "api::article-projection-job.article-projection-job"
    > &
      Schema.Attribute.Private
    publishedAt: Schema.Attribute.DateTime
    targets: Schema.Attribute.JSON & Schema.Attribute.Private
    tasks: Schema.Attribute.JSON & Schema.Attribute.Private
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    version: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Private
  }
}

export interface ApiBlogArticleBlogArticle extends Struct.CollectionTypeSchema {
  collectionName: "blog_articles"
  info: {
    description: "An editorial blog post"
    displayName: "Blog Article"
    pluralName: "blog-articles"
    singularName: "blog-article"
  }
  options: {
    draftAndPublish: true
  }
  pluginOptions: {
    i18n: {
      localized: true
    }
  }
  attributes: {
    areas: Schema.Attribute.Relation<"manyToMany", "api::area.area"> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    author: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    authorAvatar: Schema.Attribute.Media<"images"> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    authorBio: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    authorProfile: Schema.Attribute.Relation<
      "manyToOne",
      "api::user-profile.user-profile"
    > &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    authorTitle: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    body: Schema.Attribute.DynamicZone<
      [
        "content.rich-text",
        "content.image-block",
        "content.code-block",
        "content.quote-block",
        "content.callout",
      ]
    > &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    category: Schema.Attribute.Relation<"manyToOne", "api::category.category"> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    continents: Schema.Attribute.Relation<
      "manyToMany",
      "api::continent.continent"
    > &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    contributors: Schema.Attribute.Relation<
      "manyToMany",
      "api::user-profile.user-profile"
    > &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    countries: Schema.Attribute.Relation<"manyToMany", "api::country.country"> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    eventMentions: Schema.Attribute.Component<"content.event-mention", true> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    featured: Schema.Attribute.Boolean &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }> &
      Schema.Attribute.DefaultTo<false>
    geographyFacet: Schema.Attribute.JSON &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    heroImage: Schema.Attribute.Media<"images"> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    libraries: Schema.Attribute.Relation<"manyToMany", "api::library.library"> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    locale: Schema.Attribute.String
    localizations: Schema.Attribute.Relation<
      "oneToMany",
      "api::blog-article.blog-article"
    >
    publicationOrigin: Schema.Attribute.Enumeration<["index", "community"]> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }> &
      Schema.Attribute.DefaultTo<"index">
    publishedAt: Schema.Attribute.DateTime
    readingTimeMinutes: Schema.Attribute.Integer &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }> &
      Schema.Attribute.SetMinMax<
        {
          min: 1
        },
        number
      >
    regions: Schema.Attribute.Relation<"manyToMany", "api::region.region"> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    relatedArticles: Schema.Attribute.Relation<
      "manyToMany",
      "api::blog-article.blog-article"
    > &
      Schema.Attribute.Configurable &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    section: Schema.Attribute.Relation<
      "manyToOne",
      "api::blog-section.blog-section"
    > &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    seo: Schema.Attribute.Component<"shared.seo", false> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    slug: Schema.Attribute.UID<"title"> &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    summary: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    title: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    topics: Schema.Attribute.Relation<"manyToMany", "api::topic.topic"> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
  }
}

export interface ApiBlogLandingBlogLanding extends Struct.SingleTypeSchema {
  collectionName: "blog_landing"
  info: {
    description: "The editorial blog landing page"
    displayName: "Blog Landing"
    pluralName: "blog-landings"
    singularName: "blog-landing"
  }
  options: {
    draftAndPublish: true
  }
  pluginOptions: {
    i18n: {
      localized: true
    }
  }
  attributes: {
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    featuredArticle: Schema.Attribute.Relation<
      "oneToOne",
      "api::blog-article.blog-article"
    > &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    heroEyebrow: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    heroText: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    heroTitle: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    locale: Schema.Attribute.String
    localizations: Schema.Attribute.Relation<
      "oneToMany",
      "api::blog-landing.blog-landing"
    >
    publishedAt: Schema.Attribute.DateTime
    sections: Schema.Attribute.DynamicZone<
      [
        "sections.editorial-block",
        "sections.cta-banner",
        "sections.quick-links",
      ]
    > &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    seo: Schema.Attribute.Component<"shared.seo", false> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
  }
}

export interface ApiBlogSectionBlogSection extends Struct.CollectionTypeSchema {
  collectionName: "blog_sections"
  info: {
    description: "A named section / topic grouping for blog articles"
    displayName: "Blog Section"
    pluralName: "blog-sections"
    singularName: "blog-section"
  }
  options: {
    draftAndPublish: false
  }
  pluginOptions: {
    i18n: {
      localized: true
    }
  }
  attributes: {
    articles: Schema.Attribute.Relation<
      "oneToMany",
      "api::blog-article.blog-article"
    > &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    description: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    icon: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }> &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 80
      }>
    locale: Schema.Attribute.String
    localizations: Schema.Attribute.Relation<
      "oneToMany",
      "api::blog-section.blog-section"
    >
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    publishedAt: Schema.Attribute.DateTime
    slug: Schema.Attribute.UID<"name"> &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    tint: Schema.Attribute.Enumeration<
      ["purple", "green", "blue", "rust", "neutral"]
    > &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }> &
      Schema.Attribute.DefaultTo<"neutral">
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
  }
}

export interface ApiCategoryCategory extends Struct.CollectionTypeSchema {
  collectionName: "categories"
  info: {
    description: "A content category shared across wiki and blog articles"
    displayName: "Category"
    pluralName: "categories"
    singularName: "category"
  }
  options: {
    draftAndPublish: false
  }
  pluginOptions: {
    i18n: {
      localized: true
    }
  }
  attributes: {
    blogArticles: Schema.Attribute.Relation<
      "oneToMany",
      "api::blog-article.blog-article"
    > &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    description: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    icon: Schema.Attribute.JSON &
      Schema.Attribute.CustomField<
        "plugin::strapi-plugin-iconhub.iconhub",
        {
          storeIconData: true
        }
      >
    locale: Schema.Attribute.String
    localizations: Schema.Attribute.Relation<
      "oneToMany",
      "api::category.category"
    >
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    order: Schema.Attribute.Integer &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    publishedAt: Schema.Attribute.DateTime
    slug: Schema.Attribute.UID<"name"> &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    tagLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    wikiArticles: Schema.Attribute.Relation<
      "oneToMany",
      "api::wiki-article.wiki-article"
    > &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
  }
}

export interface ApiContinentContinent extends Struct.CollectionTypeSchema {
  collectionName: "continents"
  info: {
    description: ""
    displayName: "Continent"
    pluralName: "continents"
    singularName: "continent"
  }
  options: {
    draftAndPublish: true
  }
  pluginOptions: {
    i18n: {
      localized: true
    }
  }
  attributes: {
    about: Schema.Attribute.Blocks &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    code: Schema.Attribute.String &
      Schema.Attribute.Unique &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    countries: Schema.Attribute.Relation<"oneToMany", "api::country.country"> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    featuredLibraries: Schema.Attribute.Relation<
      "manyToMany",
      "api::library.library"
    > &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    locale: Schema.Attribute.String
    localizations: Schema.Attribute.Relation<
      "oneToMany",
      "api::continent.continent"
    >
    mapConfig: Schema.Attribute.Component<"shared.map-config", false> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    population: Schema.Attribute.BigInteger &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }> &
      Schema.Attribute.SetMinMax<
        {
          min: 0
        },
        number
      >
    populationCoverage: Schema.Attribute.JSON &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    populationEstimates: Schema.Attribute.JSON &
      Schema.Attribute.Private &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    populationLicence: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    populationMethod: Schema.Attribute.Enumeration<
      ["direct", "sum_complete_children"]
    > &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    populationReportingCode: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    populationRetrievedAt: Schema.Attribute.DateTime &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    populationSource: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    populationSourceUrl: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    populationYear: Schema.Attribute.Integer &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }> &
      Schema.Attribute.SetMinMax<
        {
          max: 2100
          min: 1900
        },
        number
      >
    publishedAt: Schema.Attribute.DateTime
    seo: Schema.Attribute.Component<"shared.seo", false> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    slug: Schema.Attribute.UID<"name"> &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    sourceAttribution: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    summary: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
  }
}

export interface ApiCountryCountry extends Struct.CollectionTypeSchema {
  collectionName: "countries"
  info: {
    description: "Place labels (regionTypeLabel, regionsSectionLabel, areaTypeLabel, areasSectionLabel) are UI labels only and never change the hierarchy."
    displayName: "Country"
    pluralName: "countries"
    singularName: "country"
  }
  options: {
    draftAndPublish: true
  }
  pluginOptions: {
    i18n: {
      localized: true
    }
  }
  attributes: {
    about: Schema.Attribute.Blocks &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    areasSectionLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    areaTypeLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    budget: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    capitalCity: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    continent: Schema.Attribute.Relation<
      "manyToOne",
      "api::continent.continent"
    > &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    employees: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    entityRef: Schema.Attribute.String &
      Schema.Attribute.Unique &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    featured: Schema.Attribute.Boolean &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }> &
      Schema.Attribute.DefaultTo<false>
    featuredLibraries: Schema.Attribute.Relation<
      "manyToMany",
      "api::library.library"
    > &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    heroImage: Schema.Attribute.Media<"images"> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    heroTagline: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    iso2: Schema.Attribute.String &
      Schema.Attribute.Unique &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    iso3: Schema.Attribute.String &
      Schema.Attribute.Unique &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    languages: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    libraries: Schema.Attribute.Relation<"oneToMany", "api::library.library"> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    locale: Schema.Attribute.String
    localizations: Schema.Attribute.Relation<
      "oneToMany",
      "api::country.country"
    >
    mapConfig: Schema.Attribute.Component<"shared.map-config", false> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    nationalLibrary: Schema.Attribute.Relation<
      "manyToOne",
      "api::library.library"
    > &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    population: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    populationCount: Schema.Attribute.BigInteger &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }> &
      Schema.Attribute.SetMinMax<
        {
          min: 0
        },
        number
      >
    populationCoverage: Schema.Attribute.JSON &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    populationEstimates: Schema.Attribute.JSON &
      Schema.Attribute.Private &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    populationLicence: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    populationMethod: Schema.Attribute.Enumeration<
      ["direct", "sum_complete_children"]
    > &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    populationReportingCode: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    populationRetrievedAt: Schema.Attribute.DateTime &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    populationSource: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    populationSourceUrl: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    populationYear: Schema.Attribute.Integer &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }> &
      Schema.Attribute.SetMinMax<
        {
          max: 2100
          min: 1900
        },
        number
      >
    publishedAt: Schema.Attribute.DateTime
    regions: Schema.Attribute.Relation<"oneToMany", "api::region.region"> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    regionsSectionLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    regionTypeLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }> &
      Schema.Attribute.DefaultTo<"Region">
    seo: Schema.Attribute.Component<"shared.seo", false> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    shortName: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    slug: Schema.Attribute.UID<"name"> &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    sourceAttribution: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    summary: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    systemDescription: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    visitsPerYear: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    volunteers: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
  }
}

export interface ApiDatasetDataset extends Struct.CollectionTypeSchema {
  collectionName: "datasets"
  info: {
    description: "A dataset imported into Libraries Global: who published it, under what licence, how and when it was obtained, and how it must be credited. Records link to it through their `source` key, which equals the dataset `key`."
    displayName: "Dataset"
    pluralName: "datasets"
    singularName: "dataset"
  }
  options: {
    draftAndPublish: false
  }
  pluginOptions: {
    i18n: {
      localized: false
    }
  }
  attributes: {
    attribution: Schema.Attribute.Text
    coverage: Schema.Attribute.String
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    importMechanism: Schema.Attribute.String
    key: Schema.Attribute.UID & Schema.Attribute.Required
    licence: Schema.Attribute.String
    licenceStatus: Schema.Attribute.Enumeration<
      ["confirmed_in_writing", "stated_by_publisher", "unconfirmed"]
    > &
      Schema.Attribute.DefaultTo<"unconfirmed">
    licenceUrl: Schema.Attribute.String
    locale: Schema.Attribute.String & Schema.Attribute.Private
    localizations: Schema.Attribute.Relation<
      "oneToMany",
      "api::dataset.dataset"
    > &
      Schema.Attribute.Private
    name: Schema.Attribute.String & Schema.Attribute.Required
    notes: Schema.Attribute.Text & Schema.Attribute.Private
    obtainedAt: Schema.Attribute.Date
    publishedAt: Schema.Attribute.DateTime
    publisher: Schema.Attribute.String
    redistribution: Schema.Attribute.Enumeration<
      [
        "permitted",
        "permitted_with_attribution",
        "not_permitted",
        "unconfirmed",
      ]
    > &
      Schema.Attribute.DefaultTo<"unconfirmed">
    sourceUpdatedAt: Schema.Attribute.Date
    sourceUrl: Schema.Attribute.String
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
  }
}

export interface ApiDriveCreditDriveCredit extends Struct.CollectionTypeSchema {
  collectionName: "drive_credits"
  info: {
    description: "A hidden ledger entry crediting one approved submission to one Drive \u2014 tagged by the contributor, or inferred from the Drive's scope and focus. Feeds a Drive's stats and leaderboard; no REST routes."
    displayName: "Drive Credit"
    pluralName: "drive-credits"
    singularName: "drive-credit"
  }
  options: {
    draftAndPublish: false
  }
  pluginOptions: {
    "content-manager": {
      visible: false
    }
    "content-type-builder": {
      visible: false
    }
  }
  attributes: {
    acceptedAt: Schema.Attribute.DateTime
    baUserId: Schema.Attribute.String & Schema.Attribute.Required
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    driveDocumentId: Schema.Attribute.String & Schema.Attribute.Required
    filledGaps: Schema.Attribute.String
    libraryDocumentId: Schema.Attribute.String
    locale: Schema.Attribute.String & Schema.Attribute.Private
    localizations: Schema.Attribute.Relation<
      "oneToMany",
      "api::drive-credit.drive-credit"
    > &
      Schema.Attribute.Private
    publishedAt: Schema.Attribute.DateTime
    submissionDocumentId: Schema.Attribute.String & Schema.Attribute.Required
    tagged: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
  }
}

export interface ApiDriveHoldDriveHold extends Struct.CollectionTypeSchema {
  collectionName: "drive_holds"
  info: {
    description: "A hidden 20-minute ledger entry: one helper holds one library in one Drive so two helpers don't fill the same record. No REST routes."
    displayName: "Drive Hold"
    pluralName: "drive-holds"
    singularName: "drive-hold"
  }
  options: {
    draftAndPublish: false
  }
  pluginOptions: {
    "content-manager": {
      visible: false
    }
    "content-type-builder": {
      visible: false
    }
  }
  attributes: {
    baUserId: Schema.Attribute.String & Schema.Attribute.Required
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    driveDocumentId: Schema.Attribute.String & Schema.Attribute.Required
    expiresAt: Schema.Attribute.DateTime & Schema.Attribute.Required
    libraryDocumentId: Schema.Attribute.String & Schema.Attribute.Required
    locale: Schema.Attribute.String & Schema.Attribute.Private
    localizations: Schema.Attribute.Relation<
      "oneToMany",
      "api::drive-hold.drive-hold"
    > &
      Schema.Attribute.Private
    publishedAt: Schema.Attribute.DateTime
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
  }
}

export interface ApiDriveDrive extends Struct.CollectionTypeSchema {
  collectionName: "drives"
  info: {
    description: "A board-run Drive: a time-boxed, scoped, focused call to fill gaps in a set of libraries. Contributed work arrives as ordinary Submissions tagged with the Drive and is credited on approval."
    displayName: "Drive"
    pluralName: "drives"
    singularName: "drive"
  }
  options: {
    draftAndPublish: false
  }
  pluginOptions: {
    i18n: {
      localized: true
    }
  }
  attributes: {
    baseline: Schema.Attribute.JSON &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    closedAt: Schema.Attribute.DateTime &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    closedReason: Schema.Attribute.Enumeration<["goal", "ended", "cancelled"]> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    createdByUserId: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    endsAt: Schema.Attribute.DateTime &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    featured: Schema.Attribute.Boolean &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }> &
      Schema.Attribute.DefaultTo<false>
    final: Schema.Attribute.JSON &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    focus: Schema.Attribute.JSON &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    goalPercent: Schema.Attribute.Integer &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }> &
      Schema.Attribute.SetMinMax<
        {
          max: 100
          min: 1
        },
        number
      > &
      Schema.Attribute.DefaultTo<100>
    locale: Schema.Attribute.String
    localizations: Schema.Attribute.Relation<"oneToMany", "api::drive.drive">
    openedAt: Schema.Attribute.DateTime &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    pinned: Schema.Attribute.Boolean &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }> &
      Schema.Attribute.DefaultTo<false>
    pinOrder: Schema.Attribute.Integer &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    progressLog: Schema.Attribute.JSON &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    proposalSubmissionDocumentId: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    publishedAt: Schema.Attribute.DateTime
    scope: Schema.Attribute.JSON &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    slug: Schema.Attribute.UID<"title"> &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    startsAt: Schema.Attribute.DateTime &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    status: Schema.Attribute.Enumeration<
      ["draft", "scheduled", "open", "closed", "cancelled"]
    > &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }> &
      Schema.Attribute.DefaultTo<"draft">
    steps: Schema.Attribute.Component<"drive.step", true> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    storySlug: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }> &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 120
      }>
    summary: Schema.Attribute.Text &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    title: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    unit: Schema.Attribute.Enumeration<["library", "branch", "record"]> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }> &
      Schema.Attribute.DefaultTo<"library">
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    whereToLook: Schema.Attribute.Component<"drive.source", false> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
  }
}

export interface ApiEntitlementGrantEntitlementGrant
  extends Struct.CollectionTypeSchema {
  collectionName: "entitlement_grants"
  info: {
    description: "Complimentary Supporter, Pro or Team, granted by staff. Read only by the session-profile bridge."
    displayName: "Entitlement Grant"
    pluralName: "entitlement-grants"
    singularName: "entitlement-grant"
  }
  options: {
    draftAndPublish: false
  }
  attributes: {
    baUserId: Schema.Attribute.String & Schema.Attribute.Required
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    expiresAt: Schema.Attribute.DateTime
    grantedBy: Schema.Attribute.String
    locale: Schema.Attribute.String & Schema.Attribute.Private
    localizations: Schema.Attribute.Relation<
      "oneToMany",
      "api::entitlement-grant.entitlement-grant"
    > &
      Schema.Attribute.Private
    plan: Schema.Attribute.Enumeration<["supporter", "pro", "team"]> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<"pro">
    publishedAt: Schema.Attribute.DateTime
    reason: Schema.Attribute.Text
    source: Schema.Attribute.Enumeration<
      ["admin", "press", "partner", "team", "grant_funder"]
    > &
      Schema.Attribute.DefaultTo<"admin">
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
  }
}

export interface ApiFooterFooter extends Struct.SingleTypeSchema {
  collectionName: "footers"
  info: {
    description: ""
    displayName: "Footer"
    pluralName: "footers"
    singularName: "footer"
  }
  options: {
    draftAndPublish: false
  }
  pluginOptions: {
    i18n: {
      localized: true
    }
  }
  attributes: {
    copyRight: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    links: Schema.Attribute.Component<"utilities.link", true> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    locale: Schema.Attribute.String
    localizations: Schema.Attribute.Relation<"oneToMany", "api::footer.footer">
    publishedAt: Schema.Attribute.DateTime
    sections: Schema.Attribute.Component<"elements.footer-item", true> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    socialLinks: Schema.Attribute.Component<"shared.social", true> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    text: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    title: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
  }
}

export interface ApiHomepageHomepage extends Struct.SingleTypeSchema {
  collectionName: "homepages"
  info: {
    description: "Editorial homepage for the global library discovery platform."
    displayName: "Homepage"
    pluralName: "homepages"
    singularName: "homepage"
  }
  options: {
    draftAndPublish: true
  }
  pluginOptions: {
    i18n: {
      localized: true
    }
  }
  attributes: {
    atlasBand: Schema.Attribute.Component<"homepage.cta-band", false> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    atlasImage: Schema.Attribute.Media<"images"> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    communityBand: Schema.Attribute.Component<"homepage.cta-band", false> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    communitySteps: Schema.Attribute.Component<"homepage.step", true> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    contentCtaHref: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    contentCtaLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    contentEyebrow: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    contentText: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    contentTitle: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    coverageIntro: Schema.Attribute.Component<"homepage.section-intro", false> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    eventsIntro: Schema.Attribute.Component<"homepage.section-intro", false> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    featuredIntro: Schema.Attribute.Component<"homepage.section-intro", false> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    featuredLibraries: Schema.Attribute.Relation<
      "manyToMany",
      "api::library.library"
    > &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    featuredServices: Schema.Attribute.Relation<
      "manyToMany",
      "api::service.service"
    > &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    finalBenefits: Schema.Attribute.Component<"homepage.step", true> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    finalCta: Schema.Attribute.Component<"homepage.cta-band", false> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    heroEyebrow: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    heroText: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    heroTitle: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    journalIntro: Schema.Attribute.Component<"homepage.section-intro", false> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    journeys: Schema.Attribute.Component<"homepage.journey", true> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    journeysIntro: Schema.Attribute.Component<"homepage.section-intro", false> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    knowledgeBand: Schema.Attribute.Component<"homepage.cta-band", false> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    knowledgeLinks: Schema.Attribute.Component<"homepage.link-card", true> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    locale: Schema.Attribute.String
    localizations: Schema.Attribute.Relation<
      "oneToMany",
      "api::homepage.homepage"
    >
    openIntro: Schema.Attribute.Component<"homepage.section-intro", false> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    openLinks: Schema.Attribute.Component<"homepage.link-card", true> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    plansIntro: Schema.Attribute.Component<"homepage.section-intro", false> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    publishedAt: Schema.Attribute.DateTime
    seo: Schema.Attribute.Component<"shared.seo", false> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    tasksIntro: Schema.Attribute.Component<"homepage.section-intro", false> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
  }
}

export interface ApiInternalNotificationInternalNotification
  extends Struct.CollectionTypeSchema {
  collectionName: "internal_notifications"
  info: {
    displayName: "Internal notification"
    pluralName: "internal-notifications"
    singularName: "internal-notification"
  }
  options: {
    draftAndPublish: false
  }
  pluginOptions: {
    "content-manager": {
      visible: false
    }
    "content-type-builder": {
      visible: false
    }
  }
  attributes: {
    actorId: Schema.Attribute.String & Schema.Attribute.Private
    attempts: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    detail: Schema.Attribute.Text & Schema.Attribute.Private
    eventAt: Schema.Attribute.DateTime & Schema.Attribute.Required
    eventKey: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Private &
      Schema.Attribute.Unique
    href: Schema.Attribute.String & Schema.Attribute.Private
    kind: Schema.Attribute.String & Schema.Attribute.Required
    lastError: Schema.Attribute.String & Schema.Attribute.Private
    locale: Schema.Attribute.String & Schema.Attribute.Private
    localizations: Schema.Attribute.Relation<
      "oneToMany",
      "api::internal-notification.internal-notification"
    > &
      Schema.Attribute.Private
    nextAttemptAt: Schema.Attribute.DateTime
    publishedAt: Schema.Attribute.DateTime
    sentAt: Schema.Attribute.DateTime
    state: Schema.Attribute.Enumeration<
      ["pending", "sent", "failed", "expired"]
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<"pending">
    title: Schema.Attribute.String & Schema.Attribute.Private
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
  }
}

export interface ApiLegalDocumentLegalDocument
  extends Struct.CollectionTypeSchema {
  collectionName: "legal_documents"
  info: {
    description: "Terms of use, privacy policy, data licence, cookies \u2014 served at /legal/{slug}"
    displayName: "Legal Document"
    pluralName: "legal-documents"
    singularName: "legal-document"
  }
  options: {
    draftAndPublish: true
  }
  pluginOptions: {
    i18n: {
      localized: true
    }
  }
  attributes: {
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    heroTitle: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    lead: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    locale: Schema.Attribute.String
    localizations: Schema.Attribute.Relation<
      "oneToMany",
      "api::legal-document.legal-document"
    >
    navLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    order: Schema.Attribute.Integer &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }> &
      Schema.Attribute.DefaultTo<0>
    publishedAt: Schema.Attribute.DateTime
    revisions: Schema.Attribute.Component<"legal.revision", true> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    sections: Schema.Attribute.Component<"legal.section", true> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    seo: Schema.Attribute.Component<"shared.seo", false> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    slug: Schema.Attribute.UID<"title"> &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    summaryPoints: Schema.Attribute.Component<"legal.summary-point", true> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    title: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
  }
}

export interface ApiLibraryAffiliationLibraryAffiliation
  extends Struct.CollectionTypeSchema {
  collectionName: "library_affiliations"
  info: {
    displayName: "Library Affiliation"
    pluralName: "library-affiliations"
    singularName: "library-affiliation"
  }
  options: {
    draftAndPublish: false
  }
  pluginOptions: {
    "content-manager": {
      visible: false
    }
    "content-type-builder": {
      visible: false
    }
  }
  attributes: {
    approvedAt: Schema.Attribute.DateTime
    baUserId: Schema.Attribute.String & Schema.Attribute.Required
    canGoLive: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    department: Schema.Attribute.String
    library: Schema.Attribute.Relation<"manyToOne", "api::library.library">
    locale: Schema.Attribute.String & Schema.Attribute.Private
    localizations: Schema.Attribute.Relation<
      "oneToMany",
      "api::library-affiliation.library-affiliation"
    > &
      Schema.Attribute.Private
    publishedAt: Schema.Attribute.DateTime
    role: Schema.Attribute.String
    source: Schema.Attribute.Enumeration<["claim", "team"]>
    staffRole: Schema.Attribute.Enumeration<["owner", "editor"]>
    teamMember: Schema.Attribute.Relation<
      "manyToOne",
      "plugin::access.team-member"
    >
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    verificationMethod: Schema.Attribute.Enumeration<
      ["email_domain", "vouching", "contact_us", "team"]
    > &
      Schema.Attribute.DefaultTo<"contact_us">
  }
}

export interface ApiLibraryChangeLibraryChange
  extends Struct.CollectionTypeSchema {
  collectionName: "library_changes"
  info: {
    description: "Change Records: an append-only, field-level audit trail of every library write. Written only by the change-records document middleware."
    displayName: "Library Change"
    pluralName: "library-changes"
    singularName: "library-change"
  }
  options: {
    draftAndPublish: false
  }
  pluginOptions: {
    "content-manager": {
      visible: true
    }
    "content-type-builder": {
      visible: true
    }
  }
  attributes: {
    action: Schema.Attribute.Enumeration<
      ["create", "update", "publish", "unpublish", "delete"]
    >
    actorId: Schema.Attribute.String
    actorKind: Schema.Attribute.Enumeration<
      ["contributor", "admin", "token", "system"]
    >
    actorName: Schema.Attribute.String
    batchId: Schema.Attribute.String & Schema.Attribute.Required
    changedAt: Schema.Attribute.DateTime & Schema.Attribute.Required
    contentLocale: Schema.Attribute.String
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    entityRef: Schema.Attribute.String
    field: Schema.Attribute.String & Schema.Attribute.Required
    libraryDocumentId: Schema.Attribute.String & Schema.Attribute.Required
    locale: Schema.Attribute.String & Schema.Attribute.Private
    localizations: Schema.Attribute.Relation<
      "oneToMany",
      "api::library-change.library-change"
    > &
      Schema.Attribute.Private
    next: Schema.Attribute.JSON
    previous: Schema.Attribute.JSON
    publishedAt: Schema.Attribute.DateTime
    reviewerId: Schema.Attribute.String
    source: Schema.Attribute.Enumeration<
      ["submission", "staff", "admin", "api_token", "import", "system"]
    >
    submissionDocumentId: Schema.Attribute.String
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    versionStatus: Schema.Attribute.Enumeration<["draft", "published"]>
  }
}

export interface ApiLibraryNoticeLibraryNotice
  extends Struct.CollectionTypeSchema {
  collectionName: "library_notices"
  info: {
    description: "Temporary service notices, published immediately."
    displayName: "Notice"
    pluralName: "library-notices"
    singularName: "library-notice"
  }
  options: {
    draftAndPublish: false
  }
  attributes: {
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    createdByBaUserId: Schema.Attribute.String & Schema.Attribute.Private
    endedAt: Schema.Attribute.DateTime
    endedByBaUserId: Schema.Attribute.String & Schema.Attribute.Private
    from: Schema.Attribute.Date & Schema.Attribute.Required
    hours: Schema.Attribute.JSON &
      Schema.Attribute.CustomField<"global::opening-times">
    library: Schema.Attribute.Relation<"manyToOne", "api::library.library"> &
      Schema.Attribute.Required
    locale: Schema.Attribute.String & Schema.Attribute.Private
    localizations: Schema.Attribute.Relation<
      "oneToMany",
      "api::library-notice.library-notice"
    > &
      Schema.Attribute.Private
    message: Schema.Attribute.Text &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 280
        minLength: 1
      }>
    publishedAt: Schema.Attribute.DateTime
    reason: Schema.Attribute.Enumeration<
      [
        "holiday",
        "school_holidays",
        "maintenance",
        "breakdown",
        "weather",
        "staffing",
        "works",
        "other",
      ]
    >
    scope: Schema.Attribute.Enumeration<
      ["library", "service", "day", "stop", "term_time"]
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<"library">
    scopeDay: Schema.Attribute.Enumeration<
      ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
    >
    scopeWeek: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          max: 4
          min: 1
        },
        number
      >
    source: Schema.Attribute.Enumeration<["staff", "live", "admin"]> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<"admin">
    stopId: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 10
      }>
    to: Schema.Attribute.Date
    type: Schema.Attribute.Enumeration<
      [
        "closure",
        "changed_hours",
        "service",
        "not_running",
        "times_changed",
        "stop_moved",
        "extra_visit",
      ]
    > &
      Schema.Attribute.Required
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
  }
}

export interface ApiLibraryTypeLibraryType extends Struct.CollectionTypeSchema {
  collectionName: "library_types"
  info: {
    displayName: "Library Type"
    pluralName: "library-types"
    singularName: "library-type"
  }
  options: {
    draftAndPublish: true
  }
  attributes: {
    category: Schema.Attribute.Enumeration<["Other"]> &
      Schema.Attribute.DefaultTo<"Other">
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    description: Schema.Attribute.Blocks
    icon: Schema.Attribute.JSON &
      Schema.Attribute.CustomField<
        "plugin::strapi-plugin-iconhub.iconhub",
        {
          storeIconData: true
        }
      >
    locale: Schema.Attribute.String & Schema.Attribute.Private
    localizations: Schema.Attribute.Relation<
      "oneToMany",
      "api::library-type.library-type"
    > &
      Schema.Attribute.Private
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique
    publishedAt: Schema.Attribute.DateTime
    summary: Schema.Attribute.Text
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
  }
}

export interface ApiLibraryLibrary extends Struct.CollectionTypeSchema {
  collectionName: "libraries"
  info: {
    description: ""
    displayName: "Library"
    pluralName: "libraries"
    singularName: "library"
  }
  options: {
    draftAndPublish: true
  }
  pluginOptions: {
    i18n: {
      localized: true
    }
  }
  attributes: {
    absentFacilities: Schema.Attribute.JSON &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    accessibility: Schema.Attribute.Relation<
      "manyToMany",
      "api::accessibility.accessibility"
    > &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    accessibilityNotes: Schema.Attribute.Blocks &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    admissionInfo: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    alternateNames: Schema.Attribute.JSON
    amenities: Schema.Attribute.Relation<"manyToMany", "api::amenity.amenity"> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    architect: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    area: Schema.Attribute.Relation<"manyToOne", "api::area.area"> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    bookingUrl: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    buildingInfo: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    catalogueUrl: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    city: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    classificationSystem: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    closedYear: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    closureReason: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    collectionStats: Schema.Attribute.Component<
      "library.collection-stat",
      true
    > &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    completeness: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          max: 100
          min: 0
        },
        number
      >
    contentUpdatedAt: Schema.Attribute.DateTime &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    continent: Schema.Attribute.Relation<
      "manyToOne",
      "api::continent.continent"
    > &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    country: Schema.Attribute.Relation<"manyToOne", "api::country.country"> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    description: Schema.Attribute.Blocks &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    district: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    donationUrl: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    email: Schema.Attribute.Email &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    entityRef: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    featured: Schema.Attribute.Boolean &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }> &
      Schema.Attribute.DefaultTo<false>
    foundedYear: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    gallery: Schema.Attribute.Media<"images", true> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    gaps: Schema.Attribute.JSON
    hasActiveFeed: Schema.Attribute.Boolean &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }> &
      Schema.Attribute.DefaultTo<false>
    hasStaff: Schema.Attribute.Boolean &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }> &
      Schema.Attribute.DefaultTo<false>
    heroImage: Schema.Attribute.Media<"images"> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    homeLibrary: Schema.Attribute.Relation<
      "manyToOne",
      "api::library.library"
    > &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    iiifEndpoint: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    languagesServed: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    lastVerifiedAt: Schema.Attribute.DateTime &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    libraryStats: Schema.Attribute.Component<"library.library-stat", true> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    libraryType: Schema.Attribute.Relation<
      "manyToOne",
      "api::library-type.library-type"
    > &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    locale: Schema.Attribute.String
    localizations: Schema.Attribute.Relation<
      "oneToMany",
      "api::library.library"
    >
    location: Schema.Attribute.JSON &
      Schema.Attribute.CustomField<"global::location-picker"> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    membershipUrl: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    mobileLibraries: Schema.Attribute.Relation<
      "oneToMany",
      "api::library.library"
    > &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    mobileTimetable: Schema.Attribute.JSON &
      Schema.Attribute.CustomField<"global::mobile-timetable"> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    nearestStation: Schema.Attribute.String
    openedYear: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    openingTimes: Schema.Attribute.JSON &
      Schema.Attribute.CustomField<"global::opening-times"> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    operationalStatus: Schema.Attribute.Enumeration<
      [
        "open",
        "temporarily_closed",
        "permanently_closed",
        "seasonal",
        "appointment_only",
        "planned",
        "unknown",
      ]
    > &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }> &
      Schema.Attribute.DefaultTo<"open">
    operatorName: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    operatorType: Schema.Attribute.Enumeration<
      [
        "National Government",
        "Regional Government",
        "Municipality",
        "University",
        "Religious Institution",
        "Private Foundation",
        "Independent",
        "Volunteer Managed",
        "Community Managed",
        "Other",
      ]
    > &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    phone: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    planVisitUrl: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    postalCode: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    publishedAt: Schema.Attribute.DateTime
    region: Schema.Attribute.Relation<"manyToOne", "api::region.region"> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    seo: Schema.Attribute.Component<"shared.seo", false> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    services: Schema.Attribute.Relation<"manyToMany", "api::service.service"> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    shortName: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    slug: Schema.Attribute.UID<"name"> &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    socialLinks: Schema.Attribute.Component<"shared.social", true> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    sourceRecords: Schema.Attribute.Component<"library.source-record", true> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    streetAddress: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    summary: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    timetableUrl: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    timezone: Schema.Attribute.Text &
      Schema.Attribute.CustomField<"global::timezone"> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    transitInfo: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    verifiedSections: Schema.Attribute.JSON &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    virtualTourEmbed: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    virtualTourUrl: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    visitNotes: Schema.Attribute.Blocks &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    website: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    wikidataId: Schema.Attribute.String
  }
}

export interface ApiNotificationNotification
  extends Struct.CollectionTypeSchema {
  collectionName: "notifications"
  info: {
    displayName: "Notification"
    pluralName: "notifications"
    singularName: "notification"
  }
  options: {
    draftAndPublish: false
  }
  attributes: {
    attempts: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>
    baUserId: Schema.Attribute.String & Schema.Attribute.Private
    body: Schema.Attribute.Text & Schema.Attribute.Required
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    emailPayload: Schema.Attribute.JSON & Schema.Attribute.Private
    emailPreference: Schema.Attribute.String & Schema.Attribute.Private
    emailState: Schema.Attribute.Enumeration<
      ["none", "pending", "sent", "skipped", "failed"]
    > &
      Schema.Attribute.DefaultTo<"none">
    eventKey: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Private &
      Schema.Attribute.Unique
    href: Schema.Attribute.String
    inApp: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>
    kind: Schema.Attribute.Enumeration<
      [
        "new_follower",
        "library_update",
        "submission_review",
        "drive_closed",
        "weekly_digest",
        "weekly_report",
        "recognition",
        "announcement",
        "newsletter_confirmation",
        "staff_update",
        "feed_update",
        "billing_update",
        "beta_invitation",
        "discussion_update",
      ]
    > &
      Schema.Attribute.Required
    lastError: Schema.Attribute.String & Schema.Attribute.Private
    locale: Schema.Attribute.String & Schema.Attribute.Private
    localizations: Schema.Attribute.Relation<
      "oneToMany",
      "api::notification.notification"
    > &
      Schema.Attribute.Private
    nextAttemptAt: Schema.Attribute.DateTime & Schema.Attribute.Private
    publishedAt: Schema.Attribute.DateTime
    readAt: Schema.Attribute.DateTime
    recipientEmail: Schema.Attribute.Email & Schema.Attribute.Private
    sentAt: Schema.Attribute.DateTime
    title: Schema.Attribute.String & Schema.Attribute.Required
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
  }
}

export interface ApiPagePage extends Struct.CollectionTypeSchema {
  collectionName: "pages"
  info: {
    description: ""
    displayName: "Page"
    pluralName: "pages"
    singularName: "page"
  }
  options: {
    draftAndPublish: true
  }
  pluginOptions: {
    i18n: {
      localized: true
    }
  }
  attributes: {
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    locale: Schema.Attribute.String
    localizations: Schema.Attribute.Relation<"oneToMany", "api::page.page">
    publishedAt: Schema.Attribute.DateTime
    seo: Schema.Attribute.Component<"shared.seo", false> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    slug: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    title: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
  }
}

export interface ApiPaidMembershipPaidMembership
  extends Struct.CollectionTypeSchema {
  collectionName: "paid_memberships"
  info: {
    description: "Read-only Stripe Managed Payments projection. Updated by the private billing bridge."
    displayName: "Paid membership"
    pluralName: "paid-memberships"
    singularName: "paid-membership"
  }
  options: {
    draftAndPublish: false
  }
  pluginOptions: {
    "content-manager": {
      visible: false
    }
    "content-type-builder": {
      visible: false
    }
  }
  attributes: {
    baUserId: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Private
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    locale: Schema.Attribute.String & Schema.Attribute.Private
    localizations: Schema.Attribute.Relation<
      "oneToMany",
      "api::paid-membership.paid-membership"
    > &
      Schema.Attribute.Private
    membership: Schema.Attribute.JSON &
      Schema.Attribute.Required &
      Schema.Attribute.Private
    publishedAt: Schema.Attribute.DateTime
    revision: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.Private
    subscriptionId: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Private &
      Schema.Attribute.Unique
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
  }
}

export interface ApiProVerificationProVerification
  extends Struct.CollectionTypeSchema {
  collectionName: "pro_verifications"
  info: {
    description: "Verified library staff, student or charity. Complimentary Pro while unexpired (spec \u00A76.5). Self-serve C5 flow comes in P-D1; staff create rows by hand until then."
    displayName: "Pro Verification"
    pluralName: "pro-verifications"
    singularName: "pro-verification"
  }
  options: {
    draftAndPublish: false
  }
  attributes: {
    baUserId: Schema.Attribute.String & Schema.Attribute.Required
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    expiresAt: Schema.Attribute.DateTime
    kind: Schema.Attribute.Enumeration<
      ["library_staff", "student", "charity"]
    > &
      Schema.Attribute.Required
    locale: Schema.Attribute.String & Schema.Attribute.Private
    localizations: Schema.Attribute.Relation<
      "oneToMany",
      "api::pro-verification.pro-verification"
    > &
      Schema.Attribute.Private
    publishedAt: Schema.Attribute.DateTime
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    verifiedAt: Schema.Attribute.DateTime
    verifiedEmail: Schema.Attribute.Email
  }
}

export interface ApiRedirectRedirect extends Struct.CollectionTypeSchema {
  collectionName: "redirects"
  info: {
    displayName: "Redirect"
    pluralName: "redirects"
    singularName: "redirect"
  }
  options: {
    draftAndPublish: true
  }
  attributes: {
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    destination: Schema.Attribute.String & Schema.Attribute.Required
    locale: Schema.Attribute.String & Schema.Attribute.Private
    localizations: Schema.Attribute.Relation<
      "oneToMany",
      "api::redirect.redirect"
    > &
      Schema.Attribute.Private
    permanent: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>
    publishedAt: Schema.Attribute.DateTime
    source: Schema.Attribute.String & Schema.Attribute.Required
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
  }
}

export interface ApiRegionRegion extends Struct.CollectionTypeSchema {
  collectionName: "regions"
  info: {
    description: ""
    displayName: "Region"
    pluralName: "regions"
    singularName: "region"
  }
  options: {
    draftAndPublish: true
  }
  pluginOptions: {
    i18n: {
      localized: true
    }
  }
  attributes: {
    areas: Schema.Attribute.Relation<"oneToMany", "api::area.area"> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    areasSectionLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    areaTypeLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    continent: Schema.Attribute.Relation<
      "manyToOne",
      "api::continent.continent"
    > &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    country: Schema.Attribute.Relation<"manyToOne", "api::country.country"> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    entityRef: Schema.Attribute.String &
      Schema.Attribute.Unique &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    featured: Schema.Attribute.Boolean &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }> &
      Schema.Attribute.DefaultTo<false>
    featuredLibraries: Schema.Attribute.Relation<
      "manyToMany",
      "api::library.library"
    > &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    geonamesId: Schema.Attribute.String &
      Schema.Attribute.Unique &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    gssCode: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    heroImage: Schema.Attribute.Media<"images"> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    heroTagline: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    libraries: Schema.Attribute.Relation<"oneToMany", "api::library.library"> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    locale: Schema.Attribute.String
    localizations: Schema.Attribute.Relation<"oneToMany", "api::region.region">
    mapConfig: Schema.Attribute.Component<"shared.map-config", false> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    population: Schema.Attribute.BigInteger &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }> &
      Schema.Attribute.SetMinMax<
        {
          min: 0
        },
        number
      >
    populationCoverage: Schema.Attribute.JSON &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    populationEstimates: Schema.Attribute.JSON &
      Schema.Attribute.Private &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    populationLicence: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    populationMethod: Schema.Attribute.Enumeration<
      ["direct", "sum_complete_children"]
    > &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    populationReportingCode: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    populationRetrievedAt: Schema.Attribute.DateTime &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    populationSource: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    populationSourceUrl: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    populationYear: Schema.Attribute.Integer &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }> &
      Schema.Attribute.SetMinMax<
        {
          max: 2100
          min: 1900
        },
        number
      >
    publishedAt: Schema.Attribute.DateTime
    seo: Schema.Attribute.Component<"shared.seo", false> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    shortName: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    slug: Schema.Attribute.UID<"name"> &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    sourceAttribution: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    summary: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    typeLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
  }
}

export interface ApiRoleGrantRoleGrant extends Struct.CollectionTypeSchema {
  collectionName: "role_grants"
  info: {
    description: "A Contributor Role held by a user, optionally scoped to a moderation queue and a locale (scopeLocale; `locale` is reserved by Strapi). The user-profile contributorRole is derived from these."
    displayName: "Role Grant"
    pluralName: "role-grants"
    singularName: "role-grant"
  }
  options: {
    draftAndPublish: false
  }
  attributes: {
    baUserId: Schema.Attribute.String & Schema.Attribute.Required
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    expiresAt: Schema.Attribute.DateTime
    grantedBy: Schema.Attribute.String
    locale: Schema.Attribute.String & Schema.Attribute.Private
    localizations: Schema.Attribute.Relation<
      "oneToMany",
      "api::role-grant.role-grant"
    > &
      Schema.Attribute.Private
    publishedAt: Schema.Attribute.DateTime
    queue: Schema.Attribute.Enumeration<
      ["all", "index", "knowledge", "journal", "applications", "discussions"]
    > &
      Schema.Attribute.DefaultTo<"all">
    reason: Schema.Attribute.Text
    role: Schema.Attribute.Enumeration<
      [
        "contributor",
        "verified_librarian",
        "wiki_editor",
        "journal_editor",
        "moderator",
        "editorial_board",
      ]
    > &
      Schema.Attribute.Required
    scopeLocale: Schema.Attribute.String
    source: Schema.Attribute.Enumeration<
      ["admin", "claim", "application", "migration", "team"]
    > &
      Schema.Attribute.DefaultTo<"admin">
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
  }
}

export interface ApiSavedEventSavedEvent extends Struct.CollectionTypeSchema {
  collectionName: "saved_events"
  info: {
    displayName: "Saved Event"
    pluralName: "saved-events"
    singularName: "saved-event"
  }
  options: {
    draftAndPublish: false
  }
  attributes: {
    baUserId: Schema.Attribute.String & Schema.Attribute.Private
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    eventDocumentId: Schema.Attribute.String & Schema.Attribute.Required
    locale: Schema.Attribute.String & Schema.Attribute.Private
    localizations: Schema.Attribute.Relation<
      "oneToMany",
      "api::saved-event.saved-event"
    > &
      Schema.Attribute.Private
    publishedAt: Schema.Attribute.DateTime
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    user: Schema.Attribute.Relation<
      "manyToOne",
      "plugin::users-permissions.user"
    >
  }
}

export interface ApiServiceService extends Struct.CollectionTypeSchema {
  collectionName: "services"
  info: {
    description: ""
    displayName: "Service"
    pluralName: "services"
    singularName: "service"
  }
  options: {
    draftAndPublish: true
  }
  pluginOptions: {
    i18n: {
      localized: true
    }
  }
  attributes: {
    category: Schema.Attribute.Enumeration<
      [
        "Access",
        "Learning",
        "Research",
        "Digital",
        "Community",
        "Family",
        "Business",
        "Culture",
        "Archives",
        "Other",
      ]
    > &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    description: Schema.Attribute.Blocks &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    featured: Schema.Attribute.Boolean &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }> &
      Schema.Attribute.DefaultTo<false>
    icon: Schema.Attribute.JSON &
      Schema.Attribute.CustomField<
        "plugin::strapi-plugin-iconhub.iconhub",
        {
          storeIconData: true
        }
      > &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    libraries: Schema.Attribute.Relation<"manyToMany", "api::library.library"> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    locale: Schema.Attribute.String
    localizations: Schema.Attribute.Relation<
      "oneToMany",
      "api::service.service"
    >
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    publishedAt: Schema.Attribute.DateTime
    summary: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
  }
}

export interface ApiSiteConfigSiteConfig extends Struct.SingleTypeSchema {
  collectionName: "site_configs"
  info: {
    description: "Public site configuration and copy. Leave costs blank until real figures are available."
    displayName: "Site config"
    pluralName: "site-configs"
    singularName: "site-config"
  }
  options: {
    draftAndPublish: false
  }
  attributes: {
    costBreakdown: Schema.Attribute.Text
    costCurrency: Schema.Attribute.Enumeration<["GBP", "EUR", "USD"]> &
      Schema.Attribute.DefaultTo<"GBP">
    costMonth: Schema.Attribute.Date
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    locale: Schema.Attribute.String & Schema.Attribute.Private
    localizations: Schema.Attribute.Relation<
      "oneToMany",
      "api::site-config.site-config"
    > &
      Schema.Attribute.Private
    monthlyRunningCosts: Schema.Attribute.Decimal &
      Schema.Attribute.SetMinMax<
        {
          min: 0
        },
        number
      >
    monthlySupportIncome: Schema.Attribute.Decimal &
      Schema.Attribute.SetMinMax<
        {
          min: 0
        },
        number
      >
    populationEstimates: Schema.Attribute.JSON & Schema.Attribute.Private
    publishedAt: Schema.Attribute.DateTime
    supportersLead: Schema.Attribute.Text &
      Schema.Attribute.DefaultTo<"Support helps cover the servers, maps and data behind Libraries Global. Library records, downloads and community contributions stay free for everyone.">
    supportersTitle: Schema.Attribute.String &
      Schema.Attribute.DefaultTo<"The people who *keep it open.*">
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
  }
}

export interface ApiSubscriberSubscriber extends Struct.CollectionTypeSchema {
  collectionName: "subscribers"
  info: {
    displayName: "Subscriber"
    pluralName: "subscribers"
    singularName: "subscriber"
  }
  options: {
    draftAndPublish: false
  }
  attributes: {
    baUserId: Schema.Attribute.String & Schema.Attribute.Private
    communicationLocale: Schema.Attribute.Enumeration<["en", "cs", "fr"]> &
      Schema.Attribute.DefaultTo<"en">
    confirmationSentAt: Schema.Attribute.DateTime & Schema.Attribute.Private
    confirmedAt: Schema.Attribute.DateTime
    consentedAt: Schema.Attribute.DateTime
    consentVersion: Schema.Attribute.String
    content: Schema.Attribute.Text &
      Schema.Attribute.CustomField<"plugin::tiptap-editor.RichText">
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    email: Schema.Attribute.Email & Schema.Attribute.Required
    invitedAt: Schema.Attribute.DateTime
    locale: Schema.Attribute.String & Schema.Attribute.Private
    localizations: Schema.Attribute.Relation<
      "oneToMany",
      "api::subscriber.subscriber"
    > &
      Schema.Attribute.Private
    message: Schema.Attribute.Text
    name: Schema.Attribute.String
    publishedAt: Schema.Attribute.DateTime
    source: Schema.Attribute.Enumeration<
      ["beta_landing", "footer", "journal", "legacy"]
    >
    state: Schema.Attribute.Enumeration<
      ["active", "pending_confirmation", "unsubscribed", "suppressed"]
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<"pending_confirmation">
    type: Schema.Attribute.Enumeration<["beta_waitlist", "newsletter"]> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<"newsletter">
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
  }
}

export interface ApiTopicTopic extends Struct.CollectionTypeSchema {
  collectionName: "topics_topics"
  info: {
    displayName: "Topic"
    pluralName: "topics"
    singularName: "topic"
  }
  options: {
    draftAndPublish: false
  }
  pluginOptions: {
    i18n: {
      localized: true
    }
  }
  attributes: {
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    locale: Schema.Attribute.String
    localizations: Schema.Attribute.Relation<"oneToMany", "api::topic.topic">
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    publishedAt: Schema.Attribute.DateTime
    slug: Schema.Attribute.UID<"name"> &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    status: Schema.Attribute.Enumeration<["approved", "pending", "rejected"]> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }> &
      Schema.Attribute.DefaultTo<"pending">
    suggestedByEmail: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    suggestedByUserId: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
  }
}

export interface ApiUserProfileUserProfile extends Struct.CollectionTypeSchema {
  collectionName: "user_profiles"
  info: {
    displayName: "User Profile"
    pluralName: "user-profiles"
    singularName: "user-profile"
  }
  options: {
    draftAndPublish: false
  }
  attributes: {
    affiliation: Schema.Attribute.String
    affiliationType: Schema.Attribute.Enumeration<
      ["reader", "librarian", "researcher", "archivist", "educator", "other"]
    >
    avatar: Schema.Attribute.Media<"images">
    baUserId: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Private &
      Schema.Attribute.Unique
    bio: Schema.Attribute.Text
    city: Schema.Attribute.String
    contributorNumber: Schema.Attribute.Integer & Schema.Attribute.Private
    contributorRole: Schema.Attribute.Enumeration<
      [
        "reader",
        "contributor",
        "verified_librarian",
        "wiki_editor",
        "journal_editor",
        "moderator",
        "editorial_board",
      ]
    > &
      Schema.Attribute.DefaultTo<"reader">
    country: Schema.Attribute.String
    coverImage: Schema.Attribute.Media<"images">
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    dismissedPrompts: Schema.Attribute.JSON & Schema.Attribute.Private
    earnedProUntil: Schema.Attribute.DateTime & Schema.Attribute.Private
    firstName: Schema.Attribute.String
    followedDrives: Schema.Attribute.Relation<"manyToMany", "api::drive.drive">
    followedLibraries: Schema.Attribute.Relation<
      "manyToMany",
      "api::library.library"
    >
    followedProfiles: Schema.Attribute.Relation<
      "manyToMany",
      "api::user-profile.user-profile"
    >
    interests: Schema.Attribute.JSON
    isVerifiedLibrarian: Schema.Attribute.Boolean &
      Schema.Attribute.DefaultTo<false>
    jobTitle: Schema.Attribute.String
    languages: Schema.Attribute.Component<"profile.language-entry", true>
    lastActivityDate: Schema.Attribute.String
    lastName: Schema.Attribute.String
    linkedin: Schema.Attribute.String
    locale: Schema.Attribute.String & Schema.Attribute.Private
    localizations: Schema.Attribute.Relation<
      "oneToMany",
      "api::user-profile.user-profile"
    > &
      Schema.Attribute.Private
    mastodon: Schema.Attribute.String
    notifPrefs: Schema.Attribute.JSON &
      Schema.Attribute.Private &
      Schema.Attribute.DefaultTo<{
        drives: true
        editorialMessages: true
        editsReviewed: true
        marketing: false
        newFollowers: false
        soundOn: false
        weeklyDigest: false
      }>
    orcid: Schema.Attribute.String
    points: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>
    pointsThisMonth: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>
    profileBackground: Schema.Attribute.Enumeration<
      ["violet", "coral", "mint", "amber", "blue", "rose"]
    > &
      Schema.Attribute.DefaultTo<"violet">
    profileVisibility: Schema.Attribute.Enumeration<
      ["public", "limited", "private"]
    > &
      Schema.Attribute.DefaultTo<"public">
    pronouns: Schema.Attribute.Enumeration<
      ["he_him", "she_her", "they_them", "other", "prefer_not_to_say"]
    >
    publicPrefs: Schema.Attribute.JSON
    publishedAt: Schema.Attribute.DateTime
    streak: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>
    supporterBadgeVisible: Schema.Attribute.Boolean &
      Schema.Attribute.Private &
      Schema.Attribute.DefaultTo<true>
    supporterListed: Schema.Attribute.Boolean &
      Schema.Attribute.Private &
      Schema.Attribute.DefaultTo<true>
    theme: Schema.Attribute.Enumeration<["dark", "light"]> &
      Schema.Attribute.DefaultTo<"dark">
    tier: Schema.Attribute.String & Schema.Attribute.DefaultTo<"Reader">
    timezone: Schema.Attribute.String
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    username: Schema.Attribute.String & Schema.Attribute.Unique
    website: Schema.Attribute.String
  }
}

export interface ApiWikiArticleWikiArticle extends Struct.CollectionTypeSchema {
  collectionName: "wiki_articles"
  info: {
    description: "A knowledge hub reference article"
    displayName: "Wiki Article"
    pluralName: "wiki-articles"
    singularName: "wiki-article"
  }
  options: {
    draftAndPublish: true
  }
  pluginOptions: {
    i18n: {
      localized: true
    }
  }
  attributes: {
    areas: Schema.Attribute.Relation<"manyToMany", "api::area.area"> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    articleStatus: Schema.Attribute.Enumeration<
      ["stable", "beta", "experimental", "draft", "deprecated"]
    > &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }> &
      Schema.Attribute.DefaultTo<"stable">
    author: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    body: Schema.Attribute.DynamicZone<
      [
        "content.rich-text",
        "content.image-block",
        "content.code-block",
        "content.quote-block",
        "content.callout",
      ]
    > &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    category: Schema.Attribute.Relation<"manyToOne", "api::category.category"> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    continents: Schema.Attribute.Relation<
      "manyToMany",
      "api::continent.continent"
    > &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    contributors: Schema.Attribute.Relation<
      "manyToMany",
      "api::user-profile.user-profile"
    > &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    countries: Schema.Attribute.Relation<"manyToMany", "api::country.country"> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    docsSections: Schema.Attribute.JSON &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    featured: Schema.Attribute.Boolean &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }> &
      Schema.Attribute.DefaultTo<false>
    geographyFacet: Schema.Attribute.JSON &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    heroImage: Schema.Attribute.Media<"images"> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    libraries: Schema.Attribute.Relation<"manyToMany", "api::library.library"> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    locale: Schema.Attribute.String
    localizations: Schema.Attribute.Relation<
      "oneToMany",
      "api::wiki-article.wiki-article"
    >
    priority: Schema.Attribute.Integer &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    publishedAt: Schema.Attribute.DateTime
    readingTimeMinutes: Schema.Attribute.Integer &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }> &
      Schema.Attribute.SetMinMax<
        {
          min: 1
        },
        number
      >
    regions: Schema.Attribute.Relation<"manyToMany", "api::region.region"> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    relatedArticles: Schema.Attribute.Relation<
      "manyToMany",
      "api::wiki-article.wiki-article"
    > &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    section: Schema.Attribute.Relation<
      "manyToOne",
      "api::wiki-section.wiki-section"
    > &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    seo: Schema.Attribute.Component<"shared.seo", false> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    slug: Schema.Attribute.UID<"title"> &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    summary: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    title: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    topics: Schema.Attribute.Relation<"manyToMany", "api::topic.topic"> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
  }
}

export interface ApiWikiLandingWikiLanding extends Struct.SingleTypeSchema {
  collectionName: "wiki_landing"
  info: {
    description: "The knowledge hub landing page"
    displayName: "Wiki Landing"
    pluralName: "wiki-landings"
    singularName: "wiki-landing"
  }
  options: {
    draftAndPublish: true
  }
  pluginOptions: {
    i18n: {
      localized: true
    }
  }
  attributes: {
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    heroEyebrow: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    heroText: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    heroTitle: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    locale: Schema.Attribute.String
    localizations: Schema.Attribute.Relation<
      "oneToMany",
      "api::wiki-landing.wiki-landing"
    >
    publishedAt: Schema.Attribute.DateTime
    quickStartCards: Schema.Attribute.Relation<
      "manyToMany",
      "api::wiki-article.wiki-article"
    > &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    seo: Schema.Attribute.Component<"shared.seo", false> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    version: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
  }
}

export interface ApiWikiSectionWikiSection extends Struct.CollectionTypeSchema {
  collectionName: "wiki_sections"
  info: {
    description: "A top-level section grouping wiki articles"
    displayName: "Wiki Section"
    pluralName: "wiki-sections"
    singularName: "wiki-section"
  }
  options: {
    draftAndPublish: false
  }
  pluginOptions: {
    i18n: {
      localized: true
    }
  }
  attributes: {
    articles: Schema.Attribute.Relation<
      "oneToMany",
      "api::wiki-article.wiki-article"
    > &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    description: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    icon: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    label: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    locale: Schema.Attribute.String
    localizations: Schema.Attribute.Relation<
      "oneToMany",
      "api::wiki-section.wiki-section"
    >
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    order: Schema.Attribute.Integer &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    publishedAt: Schema.Attribute.DateTime
    slug: Schema.Attribute.UID<"name"> &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
  }
}

export interface PluginAccessTeam extends Struct.CollectionTypeSchema {
  collectionName: "teams"
  info: {
    description: "A Team organisation: a library service's organiser and members. Active membership gives Pro personally and Team features on the Team's libraries only. Edited from the access plugin's Teams page."
    displayName: "Team"
    pluralName: "teams"
    singularName: "team"
  }
  options: {
    draftAndPublish: false
  }
  pluginOptions: {
    "content-manager": {
      visible: false
    }
    "content-type-builder": {
      visible: false
    }
  }
  attributes: {
    billingAccountId: Schema.Attribute.String &
      Schema.Attribute.Private &
      Schema.Attribute.Unique
    billingArchived: Schema.Attribute.Boolean &
      Schema.Attribute.Private &
      Schema.Attribute.DefaultTo<false>
    billingMembership: Schema.Attribute.JSON & Schema.Attribute.Private
    billingMode: Schema.Attribute.Enumeration<["sandbox", "live"]> &
      Schema.Attribute.Private
    billingRevision: Schema.Attribute.Integer &
      Schema.Attribute.Private &
      Schema.Attribute.DefaultTo<0>
    billingSuspended: Schema.Attribute.Boolean &
      Schema.Attribute.Private &
      Schema.Attribute.DefaultTo<false>
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    createdByAdmin: Schema.Attribute.String & Schema.Attribute.Private
    expiresAt: Schema.Attribute.DateTime
    libraries: Schema.Attribute.Relation<"manyToMany", "api::library.library">
    locale: Schema.Attribute.String & Schema.Attribute.Private
    localizations: Schema.Attribute.Relation<
      "oneToMany",
      "plugin::access.team"
    > &
      Schema.Attribute.Private
    name: Schema.Attribute.String & Schema.Attribute.Required
    notes: Schema.Attribute.Text & Schema.Attribute.Private
    pendingSeats: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          min: 1
        },
        number
      >
    publicServiceApproved: Schema.Attribute.Boolean &
      Schema.Attribute.DefaultTo<false>
    publishedAt: Schema.Attribute.DateTime
    seats: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          min: 1
        },
        number
      > &
      Schema.Attribute.DefaultTo<5>
    slug: Schema.Attribute.UID<"name">
    source: Schema.Attribute.Enumeration<["admin", "checkout"]> &
      Schema.Attribute.DefaultTo<"admin">
    status: Schema.Attribute.Enumeration<["active", "lapsed"]> &
      Schema.Attribute.DefaultTo<"active">
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    verifiedAt: Schema.Attribute.DateTime
  }
}

export interface PluginAccessTeamMember extends Struct.CollectionTypeSchema {
  collectionName: "team_members"
  info: {
    description: "A person's seat on a Team: invited (by email, with a token), active (after accepting) or removed. Unique per team and email, enforced by the teams service under the team's lock."
    displayName: "Team Member"
    pluralName: "team-members"
    singularName: "team-member"
  }
  options: {
    draftAndPublish: false
  }
  pluginOptions: {
    "content-manager": {
      visible: false
    }
    "content-type-builder": {
      visible: false
    }
  }
  attributes: {
    acceptedAt: Schema.Attribute.DateTime
    baUserId: Schema.Attribute.String
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    email: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Private
    invitedAt: Schema.Attribute.DateTime
    invitedBy: Schema.Attribute.String & Schema.Attribute.Private
    locale: Schema.Attribute.String & Schema.Attribute.Private
    localizations: Schema.Attribute.Relation<
      "oneToMany",
      "plugin::access.team-member"
    > &
      Schema.Attribute.Private
    preassign: Schema.Attribute.JSON & Schema.Attribute.Private
    publishedAt: Schema.Attribute.DateTime
    removedAt: Schema.Attribute.DateTime
    status: Schema.Attribute.Enumeration<["invited", "active", "removed"]> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<"invited">
    team: Schema.Attribute.Relation<"manyToOne", "plugin::access.team">
    teamRole: Schema.Attribute.Enumeration<["organiser", "member"]> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<"member">
    tokenHash: Schema.Attribute.String &
      Schema.Attribute.Private &
      Schema.Attribute.Unique
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
  }
}

export interface PluginBetaInvitesInvitation
  extends Struct.CollectionTypeSchema {
  collectionName: "beta_invitations"
  info: {
    displayName: "Beta invitation"
    pluralName: "invitations"
    singularName: "invitation"
  }
  options: {
    draftAndPublish: false
  }
  pluginOptions: {
    "content-manager": {
      visible: false
    }
    "content-type-builder": {
      visible: false
    }
  }
  attributes: {
    acceptedAt: Schema.Attribute.DateTime
    accessExpiresAt: Schema.Attribute.DateTime
    consentedAt: Schema.Attribute.DateTime & Schema.Attribute.Required
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    expiresAt: Schema.Attribute.DateTime & Schema.Attribute.Required
    issuedAt: Schema.Attribute.DateTime & Schema.Attribute.Required
    issuedBy: Schema.Attribute.String & Schema.Attribute.Private
    locale: Schema.Attribute.String & Schema.Attribute.Private
    localizations: Schema.Attribute.Relation<
      "oneToMany",
      "plugin::beta-invites.invitation"
    > &
      Schema.Attribute.Private
    notificationId: Schema.Attribute.String & Schema.Attribute.Private
    publishedAt: Schema.Attribute.DateTime
    revokedAt: Schema.Attribute.DateTime
    revokedBy: Schema.Attribute.String & Schema.Attribute.Private
    sentAt: Schema.Attribute.DateTime
    subscriberDocumentId: Schema.Attribute.String & Schema.Attribute.Required
    tokenCiphertext: Schema.Attribute.Text & Schema.Attribute.Private
    tokenHash: Schema.Attribute.String &
      Schema.Attribute.Private &
      Schema.Attribute.Unique
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
  }
}

export interface PluginContentModerationOptionSuggestion
  extends Struct.CollectionTypeSchema {
  collectionName: "cm_option_suggestions"
  info: {
    description: "A new accessibility feature, service, amenity or library type that contributors asked for, posted directly or named in a correction. The editorial board reviews them monthly."
    displayName: "Option Suggestion"
    pluralName: "option-suggestions"
    singularName: "option-suggestion"
  }
  options: {
    draftAndPublish: false
  }
  pluginOptions: {
    "content-manager": {
      visible: false
    }
    "content-type-builder": {
      visible: false
    }
  }
  attributes: {
    acceptedOptionDocumentId: Schema.Attribute.String
    comparison: Schema.Attribute.JSON
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    decidedAt: Schema.Attribute.DateTime
    decidedBy: Schema.Attribute.String
    decisionKind: Schema.Attribute.Enumeration<
      ["add", "update", "merge", "decline"]
    >
    decisionNote: Schema.Attribute.Text
    description: Schema.Attribute.Text &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 400
      }>
    libraries: Schema.Attribute.JSON
    locale: Schema.Attribute.String & Schema.Attribute.Private
    localizations: Schema.Attribute.Relation<
      "oneToMany",
      "plugin::content-moderation.option-suggestion"
    > &
      Schema.Attribute.Private
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 80
      }>
    nameKey: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 80
      }>
    optionKey: Schema.Attribute.Enumeration<
      ["accessibility", "amenities", "services", "library_types"]
    > &
      Schema.Attribute.Required
    publicationAt: Schema.Attribute.DateTime
    publicationHistory: Schema.Attribute.JSON & Schema.Attribute.Private
    publicationReviewedAt: Schema.Attribute.DateTime
    publicationReviewedBy: Schema.Attribute.String & Schema.Attribute.Private
    publicationStatus: Schema.Attribute.Enumeration<
      ["pending", "published", "rejected"]
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<"published">
    publicDecisionNote: Schema.Attribute.Text &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 2000
      }>
    publishedAt: Schema.Attribute.DateTime
    requests: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>
    status: Schema.Attribute.Enumeration<
      ["open", "reviewing", "planned", "accepted", "declined", "removed"]
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<"open">
    submissionIds: Schema.Attribute.JSON
    suggestedBy: Schema.Attribute.String
    unlinkedLibraries: Schema.Attribute.JSON
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    version: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<0>
  }
}

export interface PluginContentModerationOptionVote
  extends Struct.CollectionTypeSchema {
  collectionName: "cm_option_votes"
  info: {
    displayName: "Option Vote"
    pluralName: "option-votes"
    singularName: "option-vote"
  }
  options: {
    draftAndPublish: false
  }
  pluginOptions: {
    "content-manager": {
      visible: false
    }
    "content-type-builder": {
      visible: false
    }
  }
  attributes: {
    baUserId: Schema.Attribute.String & Schema.Attribute.Required
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    locale: Schema.Attribute.String & Schema.Attribute.Private
    localizations: Schema.Attribute.Relation<
      "oneToMany",
      "plugin::content-moderation.option-vote"
    > &
      Schema.Attribute.Private
    publishedAt: Schema.Attribute.DateTime
    suggestionDocumentId: Schema.Attribute.String & Schema.Attribute.Required
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
  }
}

export interface PluginContentModerationReviewEvent
  extends Struct.CollectionTypeSchema {
  collectionName: "cm_review_events"
  info: {
    description: "One row per Submission State change: who moved it, from what, to what, with what note. Append-only."
    displayName: "Review Event"
    pluralName: "review-events"
    singularName: "review-event"
  }
  options: {
    draftAndPublish: false
  }
  pluginOptions: {
    "content-manager": {
      visible: false
    }
    "content-type-builder": {
      visible: false
    }
  }
  attributes: {
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    fromStatus: Schema.Attribute.Enumeration<
      ["draft", "pending", "approved", "rejected", "needs_info"]
    >
    locale: Schema.Attribute.String & Schema.Attribute.Private
    localizations: Schema.Attribute.Relation<
      "oneToMany",
      "plugin::content-moderation.review-event"
    > &
      Schema.Attribute.Private
    note: Schema.Attribute.Text
    publishedAt: Schema.Attribute.DateTime
    reviewerId: Schema.Attribute.String
    reviewerKind: Schema.Attribute.Enumeration<
      ["admin", "contributor", "staff", "system"]
    >
    submissionDocumentId: Schema.Attribute.String & Schema.Attribute.Required
    toStatus: Schema.Attribute.Enumeration<
      ["draft", "pending", "approved", "rejected", "needs_info"]
    >
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
  }
}

export interface PluginContentModerationSubmission
  extends Struct.CollectionTypeSchema {
  collectionName: "cm_submissions"
  info: {
    displayName: "Submission"
    pluralName: "submissions"
    singularName: "submission"
  }
  options: {
    draftAndPublish: false
  }
  pluginOptions: {
    "content-manager": {
      visible: false
    }
    "content-type-builder": {
      visible: false
    }
  }
  attributes: {
    contentLocale: Schema.Attribute.String & Schema.Attribute.DefaultTo<"en">
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    draftData: Schema.Attribute.JSON
    draftRevision: Schema.Attribute.Integer &
      Schema.Attribute.Private &
      Schema.Attribute.DefaultTo<0>
    driveDocumentId: Schema.Attribute.String
    editSummary: Schema.Attribute.String
    evidenceType: Schema.Attribute.Enumeration<
      [
        "institutional_url",
        "on_site_photo",
        "on_site_visit",
        "press_release",
        "personal_communication",
        "my_institutional_affiliation",
        "other",
      ]
    >
    evidenceUrl: Schema.Attribute.String
    fields: Schema.Attribute.JSON
    locale: Schema.Attribute.String & Schema.Attribute.Private
    localizations: Schema.Attribute.Relation<
      "oneToMany",
      "plugin::content-moderation.submission"
    > &
      Schema.Attribute.Private
    note: Schema.Attribute.Text
    payloadHash: Schema.Attribute.String & Schema.Attribute.Private
    publishedAt: Schema.Attribute.DateTime
    resultDocumentId: Schema.Attribute.String
    reviewedAt: Schema.Attribute.DateTime
    reviewedByUserId: Schema.Attribute.String
    reviewerAssignedTo: Schema.Attribute.String
    reviewNote: Schema.Attribute.Text
    status: Schema.Attribute.Enumeration<
      ["draft", "pending", "approved", "rejected", "needs_info"]
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<"draft">
    stepCompleted: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>
    submissionType: Schema.Attribute.Enumeration<
      [
        "correction",
        "new_library",
        "library_claim",
        "library_edit",
        "event_feed",
        "wiki_edit",
        "blog_submission",
        "topic_suggestion",
        "role_application",
        "drive_proposal",
      ]
    > &
      Schema.Attribute.Required
    submittedByEmail: Schema.Attribute.String & Schema.Attribute.Required
    submittedByName: Schema.Attribute.String
    submittedByUserId: Schema.Attribute.String & Schema.Attribute.Required
    targetDocumentId: Schema.Attribute.String
    targetEntityType: Schema.Attribute.Enumeration<
      [
        "library",
        "country",
        "region",
        "area",
        "wiki_article",
        "blog_article",
        "user_profile",
        "topic",
        "drive",
      ]
    >
    targetSlug: Schema.Attribute.String
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    verificationMethod: Schema.Attribute.Enumeration<
      ["email_domain", "vouching", "contact_us"]
    >
  }
}

export interface PluginContentModerationSubmissionUpload
  extends Struct.CollectionTypeSchema {
  collectionName: "cm_submission_uploads"
  info: {
    displayName: "Submission Upload"
    pluralName: "submission-uploads"
    singularName: "submission-upload"
  }
  options: {
    draftAndPublish: false
  }
  pluginOptions: {
    "content-manager": {
      visible: false
    }
    "content-type-builder": {
      visible: false
    }
  }
  attributes: {
    baUserId: Schema.Attribute.String & Schema.Attribute.Required
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    fileId: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.Unique
    locale: Schema.Attribute.String & Schema.Attribute.Private
    localizations: Schema.Attribute.Relation<
      "oneToMany",
      "plugin::content-moderation.submission-upload"
    > &
      Schema.Attribute.Private
    publishedAt: Schema.Attribute.DateTime
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
  }
}

export interface PluginContentModerationSuggestionRound
  extends Struct.CollectionTypeSchema {
  collectionName: "cm_suggestion_rounds"
  info: {
    displayName: "Suggestion review round"
    pluralName: "suggestion-rounds"
    singularName: "suggestion-round"
  }
  options: {
    draftAndPublish: false
  }
  pluginOptions: {
    "content-manager": {
      visible: false
    }
    "content-type-builder": {
      visible: false
    }
  }
  attributes: {
    capacity: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMax<
        {
          max: 20
          min: 1
        },
        number
      > &
      Schema.Attribute.DefaultTo<5>
    closedAt: Schema.Attribute.DateTime
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    cutoffAt: Schema.Attribute.DateTime & Schema.Attribute.Required
    key: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique
    locale: Schema.Attribute.String & Schema.Attribute.Private
    localizations: Schema.Attribute.Relation<
      "oneToMany",
      "plugin::content-moderation.suggestion-round"
    > &
      Schema.Attribute.Private
    opensAt: Schema.Attribute.DateTime & Schema.Attribute.Required
    publishedAt: Schema.Attribute.DateTime
    reviewAt: Schema.Attribute.DateTime & Schema.Attribute.Required
    shortlist: Schema.Attribute.JSON
    snapshotAt: Schema.Attribute.DateTime
    state: Schema.Attribute.Enumeration<["voting", "review", "closed"]> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<"voting">
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    version: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<0>
  }
}

export interface PluginContentModerationUploadReservation
  extends Struct.CollectionTypeSchema {
  collectionName: "cm_upload_reservations"
  info: {
    displayName: "Upload Reservation"
    pluralName: "upload-reservations"
    singularName: "upload-reservation"
  }
  options: {
    draftAndPublish: false
  }
  pluginOptions: {
    "content-manager": {
      visible: false
    }
    "content-type-builder": {
      visible: false
    }
  }
  attributes: {
    baUserId: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Private
    bytes: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMax<
        {
          min: 1
        },
        number
      >
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    expiresAt: Schema.Attribute.DateTime & Schema.Attribute.Required
    fileId: Schema.Attribute.Integer
    locale: Schema.Attribute.String & Schema.Attribute.Private
    localizations: Schema.Attribute.Relation<
      "oneToMany",
      "plugin::content-moderation.upload-reservation"
    > &
      Schema.Attribute.Private
    publishedAt: Schema.Attribute.DateTime
    purpose: Schema.Attribute.Enumeration<
      ["article", "submission", "avatar", "cover"]
    > &
      Schema.Attribute.Required
    quotaDate: Schema.Attribute.String & Schema.Attribute.Required
    reservationId: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique
    status: Schema.Attribute.Enumeration<
      ["reserved", "completed", "cancelled"]
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<"reserved">
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
  }
}

export interface PluginContentReleasesRelease
  extends Struct.CollectionTypeSchema {
  collectionName: "strapi_releases"
  info: {
    displayName: "Release"
    pluralName: "releases"
    singularName: "release"
  }
  options: {
    draftAndPublish: false
  }
  pluginOptions: {
    "content-manager": {
      visible: false
    }
    "content-type-builder": {
      visible: false
    }
  }
  attributes: {
    actions: Schema.Attribute.Relation<
      "oneToMany",
      "plugin::content-releases.release-action"
    >
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    locale: Schema.Attribute.String & Schema.Attribute.Private
    localizations: Schema.Attribute.Relation<
      "oneToMany",
      "plugin::content-releases.release"
    > &
      Schema.Attribute.Private
    name: Schema.Attribute.String & Schema.Attribute.Required
    publishedAt: Schema.Attribute.DateTime
    releasedAt: Schema.Attribute.DateTime
    scheduledAt: Schema.Attribute.DateTime
    status: Schema.Attribute.Enumeration<
      ["ready", "blocked", "failed", "done", "empty"]
    > &
      Schema.Attribute.Required
    timezone: Schema.Attribute.String
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
  }
}

export interface PluginContentReleasesReleaseAction
  extends Struct.CollectionTypeSchema {
  collectionName: "strapi_release_actions"
  info: {
    displayName: "Release Action"
    pluralName: "release-actions"
    singularName: "release-action"
  }
  options: {
    draftAndPublish: false
  }
  pluginOptions: {
    "content-manager": {
      visible: false
    }
    "content-type-builder": {
      visible: false
    }
  }
  attributes: {
    contentType: Schema.Attribute.String & Schema.Attribute.Required
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    entryDocumentId: Schema.Attribute.String
    isEntryValid: Schema.Attribute.Boolean
    locale: Schema.Attribute.String & Schema.Attribute.Private
    localizations: Schema.Attribute.Relation<
      "oneToMany",
      "plugin::content-releases.release-action"
    > &
      Schema.Attribute.Private
    publishedAt: Schema.Attribute.DateTime
    release: Schema.Attribute.Relation<
      "manyToOne",
      "plugin::content-releases.release"
    >
    type: Schema.Attribute.Enumeration<["publish", "unpublish"]> &
      Schema.Attribute.Required
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
  }
}

export interface PluginDiscussionsAttachment
  extends Struct.CollectionTypeSchema {
  collectionName: "discussions_attachments"
  info: {
    displayName: "Discussion attachment"
    pluralName: "attachments"
    singularName: "attachment"
  }
  options: {
    draftAndPublish: false
  }
  pluginOptions: {
    "content-manager": {
      visible: false
    }
    "content-type-builder": {
      visible: false
    }
  }
  attributes: {
    altText: Schema.Attribute.String & Schema.Attribute.Required
    bytes: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<0>
    caption: Schema.Attribute.Text
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    height: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<0>
    locale: Schema.Attribute.String & Schema.Attribute.Private
    localizations: Schema.Attribute.Relation<
      "oneToMany",
      "plugin::discussions.attachment"
    > &
      Schema.Attribute.Private
    mime: Schema.Attribute.String & Schema.Attribute.Required
    ownerKey: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Private
    publishedAt: Schema.Attribute.DateTime
    retired: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>
    storageKey: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Private &
      Schema.Attribute.Unique
    subjectId: Schema.Attribute.String & Schema.Attribute.Required
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    width: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<0>
  }
}

export interface PluginDiscussionsAuditEvent
  extends Struct.CollectionTypeSchema {
  collectionName: "discussions_audit_events"
  info: {
    displayName: "Discussion audit-event"
    pluralName: "audit-events"
    singularName: "audit-event"
  }
  options: {
    draftAndPublish: false
  }
  pluginOptions: {
    "content-manager": {
      visible: false
    }
    "content-type-builder": {
      visible: false
    }
  }
  attributes: {
    action: Schema.Attribute.String & Schema.Attribute.Required
    actorKey: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Private
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    detail: Schema.Attribute.JSON & Schema.Attribute.Private
    locale: Schema.Attribute.String & Schema.Attribute.Private
    localizations: Schema.Attribute.Relation<
      "oneToMany",
      "plugin::discussions.audit-event"
    > &
      Schema.Attribute.Private
    publishedAt: Schema.Attribute.DateTime
    recordId: Schema.Attribute.String & Schema.Attribute.Required
    recordType: Schema.Attribute.Enumeration<["thread", "reply"]> &
      Schema.Attribute.Required
    threadId: Schema.Attribute.String & Schema.Attribute.Required
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
  }
}

export interface PluginDiscussionsContextLink
  extends Struct.CollectionTypeSchema {
  collectionName: "discussions_context_links"
  info: {
    displayName: "Discussion context-link"
    pluralName: "context-links"
    singularName: "context-link"
  }
  options: {
    draftAndPublish: false
  }
  pluginOptions: {
    "content-manager": {
      visible: false
    }
    "content-type-builder": {
      visible: false
    }
  }
  attributes: {
    actorKey: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Private
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    dedupeKey: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Private &
      Schema.Attribute.Unique
    featuredKey: Schema.Attribute.String &
      Schema.Attribute.Private &
      Schema.Attribute.Unique
    locale: Schema.Attribute.String & Schema.Attribute.Private
    localizations: Schema.Attribute.Relation<
      "oneToMany",
      "plugin::discussions.context-link"
    > &
      Schema.Attribute.Private
    moderationFeedback: Schema.Attribute.Text & Schema.Attribute.Private
    publishedAt: Schema.Attribute.DateTime
    state: Schema.Attribute.Enumeration<
      ["pending", "visible", "rejected", "removed"]
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<"pending">
    target: Schema.Attribute.JSON & Schema.Attribute.Private
    targetKey: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Private
    targetUid: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Private
    threadId: Schema.Attribute.String & Schema.Attribute.Required
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    version: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<0>
  }
}

export interface PluginDiscussionsContextSetting
  extends Struct.CollectionTypeSchema {
  collectionName: "discussions_context_settings"
  info: {
    displayName: "Discussion context-setting"
    pluralName: "context-settings"
    singularName: "context-setting"
  }
  options: {
    draftAndPublish: false
  }
  pluginOptions: {
    "content-manager": {
      visible: false
    }
    "content-type-builder": {
      visible: false
    }
  }
  attributes: {
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    enabled: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>
    locale: Schema.Attribute.String & Schema.Attribute.Private
    localizations: Schema.Attribute.Relation<
      "oneToMany",
      "plugin::discussions.context-setting"
    > &
      Schema.Attribute.Private
    publishedAt: Schema.Attribute.DateTime
    target: Schema.Attribute.JSON & Schema.Attribute.Private
    targetKey: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Private &
      Schema.Attribute.Unique
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    version: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<0>
  }
}

export interface PluginDiscussionsErasedActor
  extends Struct.CollectionTypeSchema {
  collectionName: "discussions_erased_actors"
  info: {
    displayName: "Discussion erased-actor"
    pluralName: "erased-actors"
    singularName: "erased-actor"
  }
  options: {
    draftAndPublish: false
  }
  pluginOptions: {
    "content-manager": {
      visible: false
    }
    "content-type-builder": {
      visible: false
    }
  }
  attributes: {
    actorHash: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Private &
      Schema.Attribute.Unique
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    locale: Schema.Attribute.String & Schema.Attribute.Private
    localizations: Schema.Attribute.Relation<
      "oneToMany",
      "plugin::discussions.erased-actor"
    > &
      Schema.Attribute.Private
    publishedAt: Schema.Attribute.DateTime
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
  }
}

export interface PluginDiscussionsOutbox extends Struct.CollectionTypeSchema {
  collectionName: "discussions_outboxs"
  info: {
    displayName: "Discussion outbox"
    pluralName: "outboxs"
    singularName: "outbox"
  }
  options: {
    draftAndPublish: false
  }
  pluginOptions: {
    "content-manager": {
      visible: false
    }
    "content-type-builder": {
      visible: false
    }
  }
  attributes: {
    actorKey: Schema.Attribute.String & Schema.Attribute.Private
    attempts: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<0>
    claimedAt: Schema.Attribute.DateTime
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    dedupeKey: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Private &
      Schema.Attribute.Unique
    event: Schema.Attribute.JSON &
      Schema.Attribute.Required &
      Schema.Attribute.Private
    hookDelivered: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>
    lastError: Schema.Attribute.Text & Schema.Attribute.Private
    locale: Schema.Attribute.String & Schema.Attribute.Private
    localizations: Schema.Attribute.Relation<
      "oneToMany",
      "plugin::discussions.outbox"
    > &
      Schema.Attribute.Private
    publishedAt: Schema.Attribute.DateTime
    state: Schema.Attribute.Enumeration<["pending", "dispatching", "done"]> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<"pending">
    subscriptionCursor: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<0>
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
  }
}

export interface PluginDiscussionsRateWindow
  extends Struct.CollectionTypeSchema {
  collectionName: "discussions_rate_windows"
  info: {
    displayName: "Discussion rate-window"
    pluralName: "rate-windows"
    singularName: "rate-window"
  }
  options: {
    draftAndPublish: false
  }
  pluginOptions: {
    "content-manager": {
      visible: false
    }
    "content-type-builder": {
      visible: false
    }
  }
  attributes: {
    actions: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<0>
    actorKey: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Private &
      Schema.Attribute.Unique
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    locale: Schema.Attribute.String & Schema.Attribute.Private
    localizations: Schema.Attribute.Relation<
      "oneToMany",
      "plugin::discussions.rate-window"
    > &
      Schema.Attribute.Private
    publishedAt: Schema.Attribute.DateTime
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    windowStartedAt: Schema.Attribute.DateTime & Schema.Attribute.Required
  }
}

export interface PluginDiscussionsReaction extends Struct.CollectionTypeSchema {
  collectionName: "discussions_reactions"
  info: {
    displayName: "Discussion reaction"
    pluralName: "reactions"
    singularName: "reaction"
  }
  options: {
    draftAndPublish: false
  }
  pluginOptions: {
    "content-manager": {
      visible: false
    }
    "content-type-builder": {
      visible: false
    }
  }
  attributes: {
    actorKey: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Private
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    dedupeKey: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Private &
      Schema.Attribute.Unique
    locale: Schema.Attribute.String & Schema.Attribute.Private
    localizations: Schema.Attribute.Relation<
      "oneToMany",
      "plugin::discussions.reaction"
    > &
      Schema.Attribute.Private
    publishedAt: Schema.Attribute.DateTime
    recordId: Schema.Attribute.String & Schema.Attribute.Required
    recordType: Schema.Attribute.Enumeration<["thread", "reply"]> &
      Schema.Attribute.Required
    threadId: Schema.Attribute.String & Schema.Attribute.Required
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    value: Schema.Attribute.Enumeration<["like", "love"]> &
      Schema.Attribute.Required
  }
}

export interface PluginDiscussionsReply extends Struct.CollectionTypeSchema {
  collectionName: "discussions_replys"
  info: {
    displayName: "Discussion reply"
    pluralName: "replys"
    singularName: "reply"
  }
  options: {
    draftAndPublish: false
  }
  pluginOptions: {
    "content-manager": {
      visible: false
    }
    "content-type-builder": {
      visible: false
    }
  }
  attributes: {
    attachments: Schema.Attribute.JSON & Schema.Attribute.Private
    authorKey: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Private
    authorName: Schema.Attribute.String & Schema.Attribute.Required
    authorProfile: Schema.Attribute.JSON
    body: Schema.Attribute.Text & Schema.Attribute.DefaultTo<"">
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    language: Schema.Attribute.String & Schema.Attribute.Required
    locale: Schema.Attribute.String & Schema.Attribute.Private
    localizations: Schema.Attribute.Relation<
      "oneToMany",
      "plugin::discussions.reply"
    > &
      Schema.Attribute.Private
    moderationFeedback: Schema.Attribute.Text & Schema.Attribute.Private
    parentId: Schema.Attribute.String
    profanityException: Schema.Attribute.Boolean &
      Schema.Attribute.DefaultTo<false>
    publishedAt: Schema.Attribute.DateTime
    quote: Schema.Attribute.JSON & Schema.Attribute.Private
    state: Schema.Attribute.Enumeration<
      ["pending", "visible", "rejected", "removed"]
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<"pending">
    threadId: Schema.Attribute.String & Schema.Attribute.Required
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    version: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<0>
  }
}

export interface PluginDiscussionsReport extends Struct.CollectionTypeSchema {
  collectionName: "discussions_reports"
  info: {
    displayName: "Discussion report"
    pluralName: "reports"
    singularName: "report"
  }
  options: {
    draftAndPublish: false
  }
  pluginOptions: {
    "content-manager": {
      visible: false
    }
    "content-type-builder": {
      visible: false
    }
  }
  attributes: {
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    dedupeKey: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Private &
      Schema.Attribute.Unique
    locale: Schema.Attribute.String & Schema.Attribute.Private
    localizations: Schema.Attribute.Relation<
      "oneToMany",
      "plugin::discussions.report"
    > &
      Schema.Attribute.Private
    publishedAt: Schema.Attribute.DateTime
    reason: Schema.Attribute.Text &
      Schema.Attribute.Required &
      Schema.Attribute.Private
    recordId: Schema.Attribute.String & Schema.Attribute.Required
    recordType: Schema.Attribute.Enumeration<["thread", "reply"]> &
      Schema.Attribute.Required
    recordVersion: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<0>
    reporterKey: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Private
    reviewerKey: Schema.Attribute.String & Schema.Attribute.Private
    reviewNote: Schema.Attribute.Text & Schema.Attribute.Private
    snapshotAttachments: Schema.Attribute.JSON & Schema.Attribute.Private
    snapshotBody: Schema.Attribute.Text & Schema.Attribute.Private
    snapshotTitle: Schema.Attribute.String & Schema.Attribute.Private
    state: Schema.Attribute.Enumeration<["open", "dismissed", "actioned"]> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<"open">
    threadId: Schema.Attribute.String & Schema.Attribute.Required
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    version: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<0>
  }
}

export interface PluginDiscussionsRevision extends Struct.CollectionTypeSchema {
  collectionName: "discussions_revisions"
  info: {
    displayName: "Discussion revision"
    pluralName: "revisions"
    singularName: "revision"
  }
  options: {
    draftAndPublish: false
  }
  pluginOptions: {
    "content-manager": {
      visible: false
    }
    "content-type-builder": {
      visible: false
    }
  }
  attributes: {
    attachments: Schema.Attribute.JSON & Schema.Attribute.Private
    authorKey: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Private
    authorName: Schema.Attribute.String & Schema.Attribute.Required
    authorProfile: Schema.Attribute.JSON
    baseVersion: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<0>
    body: Schema.Attribute.Text &
      Schema.Attribute.Required &
      Schema.Attribute.Private
    contentFlags: Schema.Attribute.JSON & Schema.Attribute.Private
    contributorFeedback: Schema.Attribute.Text & Schema.Attribute.Private
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    decidedAt: Schema.Attribute.DateTime
    locale: Schema.Attribute.String & Schema.Attribute.Private
    localizations: Schema.Attribute.Relation<
      "oneToMany",
      "plugin::discussions.revision"
    > &
      Schema.Attribute.Private
    publishedAt: Schema.Attribute.DateTime
    quote: Schema.Attribute.JSON & Schema.Attribute.Private
    recordId: Schema.Attribute.String & Schema.Attribute.Required
    recordType: Schema.Attribute.Enumeration<["thread", "reply"]> &
      Schema.Attribute.Required
    reviewerKey: Schema.Attribute.String & Schema.Attribute.Private
    reviewNote: Schema.Attribute.Text & Schema.Attribute.Private
    state: Schema.Attribute.Enumeration<
      ["pending", "approved", "rejected", "changes_requested"]
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<"pending">
    threadId: Schema.Attribute.String & Schema.Attribute.Required
    title: Schema.Attribute.String
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
  }
}

export interface PluginDiscussionsSanction extends Struct.CollectionTypeSchema {
  collectionName: "discussions_sanctions"
  info: {
    displayName: "Discussion sanction"
    pluralName: "sanctions"
    singularName: "sanction"
  }
  options: {
    draftAndPublish: false
  }
  pluginOptions: {
    "content-manager": {
      visible: false
    }
    "content-type-builder": {
      visible: false
    }
  }
  attributes: {
    active: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>
    actorKey: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Private
    appeal: Schema.Attribute.Text & Schema.Attribute.Private
    contributorFeedback: Schema.Attribute.Text & Schema.Attribute.Private
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    expiresAt: Schema.Attribute.DateTime
    language: Schema.Attribute.String & Schema.Attribute.Required
    lastAppealedAt: Schema.Attribute.DateTime
    liftedBy: Schema.Attribute.String & Schema.Attribute.Private
    liftReason: Schema.Attribute.Text & Schema.Attribute.Private
    locale: Schema.Attribute.String & Schema.Attribute.Private
    localizations: Schema.Attribute.Relation<
      "oneToMany",
      "plugin::discussions.sanction"
    > &
      Schema.Attribute.Private
    mode: Schema.Attribute.Enumeration<["mute", "ban"]> &
      Schema.Attribute.Required
    moderatorKey: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Private
    publishedAt: Schema.Attribute.DateTime
    reason: Schema.Attribute.Text &
      Schema.Attribute.Required &
      Schema.Attribute.Private
    recordId: Schema.Attribute.String & Schema.Attribute.Required
    recordType: Schema.Attribute.Enumeration<["thread", "reply"]> &
      Schema.Attribute.Required
    subjectId: Schema.Attribute.String & Schema.Attribute.Private
    threadId: Schema.Attribute.String & Schema.Attribute.Required
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    version: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<1>
  }
}

export interface PluginDiscussionsSubject extends Struct.CollectionTypeSchema {
  collectionName: "discussions_subjects"
  info: {
    displayName: "Discussion subject"
    pluralName: "subjects"
    singularName: "subject"
  }
  options: {
    draftAndPublish: false
  }
  pluginOptions: {
    "content-manager": {
      visible: false
    }
    "content-type-builder": {
      visible: false
    }
  }
  attributes: {
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    createPolicy: Schema.Attribute.Enumeration<["members", "moderators"]> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<"members">
    description: Schema.Attribute.Text
    languages: Schema.Attribute.JSON
    locale: Schema.Attribute.String & Schema.Attribute.Private
    localizations: Schema.Attribute.Relation<
      "oneToMany",
      "plugin::discussions.subject"
    > &
      Schema.Attribute.Private
    name: Schema.Attribute.String & Schema.Attribute.Required
    publishedAt: Schema.Attribute.DateTime
    slug: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    version: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<0>
    visibility: Schema.Attribute.Enumeration<["public", "members", "private"]> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<"public">
  }
}

export interface PluginDiscussionsSubscription
  extends Struct.CollectionTypeSchema {
  collectionName: "discussions_subscriptions"
  info: {
    displayName: "Discussion subscription"
    pluralName: "subscriptions"
    singularName: "subscription"
  }
  options: {
    draftAndPublish: false
  }
  pluginOptions: {
    "content-manager": {
      visible: false
    }
    "content-type-builder": {
      visible: false
    }
  }
  attributes: {
    actorKey: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Private
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    dedupeKey: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Private &
      Schema.Attribute.Unique
    locale: Schema.Attribute.String & Schema.Attribute.Private
    localizations: Schema.Attribute.Relation<
      "oneToMany",
      "plugin::discussions.subscription"
    > &
      Schema.Attribute.Private
    publishedAt: Schema.Attribute.DateTime
    threadId: Schema.Attribute.String & Schema.Attribute.Required
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
  }
}

export interface PluginDiscussionsThread extends Struct.CollectionTypeSchema {
  collectionName: "discussions_threads"
  info: {
    displayName: "Discussion thread"
    pluralName: "threads"
    singularName: "thread"
  }
  options: {
    draftAndPublish: false
  }
  pluginOptions: {
    "content-manager": {
      visible: false
    }
    "content-type-builder": {
      visible: false
    }
  }
  attributes: {
    activityAt: Schema.Attribute.DateTime
    attachments: Schema.Attribute.JSON & Schema.Attribute.Private
    authorKey: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Private
    authorName: Schema.Attribute.String & Schema.Attribute.Required
    authorProfile: Schema.Attribute.JSON
    body: Schema.Attribute.Text & Schema.Attribute.DefaultTo<"">
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    language: Schema.Attribute.String & Schema.Attribute.Required
    locale: Schema.Attribute.String & Schema.Attribute.Private
    localizations: Schema.Attribute.Relation<
      "oneToMany",
      "plugin::discussions.thread"
    > &
      Schema.Attribute.Private
    locked: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>
    moderationFeedback: Schema.Attribute.Text & Schema.Attribute.Private
    pinned: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>
    profanityException: Schema.Attribute.Boolean &
      Schema.Attribute.DefaultTo<false>
    publishedAt: Schema.Attribute.DateTime
    quote: Schema.Attribute.JSON & Schema.Attribute.Private
    state: Schema.Attribute.Enumeration<
      ["pending", "visible", "rejected", "removed"]
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<"pending">
    subjectId: Schema.Attribute.String & Schema.Attribute.Required
    target: Schema.Attribute.JSON & Schema.Attribute.Private
    targetKey: Schema.Attribute.String &
      Schema.Attribute.Private &
      Schema.Attribute.Unique
    title: Schema.Attribute.String & Schema.Attribute.Required
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    version: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<0>
  }
}

export interface PluginEventsCredentialEvent
  extends Struct.CollectionTypeSchema {
  collectionName: "ev_credential_events"
  info: {
    description: "Append-only log of Event Feed actions. Never holds a value."
    displayName: "Credential Event"
    pluralName: "credential-events"
    singularName: "credential-event"
  }
  options: {
    draftAndPublish: false
  }
  pluginOptions: {
    "content-manager": {
      visible: false
    }
    "content-type-builder": {
      visible: false
    }
  }
  attributes: {
    action: Schema.Attribute.Enumeration<
      [
        "connect_submitted",
        "replace_submitted",
        "approved",
        "rejected",
        "withdrawn",
        "tested",
        "paused",
        "resumed",
        "auto_paused",
        "disconnected",
        "revealed",
        "admin_created",
        "admin_updated",
        "admin_deleted",
      ]
    > &
      Schema.Attribute.Required
    actor: Schema.Attribute.String & Schema.Attribute.Required
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    credentialDocumentId: Schema.Attribute.String & Schema.Attribute.Required
    libraryDocumentIds: Schema.Attribute.JSON
    locale: Schema.Attribute.String & Schema.Attribute.Private
    localizations: Schema.Attribute.Relation<
      "oneToMany",
      "plugin::events.credential-event"
    > &
      Schema.Attribute.Private
    note: Schema.Attribute.String
    provider: Schema.Attribute.String
    publishedAt: Schema.Attribute.DateTime
    resultCode: Schema.Attribute.String
    submissionDocumentId: Schema.Attribute.String
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
  }
}

export interface PluginEventsEvent extends Struct.CollectionTypeSchema {
  collectionName: "ev_events"
  info: {
    displayName: "Event"
    pluralName: "events"
    singularName: "event"
  }
  options: {
    draftAndPublish: false
  }
  pluginOptions: {
    "content-manager": {
      visible: true
    }
    "content-type-builder": {
      visible: false
    }
  }
  attributes: {
    allDay: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>
    audience: Schema.Attribute.JSON
    capacity: Schema.Attribute.Integer
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    credentialId: Schema.Attribute.Integer & Schema.Attribute.Required
    description: Schema.Attribute.Text
    endTime: Schema.Attribute.DateTime
    eventType: Schema.Attribute.Enumeration<
      [
        "talk",
        "exhibition",
        "storytime",
        "book_club",
        "workshop",
        "tour",
        "screening",
        "reading_group",
        "performance",
        "drop_in",
        "other",
      ]
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<"other">
    externalId: Schema.Attribute.String & Schema.Attribute.Required
    imageUrl: Schema.Attribute.Text
    importedAt: Schema.Attribute.DateTime & Schema.Attribute.Required
    isFree: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>
    lastSeenAt: Schema.Attribute.DateTime & Schema.Attribute.Required
    library: Schema.Attribute.Relation<"manyToOne", "api::library.library">
    libraryEntityRef: Schema.Attribute.String
    locale: Schema.Attribute.String & Schema.Attribute.Private
    localizations: Schema.Attribute.Relation<
      "oneToMany",
      "plugin::events.event"
    > &
      Schema.Attribute.Private
    pendingReview: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>
    priceMax: Schema.Attribute.Decimal
    priceMin: Schema.Attribute.Decimal
    publishedAt: Schema.Attribute.DateTime
    sourceProvider: Schema.Attribute.Enumeration<
      [
        "eventbrite",
        "ical",
        "custom_ical",
        "aspen",
        "solus",
        "spydus",
        "ticketsource",
        "wegottickets",
      ]
    > &
      Schema.Attribute.Required
    startTime: Schema.Attribute.DateTime & Schema.Attribute.Required
    status: Schema.Attribute.Enumeration<
      ["upcoming", "ongoing", "cancelled", "postponed"]
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<"upcoming">
    summary: Schema.Attribute.Text
    syncHash: Schema.Attribute.String & Schema.Attribute.Required
    tags: Schema.Attribute.JSON
    timezone: Schema.Attribute.String & Schema.Attribute.Required
    title: Schema.Attribute.String & Schema.Attribute.Required
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    url: Schema.Attribute.Text & Schema.Attribute.Required
  }
}

export interface PluginEventsEventCredential
  extends Struct.CollectionTypeSchema {
  collectionName: "ev_event_credentials"
  info: {
    displayName: "Event Credential"
    pluralName: "event-credentials"
    singularName: "event-credential"
  }
  options: {
    draftAndPublish: false
  }
  pluginOptions: {
    "content-manager": {
      visible: false
    }
    "content-type-builder": {
      visible: false
    }
  }
  attributes: {
    autoPauseNotifiedAt: Schema.Attribute.DateTime
    connectedBy: Schema.Attribute.String & Schema.Attribute.Private
    consecutiveFailures: Schema.Attribute.Integer &
      Schema.Attribute.DefaultTo<0>
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    credentialsEncrypted: Schema.Attribute.Text &
      Schema.Attribute.Required &
      Schema.Attribute.Private
    hints: Schema.Attribute.JSON
    label: Schema.Attribute.String & Schema.Attribute.Required
    lastErrorCode: Schema.Attribute.Enumeration<
      [
        "ok",
        "auth_failed",
        "not_found",
        "unreachable",
        "rate_limited",
        "unrecognised_format",
        "provider_error",
        "decrypt_failed",
      ]
    >
    lastErrorMessage: Schema.Attribute.Text
    lastSyncAt: Schema.Attribute.DateTime
    lastSyncStatus: Schema.Attribute.Enumeration<["ok", "partial", "error"]>
    lastTestedAt: Schema.Attribute.DateTime
    lastTestResult: Schema.Attribute.Enumeration<
      [
        "ok",
        "auth_failed",
        "not_found",
        "unreachable",
        "rate_limited",
        "unrecognised_format",
        "provider_error",
        "decrypt_failed",
      ]
    >
    lastVerifiedAt: Schema.Attribute.DateTime
    libraries: Schema.Attribute.Relation<"manyToMany", "api::library.library">
    locale: Schema.Attribute.String & Schema.Attribute.Private
    localizations: Schema.Attribute.Relation<
      "oneToMany",
      "plugin::events.event-credential"
    > &
      Schema.Attribute.Private
    pausedReason: Schema.Attribute.Enumeration<
      ["library", "admin", "sync_failures"]
    >
    pendingCredentialsEncrypted: Schema.Attribute.Text &
      Schema.Attribute.Private
    pendingHints: Schema.Attribute.JSON
    pendingSubmissionDocumentId: Schema.Attribute.String
    pendingTestedAt: Schema.Attribute.DateTime
    pendingTestResult: Schema.Attribute.Enumeration<
      [
        "ok",
        "auth_failed",
        "not_found",
        "unreachable",
        "rate_limited",
        "unrecognised_format",
        "provider_error",
        "decrypt_failed",
      ]
    >
    provider: Schema.Attribute.Enumeration<
      [
        "eventbrite",
        "ical",
        "ticketsource",
        "wegottickets",
        "spydus",
        "solus",
        "aspen",
      ]
    > &
      Schema.Attribute.Required
    publishedAt: Schema.Attribute.DateTime
    scope: Schema.Attribute.Enumeration<["library", "group"]> &
      Schema.Attribute.Required
    source: Schema.Attribute.Enumeration<["admin", "library"]> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<"admin">
    status: Schema.Attribute.Enumeration<
      ["draft", "pending", "active", "paused"]
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<"pending">
    submissionDocumentId: Schema.Attribute.String
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
  }
}

export interface PluginEventsImportRun extends Struct.CollectionTypeSchema {
  collectionName: "ev_import_runs"
  info: {
    displayName: "Import Run"
    pluralName: "import-runs"
    singularName: "import-run"
  }
  options: {
    draftAndPublish: false
  }
  pluginOptions: {
    "content-manager": {
      visible: false
    }
    "content-type-builder": {
      visible: false
    }
  }
  attributes: {
    completedAt: Schema.Attribute.DateTime
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    credentialsAttempted: Schema.Attribute.Integer &
      Schema.Attribute.DefaultTo<0>
    credentialsFailed: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>
    credentialsTotal: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>
    durationMs: Schema.Attribute.Integer
    errorCount: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>
    eventsCreated: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>
    eventsExpiredPurged: Schema.Attribute.Integer &
      Schema.Attribute.DefaultTo<0>
    eventsFetched: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>
    eventsPendingReview: Schema.Attribute.Integer &
      Schema.Attribute.DefaultTo<0>
    eventsUnchanged: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>
    eventsUpdated: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>
    failedCredentials: Schema.Attribute.JSON
    locale: Schema.Attribute.String & Schema.Attribute.Private
    localizations: Schema.Attribute.Relation<
      "oneToMany",
      "plugin::events.import-run"
    > &
      Schema.Attribute.Private
    notes: Schema.Attribute.Text
    providerBreakdown: Schema.Attribute.JSON
    publishedAt: Schema.Attribute.DateTime
    runId: Schema.Attribute.String & Schema.Attribute.Required
    startedAt: Schema.Attribute.DateTime & Schema.Attribute.Required
    status: Schema.Attribute.Enumeration<
      ["running", "success", "partial", "failed"]
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<"running">
    triggeredBy: Schema.Attribute.Enumeration<["cron", "manual"]> &
      Schema.Attribute.Required
    triggeredByUserId: Schema.Attribute.String
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
  }
}

export interface PluginEventsSyncCommand extends Struct.CollectionTypeSchema {
  collectionName: "ev_sync_commands"
  info: {
    displayName: "Sync Command"
    pluralName: "sync-commands"
    singularName: "sync-command"
  }
  options: {
    draftAndPublish: false
  }
  pluginOptions: {
    "content-manager": {
      visible: false
    }
    "content-type-builder": {
      visible: false
    }
  }
  attributes: {
    consumedAt: Schema.Attribute.DateTime
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    credentialDocumentId: Schema.Attribute.String
    locale: Schema.Attribute.String & Schema.Attribute.Private
    localizations: Schema.Attribute.Relation<
      "oneToMany",
      "plugin::events.sync-command"
    > &
      Schema.Attribute.Private
    publishedAt: Schema.Attribute.DateTime
    requestedAt: Schema.Attribute.DateTime & Schema.Attribute.Required
    requestedByUserId: Schema.Attribute.String
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
  }
}

export interface PluginI18NLocale extends Struct.CollectionTypeSchema {
  collectionName: "i18n_locale"
  info: {
    collectionName: "locales"
    description: ""
    displayName: "Locale"
    pluralName: "locales"
    singularName: "locale"
  }
  options: {
    draftAndPublish: false
  }
  pluginOptions: {
    "content-manager": {
      visible: false
    }
    "content-type-builder": {
      visible: false
    }
  }
  attributes: {
    code: Schema.Attribute.String & Schema.Attribute.Unique
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    locale: Schema.Attribute.String & Schema.Attribute.Private
    localizations: Schema.Attribute.Relation<
      "oneToMany",
      "plugin::i18n.locale"
    > &
      Schema.Attribute.Private
    name: Schema.Attribute.String &
      Schema.Attribute.SetMinMax<
        {
          max: 50
          min: 1
        },
        number
      >
    publishedAt: Schema.Attribute.DateTime
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
  }
}

export interface PluginLibraryStaffStaffAudit
  extends Struct.CollectionTypeSchema {
  collectionName: "staff_audits"
  info: {
    displayName: "Staff Audit"
    pluralName: "staff-audits"
    singularName: "staff-audit"
  }
  options: {
    draftAndPublish: false
  }
  pluginOptions: {
    "content-manager": {
      visible: false
    }
    "content-type-builder": {
      visible: false
    }
  }
  attributes: {
    action: Schema.Attribute.Enumeration<
      [
        "invite_sent",
        "invite_revoked",
        "joined",
        "level_changed",
        "removed",
        "left",
        "can_go_live_changed",
        "live_settings_changed",
        "access_reported",
        "stepup_locked",
        "notice_created",
        "notice_updated",
        "notice_ended",
      ]
    > &
      Schema.Attribute.Required
    actor: Schema.Attribute.String & Schema.Attribute.Private
    at: Schema.Attribute.DateTime & Schema.Attribute.Required
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    detail: Schema.Attribute.JSON & Schema.Attribute.Private
    library: Schema.Attribute.Relation<"manyToOne", "api::library.library">
    locale: Schema.Attribute.String & Schema.Attribute.Private
    localizations: Schema.Attribute.Relation<
      "oneToMany",
      "plugin::library-staff.staff-audit"
    > &
      Schema.Attribute.Private
    publishedAt: Schema.Attribute.DateTime
    subject: Schema.Attribute.String & Schema.Attribute.Private
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
  }
}

export interface PluginMobileLibrariesLiveEvent
  extends Struct.CollectionTypeSchema {
  collectionName: "mobile_live_events"
  info: {
    displayName: "Live Event"
    pluralName: "live-events"
    singularName: "live-event"
  }
  options: {
    draftAndPublish: false
  }
  pluginOptions: {
    "content-manager": {
      visible: false
    }
    "content-type-builder": {
      visible: false
    }
  }
  attributes: {
    at: Schema.Attribute.DateTime
    clientAt: Schema.Attribute.DateTime
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    delayMin: Schema.Attribute.Integer
    eventKey: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Private &
      Schema.Attribute.Unique
    flagged: Schema.Attribute.String
    locale: Schema.Attribute.String & Schema.Attribute.Private
    localizations: Schema.Attribute.Relation<
      "oneToMany",
      "plugin::mobile-libraries.live-event"
    > &
      Schema.Attribute.Private
    publishedAt: Schema.Attribute.DateTime
    reason: Schema.Attribute.String
    session: Schema.Attribute.Relation<
      "manyToOne",
      "plugin::mobile-libraries.live-session"
    >
    sessionDocumentId: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Private
    stopId: Schema.Attribute.String
    type: Schema.Attribute.Enumeration<
      ["start", "arrived", "left", "delay", "skip", "not_running", "end"]
    >
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
  }
}

export interface PluginMobileLibrariesLiveSession
  extends Struct.CollectionTypeSchema {
  collectionName: "mobile_live_sessions"
  info: {
    displayName: "Live Session"
    pluralName: "live-sessions"
    singularName: "live-session"
  }
  options: {
    draftAndPublish: false
  }
  pluginOptions: {
    "content-manager": {
      visible: false
    }
    "content-type-builder": {
      visible: false
    }
  }
  attributes: {
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    cycleWeek: Schema.Attribute.Integer
    day: Schema.Attribute.String
    endedAt: Schema.Attribute.DateTime
    endReason: Schema.Attribute.Enumeration<
      [
        "manual",
        "auto",
        "breakdown",
        "takeover",
        "revoked",
        "expired",
        "kill_switch",
      ]
    >
    endsAt: Schema.Attribute.DateTime
    library: Schema.Attribute.Relation<"manyToOne", "api::library.library">
    libraryDocumentId: Schema.Attribute.String & Schema.Attribute.Required
    locale: Schema.Attribute.String & Schema.Attribute.Private
    localizations: Schema.Attribute.Relation<
      "oneToMany",
      "plugin::mobile-libraries.live-session"
    > &
      Schema.Attribute.Private
    mode: Schema.Attribute.Enumeration<["checkins", "approximate"]>
    position: Schema.Attribute.JSON & Schema.Attribute.Private
    publishedAt: Schema.Attribute.DateTime
    route: Schema.Attribute.JSON & Schema.Attribute.Private
    serviceDate: Schema.Attribute.Date
    startedAt: Schema.Attribute.DateTime
    startedBy: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Private
    state: Schema.Attribute.JSON & Schema.Attribute.Private
    status: Schema.Attribute.Enumeration<["active", "ended"]> &
      Schema.Attribute.DefaultTo<"active">
    tokenHash: Schema.Attribute.String & Schema.Attribute.Private
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
  }
}

export interface PluginMobileLibrariesLiveSetting
  extends Struct.CollectionTypeSchema {
  collectionName: "mobile_live_settings"
  info: {
    displayName: "Live Setting"
    pluralName: "live-settings"
    singularName: "live-setting"
  }
  options: {
    draftAndPublish: false
  }
  pluginOptions: {
    "content-manager": {
      visible: false
    }
    "content-type-builder": {
      visible: false
    }
  }
  attributes: {
    autoStopMinutes: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<30>
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    enabled: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>
    enabledAt: Schema.Attribute.DateTime
    enabledBy: Schema.Attribute.String & Schema.Attribute.Private
    library: Schema.Attribute.Relation<"manyToOne", "api::library.library">
    libraryDocumentId: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique
    locale: Schema.Attribute.String & Schema.Attribute.Private
    localizations: Schema.Attribute.Relation<
      "oneToMany",
      "plugin::mobile-libraries.live-setting"
    > &
      Schema.Attribute.Private
    precision: Schema.Attribute.Enumeration<["stops", "approximate"]> &
      Schema.Attribute.DefaultTo<"stops">
    publishedAt: Schema.Attribute.DateTime
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
  }
}

export interface PluginReviewWorkflowsWorkflow
  extends Struct.CollectionTypeSchema {
  collectionName: "strapi_workflows"
  info: {
    description: ""
    displayName: "Workflow"
    name: "Workflow"
    pluralName: "workflows"
    singularName: "workflow"
  }
  options: {
    draftAndPublish: false
  }
  pluginOptions: {
    "content-manager": {
      visible: false
    }
    "content-type-builder": {
      visible: false
    }
  }
  attributes: {
    contentTypes: Schema.Attribute.JSON &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<"[]">
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    locale: Schema.Attribute.String & Schema.Attribute.Private
    localizations: Schema.Attribute.Relation<
      "oneToMany",
      "plugin::review-workflows.workflow"
    > &
      Schema.Attribute.Private
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique
    publishedAt: Schema.Attribute.DateTime
    stageRequiredToPublish: Schema.Attribute.Relation<
      "oneToOne",
      "plugin::review-workflows.workflow-stage"
    >
    stages: Schema.Attribute.Relation<
      "oneToMany",
      "plugin::review-workflows.workflow-stage"
    >
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
  }
}

export interface PluginReviewWorkflowsWorkflowStage
  extends Struct.CollectionTypeSchema {
  collectionName: "strapi_workflows_stages"
  info: {
    description: ""
    displayName: "Stages"
    name: "Workflow Stage"
    pluralName: "workflow-stages"
    singularName: "workflow-stage"
  }
  options: {
    draftAndPublish: false
    version: "1.1.0"
  }
  pluginOptions: {
    "content-manager": {
      visible: false
    }
    "content-type-builder": {
      visible: false
    }
  }
  attributes: {
    color: Schema.Attribute.String & Schema.Attribute.DefaultTo<"#4945FF">
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    locale: Schema.Attribute.String & Schema.Attribute.Private
    localizations: Schema.Attribute.Relation<
      "oneToMany",
      "plugin::review-workflows.workflow-stage"
    > &
      Schema.Attribute.Private
    name: Schema.Attribute.String
    permissions: Schema.Attribute.Relation<"manyToMany", "admin::permission">
    publishedAt: Schema.Attribute.DateTime
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    workflow: Schema.Attribute.Relation<
      "manyToOne",
      "plugin::review-workflows.workflow"
    >
  }
}

export interface PluginRewardsBadgeAward extends Struct.CollectionTypeSchema {
  collectionName: "rw_badge_awards"
  info: {
    displayName: "Badge Award"
    pluralName: "badge-awards"
    singularName: "badge-award"
  }
  options: {
    draftAndPublish: false
  }
  pluginOptions: {
    "content-manager": {
      visible: false
    }
    "content-type-builder": {
      visible: false
    }
  }
  attributes: {
    awardedAt: Schema.Attribute.DateTime & Schema.Attribute.Required
    badgeId: Schema.Attribute.String & Schema.Attribute.Required
    baUserId: Schema.Attribute.String & Schema.Attribute.Required
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    locale: Schema.Attribute.String & Schema.Attribute.Private
    localizations: Schema.Attribute.Relation<
      "oneToMany",
      "plugin::rewards.badge-award"
    > &
      Schema.Attribute.Private
    publishedAt: Schema.Attribute.DateTime
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
  }
}

export interface PluginRewardsLeaderboardSnapshot
  extends Struct.CollectionTypeSchema {
  collectionName: "rw_leaderboard_snapshots"
  info: {
    displayName: "Leaderboard Snapshot"
    pluralName: "leaderboard-snapshots"
    singularName: "leaderboard-snapshot"
  }
  options: {
    draftAndPublish: false
  }
  pluginOptions: {
    "content-manager": {
      visible: false
    }
    "content-type-builder": {
      visible: false
    }
  }
  attributes: {
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    entries: Schema.Attribute.JSON & Schema.Attribute.Required
    locale: Schema.Attribute.String & Schema.Attribute.Private
    localizations: Schema.Attribute.Relation<
      "oneToMany",
      "plugin::rewards.leaderboard-snapshot"
    > &
      Schema.Attribute.Private
    period: Schema.Attribute.String & Schema.Attribute.Required
    periodType: Schema.Attribute.Enumeration<["weekly", "daily"]> &
      Schema.Attribute.Required
    publishedAt: Schema.Attribute.DateTime
    takenAt: Schema.Attribute.DateTime & Schema.Attribute.Required
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
  }
}

export interface PluginRewardsPointEvent extends Struct.CollectionTypeSchema {
  collectionName: "rw_point_events"
  info: {
    displayName: "Point Event"
    pluralName: "point-events"
    singularName: "point-event"
  }
  options: {
    draftAndPublish: false
  }
  pluginOptions: {
    "content-manager": {
      visible: false
    }
    "content-type-builder": {
      visible: false
    }
  }
  attributes: {
    action: Schema.Attribute.Enumeration<
      [
        "new_library_approved",
        "edit_accepted_minor",
        "edit_accepted_major",
        "correction_approved",
        "claim_approved",
        "photo_licensed_cc",
        "hours_verified",
        "status_verified",
        "wiki_translated",
        "journal_accepted",
        "journal_edit_accepted",
        "journal_translated",
        "knowledge_article_published",
        "knowledge_edit_accepted",
        "source_added",
        "daily_streak",
        "manual_award",
        "manual_deduct",
        "drive_task_accepted",
        "drive_finished",
        "drive_proposal_accepted",
      ]
    > &
      Schema.Attribute.Required
    awardedAt: Schema.Attribute.DateTime & Schema.Attribute.Required
    baUserId: Schema.Attribute.String & Schema.Attribute.Required
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    idempotencyKey: Schema.Attribute.String &
      Schema.Attribute.Private &
      Schema.Attribute.Unique
    locale: Schema.Attribute.String & Schema.Attribute.Private
    localizations: Schema.Attribute.Relation<
      "oneToMany",
      "plugin::rewards.point-event"
    > &
      Schema.Attribute.Private
    metadata: Schema.Attribute.JSON
    points: Schema.Attribute.Integer & Schema.Attribute.Required
    publishedAt: Schema.Attribute.DateTime
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
  }
}

export interface PluginUploadFile extends Struct.CollectionTypeSchema {
  collectionName: "files"
  info: {
    description: ""
    displayName: "File"
    pluralName: "files"
    singularName: "file"
  }
  options: {
    draftAndPublish: false
  }
  pluginOptions: {
    "content-manager": {
      visible: false
    }
    "content-type-builder": {
      visible: false
    }
  }
  attributes: {
    alternativeText: Schema.Attribute.Text
    caption: Schema.Attribute.Text
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    ext: Schema.Attribute.String
    focalPoint: Schema.Attribute.JSON
    folder: Schema.Attribute.Relation<"manyToOne", "plugin::upload.folder"> &
      Schema.Attribute.Private
    folderPath: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Private &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1
      }>
    formats: Schema.Attribute.JSON
    hash: Schema.Attribute.String & Schema.Attribute.Required
    height: Schema.Attribute.Integer
    locale: Schema.Attribute.String & Schema.Attribute.Private
    localizations: Schema.Attribute.Relation<
      "oneToMany",
      "plugin::upload.file"
    > &
      Schema.Attribute.Private
    mime: Schema.Attribute.String & Schema.Attribute.Required
    name: Schema.Attribute.String & Schema.Attribute.Required
    previewUrl: Schema.Attribute.Text
    provider: Schema.Attribute.String & Schema.Attribute.Required
    provider_metadata: Schema.Attribute.JSON
    publishedAt: Schema.Attribute.DateTime
    related: Schema.Attribute.Relation<"morphToMany">
    size: Schema.Attribute.Decimal & Schema.Attribute.Required
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    url: Schema.Attribute.Text & Schema.Attribute.Required
    width: Schema.Attribute.Integer
  }
}

export interface PluginUploadFolder extends Struct.CollectionTypeSchema {
  collectionName: "upload_folders"
  info: {
    displayName: "Folder"
    pluralName: "folders"
    singularName: "folder"
  }
  options: {
    draftAndPublish: false
  }
  pluginOptions: {
    "content-manager": {
      visible: false
    }
    "content-type-builder": {
      visible: false
    }
  }
  attributes: {
    children: Schema.Attribute.Relation<"oneToMany", "plugin::upload.folder">
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    files: Schema.Attribute.Relation<"oneToMany", "plugin::upload.file">
    locale: Schema.Attribute.String & Schema.Attribute.Private
    localizations: Schema.Attribute.Relation<
      "oneToMany",
      "plugin::upload.folder"
    > &
      Schema.Attribute.Private
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1
      }>
    parent: Schema.Attribute.Relation<"manyToOne", "plugin::upload.folder">
    path: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1
      }>
    pathId: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.Unique
    publishedAt: Schema.Attribute.DateTime
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
  }
}

export interface PluginUsersPermissionsPermission
  extends Struct.CollectionTypeSchema {
  collectionName: "up_permissions"
  info: {
    description: ""
    displayName: "Permission"
    name: "permission"
    pluralName: "permissions"
    singularName: "permission"
  }
  options: {
    draftAndPublish: false
  }
  pluginOptions: {
    "content-manager": {
      visible: false
    }
    "content-type-builder": {
      visible: false
    }
  }
  attributes: {
    action: Schema.Attribute.String & Schema.Attribute.Required
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    locale: Schema.Attribute.String & Schema.Attribute.Private
    localizations: Schema.Attribute.Relation<
      "oneToMany",
      "plugin::users-permissions.permission"
    > &
      Schema.Attribute.Private
    publishedAt: Schema.Attribute.DateTime
    role: Schema.Attribute.Relation<
      "manyToOne",
      "plugin::users-permissions.role"
    >
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
  }
}

export interface PluginUsersPermissionsRole
  extends Struct.CollectionTypeSchema {
  collectionName: "up_roles"
  info: {
    description: ""
    displayName: "Role"
    name: "role"
    pluralName: "roles"
    singularName: "role"
  }
  options: {
    draftAndPublish: false
  }
  pluginOptions: {
    "content-manager": {
      visible: false
    }
    "content-type-builder": {
      visible: false
    }
  }
  attributes: {
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    description: Schema.Attribute.String
    locale: Schema.Attribute.String & Schema.Attribute.Private
    localizations: Schema.Attribute.Relation<
      "oneToMany",
      "plugin::users-permissions.role"
    > &
      Schema.Attribute.Private
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 3
      }>
    permissions: Schema.Attribute.Relation<
      "oneToMany",
      "plugin::users-permissions.permission"
    >
    publishedAt: Schema.Attribute.DateTime
    type: Schema.Attribute.String & Schema.Attribute.Unique
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    users: Schema.Attribute.Relation<
      "oneToMany",
      "plugin::users-permissions.user"
    >
  }
}

export interface PluginUsersPermissionsUser
  extends Struct.CollectionTypeSchema {
  collectionName: "up_users"
  info: {
    description: ""
    displayName: "User"
    name: "user"
    pluralName: "users"
    singularName: "user"
  }
  options: {
    draftAndPublish: false
    timestamps: true
  }
  attributes: {
    blocked: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>
    confirmationToken: Schema.Attribute.String & Schema.Attribute.Private
    confirmed: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    email: Schema.Attribute.Email &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 6
      }>
    locale: Schema.Attribute.String & Schema.Attribute.Private
    localizations: Schema.Attribute.Relation<
      "oneToMany",
      "plugin::users-permissions.user"
    > &
      Schema.Attribute.Private
    password: Schema.Attribute.Password &
      Schema.Attribute.Private &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 6
      }>
    provider: Schema.Attribute.String
    publishedAt: Schema.Attribute.DateTime
    resetPasswordToken: Schema.Attribute.String & Schema.Attribute.Private
    role: Schema.Attribute.Relation<
      "manyToOne",
      "plugin::users-permissions.role"
    >
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    username: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 3
      }>
  }
}

declare module "@strapi/strapi" {
  export namespace Public {
    export interface ContentTypeSchemas {
      "admin::api-token": AdminApiToken
      "admin::api-token-permission": AdminApiTokenPermission
      "admin::permission": AdminPermission
      "admin::role": AdminRole
      "admin::session": AdminSession
      "admin::transfer-token": AdminTransferToken
      "admin::transfer-token-permission": AdminTransferTokenPermission
      "admin::user": AdminUser
      "api::accessibility.accessibility": ApiAccessibilityAccessibility
      "api::amenity.amenity": ApiAmenityAmenity
      "api::announcement.announcement": ApiAnnouncementAnnouncement
      "api::area.area": ApiAreaArea
      "api::article-change.article-change": ApiArticleChangeArticleChange
      "api::article-projection-job.article-projection-job": ApiArticleProjectionJobArticleProjectionJob
      "api::blog-article.blog-article": ApiBlogArticleBlogArticle
      "api::blog-landing.blog-landing": ApiBlogLandingBlogLanding
      "api::blog-section.blog-section": ApiBlogSectionBlogSection
      "api::category.category": ApiCategoryCategory
      "api::continent.continent": ApiContinentContinent
      "api::country.country": ApiCountryCountry
      "api::dataset.dataset": ApiDatasetDataset
      "api::drive-credit.drive-credit": ApiDriveCreditDriveCredit
      "api::drive-hold.drive-hold": ApiDriveHoldDriveHold
      "api::drive.drive": ApiDriveDrive
      "api::entitlement-grant.entitlement-grant": ApiEntitlementGrantEntitlementGrant
      "api::footer.footer": ApiFooterFooter
      "api::homepage.homepage": ApiHomepageHomepage
      "api::internal-notification.internal-notification": ApiInternalNotificationInternalNotification
      "api::legal-document.legal-document": ApiLegalDocumentLegalDocument
      "api::library-affiliation.library-affiliation": ApiLibraryAffiliationLibraryAffiliation
      "api::library-change.library-change": ApiLibraryChangeLibraryChange
      "api::library-notice.library-notice": ApiLibraryNoticeLibraryNotice
      "api::library-type.library-type": ApiLibraryTypeLibraryType
      "api::library.library": ApiLibraryLibrary
      "api::notification.notification": ApiNotificationNotification
      "api::page.page": ApiPagePage
      "api::paid-membership.paid-membership": ApiPaidMembershipPaidMembership
      "api::pro-verification.pro-verification": ApiProVerificationProVerification
      "api::redirect.redirect": ApiRedirectRedirect
      "api::region.region": ApiRegionRegion
      "api::role-grant.role-grant": ApiRoleGrantRoleGrant
      "api::saved-event.saved-event": ApiSavedEventSavedEvent
      "api::service.service": ApiServiceService
      "api::site-config.site-config": ApiSiteConfigSiteConfig
      "api::subscriber.subscriber": ApiSubscriberSubscriber
      "api::topic.topic": ApiTopicTopic
      "api::user-profile.user-profile": ApiUserProfileUserProfile
      "api::wiki-article.wiki-article": ApiWikiArticleWikiArticle
      "api::wiki-landing.wiki-landing": ApiWikiLandingWikiLanding
      "api::wiki-section.wiki-section": ApiWikiSectionWikiSection
      "plugin::access.team": PluginAccessTeam
      "plugin::access.team-member": PluginAccessTeamMember
      "plugin::beta-invites.invitation": PluginBetaInvitesInvitation
      "plugin::content-moderation.option-suggestion": PluginContentModerationOptionSuggestion
      "plugin::content-moderation.option-vote": PluginContentModerationOptionVote
      "plugin::content-moderation.review-event": PluginContentModerationReviewEvent
      "plugin::content-moderation.submission": PluginContentModerationSubmission
      "plugin::content-moderation.submission-upload": PluginContentModerationSubmissionUpload
      "plugin::content-moderation.suggestion-round": PluginContentModerationSuggestionRound
      "plugin::content-moderation.upload-reservation": PluginContentModerationUploadReservation
      "plugin::content-releases.release": PluginContentReleasesRelease
      "plugin::content-releases.release-action": PluginContentReleasesReleaseAction
      "plugin::discussions.attachment": PluginDiscussionsAttachment
      "plugin::discussions.audit-event": PluginDiscussionsAuditEvent
      "plugin::discussions.context-link": PluginDiscussionsContextLink
      "plugin::discussions.context-setting": PluginDiscussionsContextSetting
      "plugin::discussions.erased-actor": PluginDiscussionsErasedActor
      "plugin::discussions.outbox": PluginDiscussionsOutbox
      "plugin::discussions.rate-window": PluginDiscussionsRateWindow
      "plugin::discussions.reaction": PluginDiscussionsReaction
      "plugin::discussions.reply": PluginDiscussionsReply
      "plugin::discussions.report": PluginDiscussionsReport
      "plugin::discussions.revision": PluginDiscussionsRevision
      "plugin::discussions.sanction": PluginDiscussionsSanction
      "plugin::discussions.subject": PluginDiscussionsSubject
      "plugin::discussions.subscription": PluginDiscussionsSubscription
      "plugin::discussions.thread": PluginDiscussionsThread
      "plugin::events.credential-event": PluginEventsCredentialEvent
      "plugin::events.event": PluginEventsEvent
      "plugin::events.event-credential": PluginEventsEventCredential
      "plugin::events.import-run": PluginEventsImportRun
      "plugin::events.sync-command": PluginEventsSyncCommand
      "plugin::i18n.locale": PluginI18NLocale
      "plugin::library-staff.staff-audit": PluginLibraryStaffStaffAudit
      "plugin::mobile-libraries.live-event": PluginMobileLibrariesLiveEvent
      "plugin::mobile-libraries.live-session": PluginMobileLibrariesLiveSession
      "plugin::mobile-libraries.live-setting": PluginMobileLibrariesLiveSetting
      "plugin::review-workflows.workflow": PluginReviewWorkflowsWorkflow
      "plugin::review-workflows.workflow-stage": PluginReviewWorkflowsWorkflowStage
      "plugin::rewards.badge-award": PluginRewardsBadgeAward
      "plugin::rewards.leaderboard-snapshot": PluginRewardsLeaderboardSnapshot
      "plugin::rewards.point-event": PluginRewardsPointEvent
      "plugin::upload.file": PluginUploadFile
      "plugin::upload.folder": PluginUploadFolder
      "plugin::users-permissions.permission": PluginUsersPermissionsPermission
      "plugin::users-permissions.role": PluginUsersPermissionsRole
      "plugin::users-permissions.user": PluginUsersPermissionsUser
    }
  }
}
