import type { Schema, Struct } from "@strapi/strapi"

export interface ContentCallout extends Struct.ComponentSchema {
  collectionName: "components_content_callouts"
  info: {
    description: "An info, warning, tip, or note callout box"
    displayName: "Callout"
  }
  attributes: {
    body: Schema.Attribute.Text & Schema.Attribute.Required
    title: Schema.Attribute.String
    type: Schema.Attribute.Enumeration<["info", "warning", "tip", "note"]> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<"info">
  }
}

export interface ContentCodeBlock extends Struct.ComponentSchema {
  collectionName: "components_content_code_blocks"
  info: {
    description: "A syntax-highlighted code snippet with optional filename label"
    displayName: "Code Block"
  }
  attributes: {
    code: Schema.Attribute.Text & Schema.Attribute.Required
    filename: Schema.Attribute.String
    language: Schema.Attribute.String & Schema.Attribute.DefaultTo<"plaintext">
  }
}

export interface ContentImageBlock extends Struct.ComponentSchema {
  collectionName: "components_content_image_blocks"
  info: {
    description: "A single image with optional caption, for use within article body"
    displayName: "Image Block"
  }
  attributes: {
    caption: Schema.Attribute.String
    fullWidth: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>
    image: Schema.Attribute.Media<"images"> & Schema.Attribute.Required
  }
}

export interface ContentQuoteBlock extends Struct.ComponentSchema {
  collectionName: "components_content_quote_blocks"
  info: {
    description: "A pull quote with optional attribution and source"
    displayName: "Quote Block"
  }
  attributes: {
    attribution: Schema.Attribute.String
    quote: Schema.Attribute.Text & Schema.Attribute.Required
    source: Schema.Attribute.String
  }
}

export interface ContentRichText extends Struct.ComponentSchema {
  collectionName: "components_content_rich_texts"
  info: {
    description: "Freeform body text using Strapi blocks editor"
    displayName: "Rich Text"
  }
  attributes: {
    body: Schema.Attribute.Blocks
  }
}

export interface ContributeQuickWin extends Struct.ComponentSchema {
  collectionName: "components_contribute_quick_wins"
  info: {
    displayName: "Quick Win"
    icon: "star"
  }
  attributes: {
    actionUrl: Schema.Attribute.String & Schema.Attribute.Required
    computedForCountry: Schema.Attribute.String
    computedForLanguage: Schema.Attribute.String
    description: Schema.Attribute.Text & Schema.Attribute.Required
    estimatedMinutes: Schema.Attribute.Integer & Schema.Attribute.Required
    points: Schema.Attribute.Integer & Schema.Attribute.Required
    rewardLabel: Schema.Attribute.String & Schema.Attribute.Required
    targetEntityRef: Schema.Attribute.String
    targetSlug: Schema.Attribute.String
    title: Schema.Attribute.String & Schema.Attribute.Required
    type: Schema.Attribute.Enumeration<
      [
        "add_library",
        "add_nearby_library",
        "verify_hours",
        "add_hero_image",
        "translate_wiki",
      ]
    > &
      Schema.Attribute.Required
    winId: Schema.Attribute.String & Schema.Attribute.Required
  }
}

export interface ElementsFooterItem extends Struct.ComponentSchema {
  collectionName: "components_elements_footer_items"
  info: {
    description: ""
    displayName: "FooterItem"
  }
  attributes: {
    links: Schema.Attribute.Component<"utilities.link", true>
    title: Schema.Attribute.String & Schema.Attribute.Required
  }
}

export interface FormsContactForm extends Struct.ComponentSchema {
  collectionName: "components_forms_contact_forms"
  info: {
    displayName: "ContactForm"
  }
  attributes: {
    description: Schema.Attribute.Text
    gdpr: Schema.Attribute.Component<"utilities.link", false>
    title: Schema.Attribute.String
  }
}

export interface FormsNewsletterForm extends Struct.ComponentSchema {
  collectionName: "components_forms_newsletter_forms"
  info: {
    displayName: "Newsletter"
  }
  attributes: {
    description: Schema.Attribute.Text
    gdpr: Schema.Attribute.Component<"utilities.link", false>
    title: Schema.Attribute.String
  }
}

