# Typography

The frontend type scale lives in `apps/ui/src/styles/typography.css`. Its font
variables are also available through `T.type` in `apps/ui/src/lib/design-tokens.ts`.
Change the scale there rather than adding a size to an individual heading.

## Heading hierarchy

Choose the HTML level for the document outline, then choose a visual role for its
context. A sidebar section can use an `h2` with the panel title role; it does not
need to be as large as an article section heading.

| Role                           | Class                | Size at the default root size | Typeface           |
| ------------------------------ | -------------------- | ----------------------------- | ------------------ |
| Page title                     | `type-h1`            | 36–64px                       | Newsreader, medium |
| Compact page title             | `type-page-compact`  | 28–40px                       | Newsreader, medium |
| Inline page title              | `type-page-inline`   | 24–32px                       | Newsreader, medium |
| Section heading                | `type-h2`            | 24–28px                       | Figtree, semibold  |
| Subsection heading             | `type-h3`            | 20px                          | Figtree, semibold  |
| Nested heading                 | `type-h4`            | 18px                          | Figtree, semibold  |
| Sidebar or compact panel title | `type-panel-title`   | 20px                          | Figtree, semibold  |
| Small card title               | `type-card-title`    | 18px                          | Figtree, semibold  |
| Featured card title            | `type-feature-title` | 24–32px                       | Figtree, semibold  |
| Small heading                  | `type-small-heading` | 16px                          | Figtree, semibold  |
| Eyebrow or group label         | `type-label`         | 14px                          | Figtree, semibold  |

Native `h1`–`h6` elements have defaults from this scale. `h5` and `h6` use the small
heading role. Explicit roles are useful when heading level and visual context
differ. Keep margins, colour and layout on the component; the role owns font,
size, weight, line height and letter spacing.

```tsx
<h2 className="type-panel-title m-0">Library staff access</h2>
<h3 className="type-card-title mt-4">Opening hours</h3>
```

## Editorial display

Newsreader is also used for the wordmark and large editorial sections on home,
About and promotional bands. Everyday panels, forms, dialogs and cards use
Figtree.

| Class                  | Size     | Use                                                |
| ---------------------- | -------- | -------------------------------------------------- |
| `type-display-hero`    | 56–128px | Homepage hero; also constrained by viewport height |
| `type-display-band`    | 40–72px  | Major editorial or promotional section             |
| `type-display-section` | 32–48px  | Homepage section                                   |
| `type-display-compact` | 28–36px  | Editorial row or smaller display title             |
| `type-display-closing` | 40–80px  | Homepage closing title                             |

Use `displayStyle()` for existing homepage sections. Other inline styles can use
`font: T.type.displaySection` with `letterSpacing: "var(--type-display-tracking)"`.
Do not add a local font-size override.

Banner and hero accents use `type-heading-accent`: regular-weight italic type on
its own line at every viewport width. `PageHero` and the homepage `Emphasis`
renderer apply this to `*accent*` title markup. Keep that markup in CMS titles.
The accent is indigo on light backgrounds; dark bands use their light accent colour.

Use `hero-eyebrow` above a banner title. Its shared bottom gap is 24–32px,
increasing with the viewport width. Custom hero styles use `--hero-eyebrow-gap`.

## Copy, reading text and figures

Copy uses the usual Tailwind steps: `text-xs` (12px), `text-sm` (14px),
`text-base` (16px), `text-lg` (18px) and `text-xl` (20px). Use 16px for ordinary
copy and sidebar descriptions. Reserve 12–14px for captions and metadata.
Long-form article text uses 18px with a 1.7 line height.

Homepage descriptions, feature summaries, guide rows, supporting copy and primary
actions use `--type-body-size` (16px), matching ordinary site copy. Keep section
titles on shared heading roles. Use 12–14px for eyebrows, badges, counts, dates,
captions and legal metadata rather than explanatory paragraphs.

Published article bodies and the article editor share the heading scale. Wrap
rendered article content in `article-prose` to apply its reading styles.

Use `type-stat` for large figures (32–48px) and `T.type.h2` for compact figures.
Keep tabular numerals on comparisons and numerical columns. The wordmark keeps
its own brand sizing; “Global” has regular weight.
