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
    boundaryUrl: Schema.Attribute.String &
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
    authorTitle: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
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
          localized: false
        }
      }>
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    featured: Schema.Attribute.Boolean &
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
    locale: Schema.Attribute.String
    localizations: Schema.Attribute.Relation<
      "oneToMany",
      "api::blog-article.blog-article"
    >
    publishedAt: Schema.Attribute.DateTime
    relatedArticles: Schema.Attribute.Relation<
      "manyToMany",
      "api::blog-article.blog-article"
    > &
      Schema.Attribute.Configurable &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    section: Schema.Attribute.Relation<
      "manyToOne",
      "api::blog-section.blog-section"
    > &
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
          localized: false
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
      localized: false
    }
  }
  attributes: {
    articles: Schema.Attribute.Relation<
      "oneToMany",
      "api::blog-article.blog-article"
    >
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    description: Schema.Attribute.Text
    locale: Schema.Attribute.String & Schema.Attribute.Private
    localizations: Schema.Attribute.Relation<
      "oneToMany",
      "api::blog-section.blog-section"
    > &
      Schema.Attribute.Private
    name: Schema.Attribute.String & Schema.Attribute.Required
    publishedAt: Schema.Attribute.DateTime
    slug: Schema.Attribute.UID<"name"> & Schema.Attribute.Required
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
  }
}

export interface ApiCatalogueBranchCatalogueBranch
  extends Struct.CollectionTypeSchema {
  collectionName: "catalogue_branches"
  info: {
    description: "A service point listed by a Catalogue, and the Library it corresponds to. Keyed to the Library by documentId so matching never touches Library drafts."
    displayName: "Catalogue Branch"
    pluralName: "catalogue-branches"
    singularName: "catalogue-branch"
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
    catalogue: Schema.Attribute.Relation<
      "manyToOne",
      "api::catalogue.catalogue"
    >
    code: Schema.Attribute.String
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    lastSeenAt: Schema.Attribute.DateTime
    libraryDocumentId: Schema.Attribute.String
    locale: Schema.Attribute.String & Schema.Attribute.Private
    localizations: Schema.Attribute.Relation<
      "oneToMany",
      "api::catalogue-branch.catalogue-branch"
    > &
      Schema.Attribute.Private
    matchScore: Schema.Attribute.Decimal
    matchStatus: Schema.Attribute.Enumeration<
      ["confirmed", "auto", "review", "unmatched", "rejected"]
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<"unmatched">
    name: Schema.Attribute.String & Schema.Attribute.Required
    publishedAt: Schema.Attribute.DateTime
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
  }
}