export interface HomepageCitation extends Struct.ComponentSchema {
  collectionName: "components_homepage_citations"
  info: {
    description: "A quoted definition or statement with its source."
    displayName: "Citation"
    icon: "quote"
  }
  attributes: {
    attribution: Schema.Attribute.String
    lead: Schema.Attribute.String
    quote: Schema.Attribute.Text & Schema.Attribute.Required
    sourceLabel: Schema.Attribute.String
    sourceUrl: Schema.Attribute.String
  }
}

export interface HomepageCtaBand extends Struct.ComponentSchema {
  collectionName: "components_homepage_cta_bands"
  info: {
    description: "Heading, body and up to two calls to action. Wrap words in *asterisks* to italicise them."
    displayName: "CTA Band"
    icon: "cursor"
  }
  attributes: {
    primaryHref: Schema.Attribute.String
    primaryLabel: Schema.Attribute.String
    secondaryHref: Schema.Attribute.String
    secondaryLabel: Schema.Attribute.String
    text: Schema.Attribute.Text
    title: Schema.Attribute.String
  }
}

export interface HomepageJourney extends Struct.ComponentSchema {
  collectionName: "components_homepage_journeys"
  info: {
    description: "One of the primary homepage journeys (explore / contribute / represent a library)."
    displayName: "Journey"
    icon: "walk"
  }
  attributes: {
    ctaHref: Schema.Attribute.String
    ctaLabel: Schema.Attribute.String
    eyebrow: Schema.Attribute.String
    text: Schema.Attribute.Text
    title: Schema.Attribute.String & Schema.Attribute.Required
    tone: Schema.Attribute.Enumeration<["explore", "contribute", "steward"]> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<"explore">
  }
}

export interface HomepageLinkCard extends Struct.ComponentSchema {
  collectionName: "components_homepage_link_cards"
  info: {
    description: "Titled link with a one-line description."
    displayName: "Link Card"
    icon: "link"
  }
  attributes: {
    href: Schema.Attribute.String & Schema.Attribute.Required
    text: Schema.Attribute.Text
    title: Schema.Attribute.String & Schema.Attribute.Required
  }
}

export interface HomepageSectionIntro extends Struct.ComponentSchema {
  collectionName: "components_homepage_section_intros"
  info: {
    description: "Heading + supporting line for a homepage section. Wrap words in *asterisks* to italicise them in indigo."
    displayName: "Section Intro"
    icon: "heading"
  }
  attributes: {
    text: Schema.Attribute.Text
    title: Schema.Attribute.String
  }
}

export interface HomepageStep extends Struct.ComponentSchema {
  collectionName: "components_homepage_steps"
  info: {
    description: "A numbered step or bullet point."
    displayName: "Step"
    icon: "bulletList"
  }
  attributes: {
    text: Schema.Attribute.Text
    title: Schema.Attribute.String & Schema.Attribute.Required
  }
}

export interface LibraryCollectionStat extends Struct.ComponentSchema {
  collectionName: "components_library_collection_stats"
  info: {
    displayName: "Collection Stat"
    icon: "chart-line"
  }
  attributes: {
    category: Schema.Attribute.String & Schema.Attribute.Required
    description: Schema.Attribute.String
    value: Schema.Attribute.String & Schema.Attribute.Required
  }
}

export interface LibraryLibraryStat extends Struct.ComponentSchema {
  collectionName: "components_library_library_stats"
  info: {
    displayName: "Library Stat"
    icon: "chart-bar"
  }
  attributes: {
    label: Schema.Attribute.String & Schema.Attribute.Required
    note: Schema.Attribute.String
    value: Schema.Attribute.String & Schema.Attribute.Required
  }
}

export interface ProfileLanguageEntry extends Struct.ComponentSchema {
  collectionName: "components_profile_language_entries"
  info: {
    displayName: "Language Entry"
    icon: "earth"
  }
  attributes: {
    code: Schema.Attribute.String & Schema.Attribute.Required
    proficiency: Schema.Attribute.Enumeration<
      ["native", "fluent", "conversational"]
    > &
      Schema.Attribute.Required
  }
}

export interface SectionsCtaBanner extends Struct.ComponentSchema {
  collectionName: "components_sections_cta_banners"
  info: {
    description: "A full-width call-to-action banner section"
    displayName: "CTA Banner"
  }
  attributes: {
    ctaLabel: Schema.Attribute.String
    ctaUrl: Schema.Attribute.String
    subtitle: Schema.Attribute.Text
    title: Schema.Attribute.String & Schema.Attribute.Required
  }
}

export interface SectionsEditorialBlock extends Struct.ComponentSchema {
  collectionName: "components_sections_editorial_blocks"
  info: {
    description: "A rich editorial content section with optional image and CTAs"
    displayName: "Editorial Block"
  }
  attributes: {
    body: Schema.Attribute.Blocks
    eyebrow: Schema.Attribute.String
    image: Schema.Attribute.Media<"images">
    imagePosition: Schema.Attribute.Enumeration<["left", "right"]> &
      Schema.Attribute.DefaultTo<"right">
    primaryCtaLabel: Schema.Attribute.String
    primaryCtaUrl: Schema.Attribute.String
    secondaryCtaLabel: Schema.Attribute.String
    secondaryCtaUrl: Schema.Attribute.String
    title: Schema.Attribute.String & Schema.Attribute.Required
  }
}

export interface SectionsQuickLinks extends Struct.ComponentSchema {
  collectionName: "components_sections_quick_links"
  info: {
    description: "Editor-curated navigation shortcut strip. Add a heading and one or more links."
    displayName: "Quick Links"
    icon: "link"
  }
  attributes: {
    heading: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    links: Schema.Attribute.Component<"shared.quick-link", true> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
  }
}

export interface SharedHighlightCard extends Struct.ComponentSchema {
  collectionName: "components_shared_highlight_cards"
  info: {
    description: ""
    displayName: "HighlightCard"
  }
  attributes: {
    ctaLabel: Schema.Attribute.String
    ctaUrl: Schema.Attribute.String
    eyebrow: Schema.Attribute.String
    icon: Schema.Attribute.JSON &
      Schema.Attribute.CustomField<
        "plugin::strapi-plugin-iconhub.iconhub",
        {
          storeIconData: true
        }
      >
    summary: Schema.Attribute.Text
    title: Schema.Attribute.String & Schema.Attribute.Required
  }
}

export interface SharedMapConfig extends Struct.ComponentSchema {
  collectionName: "components_shared_map_configs"
  info: {
    description: "Editorial hints for in-page map sections \u2014 center coordinates, default zoom level, optional bounding box for fit-bounds behaviour."
    displayName: "Map Config"
    icon: "earth"
  }
  attributes: {
    boundingBoxNE: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    boundingBoxSW: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    centerLat: Schema.Attribute.Decimal &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    centerLng: Schema.Attribute.Decimal &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    defaultZoom: Schema.Attribute.Integer &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    mapStyle: Schema.Attribute.Enumeration<["standard", "satellite", "topo"]> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }> &
      Schema.Attribute.DefaultTo<"standard">
  }
}

export interface SharedOpenGraph extends Struct.ComponentSchema {
  collectionName: "components_shared_open_graphs"
  info: {
    displayName: "openGraph"
    icon: "project-diagram"
  }
  attributes: {
    ogDescription: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 200
      }>
    ogImage: Schema.Attribute.Media<"images">
    ogTitle: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 70
      }>
    ogType: Schema.Attribute.String
    ogUrl: Schema.Attribute.String
  }
}

export interface SharedQuickLink extends Struct.ComponentSchema {
  collectionName: "components_shared_quick_links"
  info: {
    description: "Editor-curated navigation shortcut for command-center strip sections."
    displayName: "Quick Link"
    icon: "link"
  }
  attributes: {
    description: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    href: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    icon: Schema.Attribute.JSON &
      Schema.Attribute.CustomField<
        "plugin::strapi-plugin-iconhub.iconhub",
        {
          storeIconData: true
        }
      >
    label: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
  }
}

export interface SharedSeo extends Struct.ComponentSchema {
  collectionName: "components_shared_seos"
  info: {
    displayName: "seo"
    icon: "search"
  }
  attributes: {
    canonicalURL: Schema.Attribute.String
    keywords: Schema.Attribute.Text
    metaDescription: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 160
        minLength: 50
      }>
    metaImage: Schema.Attribute.Media<"images">
    metaRobots: Schema.Attribute.String
    metaTitle: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 60
      }>
    metaViewport: Schema.Attribute.String
    openGraph: Schema.Attribute.Component<"shared.open-graph", false>
    structuredData: Schema.Attribute.JSON
  }
}