export interface ApiCatalogueCatalogue extends Struct.CollectionTypeSchema {
  collectionName: "catalogues"
  info: {
    description: "A library service's online catalogue (OPAC) and how to talk to it. Operational data maintained by the catalogue sync; not editorial content."
    displayName: "Catalogue"
    pluralName: "catalogues"
    singularName: "catalogue"
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
    availabilityStatus: Schema.Attribute.Enumeration<
      ["unverified", "active", "failing", "unsupported"]
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<"unverified">
    baseUrl: Schema.Attribute.String & Schema.Attribute.Required
    branches: Schema.Attribute.Relation<
      "oneToMany",
      "api::catalogue-branch.catalogue-branch"
    >
    branchStatus: Schema.Attribute.Enumeration<
      ["unverified", "active", "failing", "unsupported"]
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<"unverified">
    countryCode: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 2
      }>
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    gssCode: Schema.Attribute.String
    lastCheckedAt: Schema.Attribute.DateTime
    lastError: Schema.Attribute.Text
    locale: Schema.Attribute.String & Schema.Attribute.Private
    localizations: Schema.Attribute.Relation<
      "oneToMany",
      "api::catalogue.catalogue"
    > &
      Schema.Attribute.Private
    missingSettings: Schema.Attribute.JSON
    name: Schema.Attribute.String & Schema.Attribute.Required
    publishedAt: Schema.Attribute.DateTime
    settings: Schema.Attribute.JSON
    source: Schema.Attribute.Enumeration<
      ["librarieshacked", "detected", "manual"]
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<"manual">
    system: Schema.Attribute.Enumeration<
      [
        "arena",
        "aspen",
        "durham",
        "enterprise",
        "iguana",
        "koha",
        "luci",
        "prism",
        "spydus",
        "webpac",
      ]
    > &
      Schema.Attribute.Required
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    version: Schema.Attribute.String
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
          localized: false
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
    boundaryUrl: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
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
    description: ""
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
    boundaryUrl: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
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
    featuredPrompt: Schema.Attribute.Component<"homepage.cta-band", false> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
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
    finalBenefitsTitle: Schema.Attribute.String &
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
    finalProgression: Schema.Attribute.String &
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
    locale: Schema.Attribute.String
    localizations: Schema.Attribute.Relation<
      "oneToMany",
      "api::homepage.homepage"
    >
    openDataDefinition: Schema.Attribute.Component<"homepage.citation", false> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
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
    proofIntro: Schema.Attribute.Component<"homepage.section-intro", false> &
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
    stewardBand: Schema.Attribute.Component<"homepage.cta-band", false> &
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
    baUserId: Schema.Attribute.String & Schema.Attribute.Required
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
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    verificationMethod: Schema.Attribute.Enumeration<
      ["email_domain", "vouching", "contact_us"]
    > &
      Schema.Attribute.DefaultTo<"contact_us">
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
    hasActiveFeed: Schema.Attribute.Boolean &
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
    libraryType: Schema.Attribute.Enumeration<
      [
        "National",
        "Public",
        "Academic",
        "University",
        "Parliamentary",
        "State",
        "Municipal",
        "Special",
        "Monastic",
        "Archive",
        "Private",
        "Cultural",
        "Digital",
        "Mobile",
        "Other",
      ]
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
    source: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    sourceUrl: Schema.Attribute.String &
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
    boundaryUrl: Schema.Attribute.String &
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
    content: Schema.Attribute.Text &
      Schema.Attribute.CustomField<"plugin::tiptap-editor.RichText">
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    email: Schema.Attribute.Email
    locale: Schema.Attribute.String & Schema.Attribute.Private
    localizations: Schema.Attribute.Relation<
      "oneToMany",
      "api::subscriber.subscriber"
    > &
      Schema.Attribute.Private
    message: Schema.Attribute.Text
    name: Schema.Attribute.String
    publishedAt: Schema.Attribute.DateTime
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
  attributes: {
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    locale: Schema.Attribute.String & Schema.Attribute.Private
    localizations: Schema.Attribute.Relation<"oneToMany", "api::topic.topic"> &
      Schema.Attribute.Private
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique
    publishedAt: Schema.Attribute.DateTime
    slug: Schema.Attribute.UID<"name"> & Schema.Attribute.Required
    status: Schema.Attribute.Enumeration<["approved", "pending", "rejected"]> &
      Schema.Attribute.DefaultTo<"pending">
    suggestedByEmail: Schema.Attribute.String
    suggestedByUserId: Schema.Attribute.String
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
      Schema.Attribute.Unique
    bio: Schema.Attribute.Text
    city: Schema.Attribute.String
    contributorNumber: Schema.Attribute.Integer
    contributorRole: Schema.Attribute.Enumeration<
      [
        "reader",
        "contributor",
        "verified_librarian",
        "wiki_editor",
        "editorial_board",
      ]
    > &
      Schema.Attribute.DefaultTo<"reader">
    country: Schema.Attribute.String
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    firstName: Schema.Attribute.String
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
      Schema.Attribute.DefaultTo<{
        editorialMessages: true
        editsReviewed: true
        marketing: false
        newFollowers: false
        soundOn: false
        weeklyDigest: true
      }>
    orcid: Schema.Attribute.String
    points: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>
    pointsThisMonth: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>
    profileVisibility: Schema.Attribute.Enumeration<
      ["public", "limited", "private"]
    > &
      Schema.Attribute.DefaultTo<"public">
    pronouns: Schema.Attribute.Enumeration<
      ["he_him", "she_her", "they_them", "other", "prefer_not_to_say"]
    >
    publicPrefs: Schema.Attribute.JSON
    publishedAt: Schema.Attribute.DateTime
    quickWins: Schema.Attribute.Component<"contribute.quick-win", true>
    quickWinsComputedAt: Schema.Attribute.DateTime
    streak: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>
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
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    featured: Schema.Attribute.Boolean &
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
    relatedArticles: Schema.Attribute.Relation<
      "manyToMany",
      "api::wiki-article.wiki-article"
    > &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    section: Schema.Attribute.Relation<
      "manyToOne",
      "api::wiki-section.wiki-section"
    > &
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
          localized: false
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
  attributes: {
    articles: Schema.Attribute.Relation<
      "oneToMany",
      "api::wiki-article.wiki-article"
    >
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    description: Schema.Attribute.Text
    label: Schema.Attribute.String
    locale: Schema.Attribute.String & Schema.Attribute.Private
    localizations: Schema.Attribute.Relation<
      "oneToMany",
      "api::wiki-section.wiki-section"
    > &
      Schema.Attribute.Private
    name: Schema.Attribute.String & Schema.Attribute.Required
    order: Schema.Attribute.Integer
    publishedAt: Schema.Attribute.DateTime
    slug: Schema.Attribute.UID<"name"> & Schema.Attribute.Required
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
      visible: true
    }
    "content-type-builder": {
      visible: false
    }
  }
  attributes: {
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    draftData: Schema.Attribute.JSON
    editSummary: Schema.Attribute.String
    evidenceType: Schema.Attribute.Enumeration<
      [
        "institutional_url",
        "on_site_photo",
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
        "wiki_edit",
        "blog_submission",
        "topic_suggestion",
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
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<"oneToOne", "admin::user"> &
      Schema.Attribute.Private
    credentialsEncrypted: Schema.Attribute.Text & Schema.Attribute.Required
    isActive: Schema.Attribute.Boolean &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<true>
    label: Schema.Attribute.String & Schema.Attribute.Required
    lastErrorMessage: Schema.Attribute.Text
    lastSyncAt: Schema.Attribute.DateTime
    lastSyncStatus: Schema.Attribute.Enumeration<["ok", "partial", "error"]>
    lastVerifiedAt: Schema.Attribute.DateTime
    libraries: Schema.Attribute.Relation<"manyToMany", "api::library.library">
    locale: Schema.Attribute.String & Schema.Attribute.Private
    localizations: Schema.Attribute.Relation<
      "oneToMany",
      "plugin::events.event-credential"
    > &
      Schema.Attribute.Private
    provider: Schema.Attribute.Enumeration<
      [
        "eventbrite",
        "ticketsource",
        "meetup",
        "ical",
        "wegottickets",
        "spydus",
        "bibliocommons",
      ]
    > &
      Schema.Attribute.Required
    publishedAt: Schema.Attribute.DateTime
    scope: Schema.Attribute.Enumeration<["library", "group"]> &
      Schema.Attribute.Required
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
      visible: true
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
      visible: true
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
        "daily_streak",
        "manual_award",
        "manual_deduct",
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
      "api::area.area": ApiAreaArea
      "api::blog-article.blog-article": ApiBlogArticleBlogArticle
      "api::blog-landing.blog-landing": ApiBlogLandingBlogLanding
      "api::blog-section.blog-section": ApiBlogSectionBlogSection
      "api::catalogue-branch.catalogue-branch": ApiCatalogueBranchCatalogueBranch
      "api::catalogue.catalogue": ApiCatalogueCatalogue
      "api::category.category": ApiCategoryCategory
      "api::continent.continent": ApiContinentContinent
      "api::country.country": ApiCountryCountry
      "api::footer.footer": ApiFooterFooter
      "api::homepage.homepage": ApiHomepageHomepage
      "api::library-affiliation.library-affiliation": ApiLibraryAffiliationLibraryAffiliation
      "api::library.library": ApiLibraryLibrary
      "api::page.page": ApiPagePage
      "api::redirect.redirect": ApiRedirectRedirect
      "api::region.region": ApiRegionRegion
      "api::saved-event.saved-event": ApiSavedEventSavedEvent
      "api::service.service": ApiServiceService
      "api::subscriber.subscriber": ApiSubscriberSubscriber
      "api::topic.topic": ApiTopicTopic
      "api::user-profile.user-profile": ApiUserProfileUserProfile
      "api::wiki-article.wiki-article": ApiWikiArticleWikiArticle
      "api::wiki-landing.wiki-landing": ApiWikiLandingWikiLanding
      "api::wiki-section.wiki-section": ApiWikiSectionWikiSection
      "plugin::content-moderation.submission": PluginContentModerationSubmission
      "plugin::content-moderation.submission-upload": PluginContentModerationSubmissionUpload
      "plugin::content-releases.release": PluginContentReleasesRelease
      "plugin::content-releases.release-action": PluginContentReleasesReleaseAction
      "plugin::events.event": PluginEventsEvent
      "plugin::events.event-credential": PluginEventsEventCredential
      "plugin::events.import-run": PluginEventsImportRun
      "plugin::events.sync-command": PluginEventsSyncCommand
      "plugin::i18n.locale": PluginI18NLocale
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