export interface SharedSocial extends Struct.ComponentSchema {
  collectionName: "components_shared_socials"
  info: {
    description: ""
    displayName: "Social"
  }
  attributes: {
    label: Schema.Attribute.String
    platform: Schema.Attribute.Enumeration<
      [
        "facebook",
        "instagram",
        "x",
        "linkedin",
        "youtube",
        "tiktok",
        "whatsapp",
        "telegram",
        "wechat",
        "threads",
        "bluesky",
        "mastodon",
        "pinterest",
      ]
    > &
      Schema.Attribute.Required
    url: Schema.Attribute.String & Schema.Attribute.Required
  }
}

export interface SharedSpotlightCard extends Struct.ComponentSchema {
  collectionName: "components_shared_spotlight_cards"
  info: {
    description: "Curated archive or collection spotlight \u2014 richer than a library card, lighter than an editorial block. Used for country/region collections sections."
    displayName: "Spotlight Card"
    icon: "star"
  }
  attributes: {
    ctaLabel: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    ctaUrl: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    eyebrow: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    image: Schema.Attribute.Media<"images">
    summary: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    theme: Schema.Attribute.Enumeration<
      ["default", "heritage", "digital", "science", "archive"]
    > &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }> &
      Schema.Attribute.DefaultTo<"default">
    title: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
  }
}

export interface SharedStatCard extends Struct.ComponentSchema {
  collectionName: "components_shared_stat_cards"
  info: {
    description: "Hero metric card \u2014 e.g. '1,200+ Libraries'. Set isComputed:true for stats the API layer should attempt to replace with a live count."
    displayName: "Stat Card"
    icon: "hashtag"
  }
  attributes: {
    icon: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    isComputed: Schema.Attribute.Boolean &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }> &
      Schema.Attribute.DefaultTo<false>
    label: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    note: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    value: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
  }
}

export interface UtilitiesAccordions extends Struct.ComponentSchema {
  collectionName: "components_utilities_accordions"
  info: {
    description: ""
    displayName: "Accordions"
  }
  attributes: {
    answer: Schema.Attribute.Text & Schema.Attribute.Required
    question: Schema.Attribute.String & Schema.Attribute.Required
  }
}

export interface UtilitiesBasicImage extends Struct.ComponentSchema {
  collectionName: "components_utilities_basic_images"
  info: {
    displayName: "BasicImage"
  }
  attributes: {
    alt: Schema.Attribute.String
    fallbackSrc: Schema.Attribute.String
    height: Schema.Attribute.Integer
    media: Schema.Attribute.Media<"images" | "videos"> &
      Schema.Attribute.Required
    width: Schema.Attribute.Integer
  }
}

export interface UtilitiesCkEditorContent extends Struct.ComponentSchema {
  collectionName: "components_utilities_ck_editor_contents"
  info: {
    displayName: "CkEditorContent"
  }
  attributes: {
    content: Schema.Attribute.RichText &
      Schema.Attribute.CustomField<
        "plugin::ckeditor5.CKEditor",
        {
          preset: "defaultCkEditor"
        }
      >
  }
}

export interface UtilitiesCkEditorText extends Struct.ComponentSchema {
  collectionName: "components_utilities_ck_editor_texts"
  info: {
    displayName: "CkEditorText"
  }
  attributes: {
    content: Schema.Attribute.RichText &
      Schema.Attribute.CustomField<
        "plugin::ckeditor5.CKEditor",
        {
          preset: "simpleCkEditor"
        }
      >
  }
}

export interface UtilitiesImageWithLink extends Struct.ComponentSchema {
  collectionName: "components_utilities_image_with_links"
  info: {
    description: ""
    displayName: "ImageWithLink"
  }
  attributes: {
    image: Schema.Attribute.Component<"utilities.basic-image", false>
    link: Schema.Attribute.Component<"utilities.link", false>
  }
}

export interface UtilitiesLink extends Struct.ComponentSchema {
  collectionName: "components_utilities_links"
  info: {
    displayName: "Link"
  }
  attributes: {
    decorations: Schema.Attribute.Component<"utilities.link-decorations", false>
    href: Schema.Attribute.String & Schema.Attribute.Required
    label: Schema.Attribute.String & Schema.Attribute.Required
    newTab: Schema.Attribute.Boolean &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<false>
    page: Schema.Attribute.Relation<"oneToOne", "api::page.page">
    type: Schema.Attribute.Enumeration<["external", "page"]> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<"page">
  }
}

export interface UtilitiesLinkDecorations extends Struct.ComponentSchema {
  collectionName: "components_utilities_link_decorations"
  info: {
    displayName: "LinkDecorations"
  }
  attributes: {
    hasIcons: Schema.Attribute.Boolean &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<false>
    leftIcon: Schema.Attribute.Component<"utilities.basic-image", false>
    rightIcon: Schema.Attribute.Component<"utilities.basic-image", false>
    size: Schema.Attribute.Enumeration<
      ["default", "xs", "sm", "lg", "icon", "icon-xs", "icon-sm", "icon-lg"]
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<"default">
    variant: Schema.Attribute.Enumeration<
      ["default", "destructive", "outline", "secondary", "ghost", "link"]
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<"link">
  }
}

export interface UtilitiesLinksWithTitle extends Struct.ComponentSchema {
  collectionName: "components_utilities_links_with_titles"
  info: {
    displayName: "LinksWithTitle"
  }
  attributes: {
    links: Schema.Attribute.Component<"utilities.link", true>
    title: Schema.Attribute.String
  }
}

export interface UtilitiesText extends Struct.ComponentSchema {
  collectionName: "components_utilities_texts"
  info: {
    displayName: "Text"
  }
  attributes: {
    text: Schema.Attribute.String
  }
}

export interface UtilitiesTipTapRichText extends Struct.ComponentSchema {
  collectionName: "components_utilities_tip_tap_rich_texts"
  info: {
    displayName: "TipTapRichText"
    icon: "layer"
  }
  attributes: {
    content: Schema.Attribute.Text &
      Schema.Attribute.CustomField<"plugin::tiptap-editor.RichText">
  }
}

declare module "@strapi/strapi" {
  export namespace Public {
    export interface ComponentSchemas {
      "content.callout": ContentCallout
      "content.code-block": ContentCodeBlock
      "content.image-block": ContentImageBlock
      "content.quote-block": ContentQuoteBlock
      "content.rich-text": ContentRichText
      "contribute.quick-win": ContributeQuickWin
      "elements.footer-item": ElementsFooterItem
      "forms.contact-form": FormsContactForm
      "forms.newsletter-form": FormsNewsletterForm
      "homepage.citation": HomepageCitation
      "homepage.cta-band": HomepageCtaBand
      "homepage.journey": HomepageJourney
      "homepage.link-card": HomepageLinkCard
      "homepage.section-intro": HomepageSectionIntro
      "homepage.step": HomepageStep
      "library.collection-stat": LibraryCollectionStat
      "library.library-stat": LibraryLibraryStat
      "profile.language-entry": ProfileLanguageEntry
      "sections.cta-banner": SectionsCtaBanner
      "sections.editorial-block": SectionsEditorialBlock
      "sections.quick-links": SectionsQuickLinks
      "shared.highlight-card": SharedHighlightCard
      "shared.map-config": SharedMapConfig
      "shared.open-graph": SharedOpenGraph
      "shared.quick-link": SharedQuickLink
      "shared.seo": SharedSeo
      "shared.social": SharedSocial
      "shared.spotlight-card": SharedSpotlightCard
      "shared.stat-card": SharedStatCard
      "utilities.accordions": UtilitiesAccordions
      "utilities.basic-image": UtilitiesBasicImage
      "utilities.ck-editor-content": UtilitiesCkEditorContent
      "utilities.ck-editor-text": UtilitiesCkEditorText
      "utilities.image-with-link": UtilitiesImageWithLink
      "utilities.link": UtilitiesLink
      "utilities.link-decorations": UtilitiesLinkDecorations
      "utilities.links-with-title": UtilitiesLinksWithTitle
      "utilities.text": UtilitiesText
      "utilities.tip-tap-rich-text": UtilitiesTipTapRichText
    }
  }
}
