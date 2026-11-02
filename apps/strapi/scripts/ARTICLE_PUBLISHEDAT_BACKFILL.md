# Article publishedAt Field Backfill Guide

## Overview

A custom `publishedAt` field was added to blog and wiki articles to track the first publication separately from Strapi's internal system field. This prevents duplicate "published" entries in the edit history.

Existing published articles need to be backfilled with this field before the changes go live.

## Timeline

1. **Code deploy**: Schemas and middleware changes go to production
2. **Check existing data**: Run the status check script to see what needs backfilling
3. **Run backfill**: Execute the backfill script to populate the field for all existing published articles
4. **Verify**: Run the check script again to confirm all articles are updated

## Scripts

### 1. Check Status (Review First)

See how many articles need the backfill:

```bash
# Against production
STRAPI_URL=https://your-prod-url \
STRAPI_API_TOKEN=your_token \
STRAPI_BRIDGE_SECRET=your_secret \
pnpm tsx apps/strapi/scripts/check-article-published-status.ts

# Against local
pnpm tsx apps/strapi/scripts/check-article-published-status.ts
```

Output shows:

- Total published articles per content type
- How many already have custom `publishedAt`
- How many need backfilling
- List of articles needing backfill (if < 10, or first 10 if more)

### 2. Run Backfill

Populate the `publishedAt` field for all published articles without it:

```bash
# Against production
STRAPI_URL=https://your-prod-url \
STRAPI_API_TOKEN=your_token \
STRAPI_BRIDGE_SECRET=your_secret \
pnpm tsx apps/strapi/scripts/backfill-article-published-at.ts

# Against local
pnpm tsx apps/strapi/scripts/backfill-article-published-at.ts
```

The script will:

- Query all published articles (paginated)
- For each article with a Strapi `publishedAt` but no custom `publishedAt`, update it
- Log each successful update
- Report total updated count per content type

### 3. Verify Completion

Run the check script again to confirm all articles are backfilled:

```bash
pnpm tsx apps/strapi/scripts/check-article-published-status.ts
```

All published articles should now show `With custom publishedAt: <total>`

## How It Works

### The Issue (Before)

When an article is edited and republished:

1. Edit draft → "Edited" recorded ✓
2. Publish → "Published" recorded (but Strapi's `publishedAt` updates every time) ✓
3. Edit draft again → "Edited" recorded ✓
4. Publish again → "Published" recorded **again** (duplicate!) ✗

### The Solution (After)

- Custom `publishedAt` field is set **only on first publication**
- Subsequent publishes don't update it
- Middleware checks: if article already has custom `publishedAt`, skip recording "published" event
- Edit history shows only the first publication, with clean edit/publish sequences afterward

### Backfill Strategy

For existing articles:

- Copy their Strapi `publishedAt` to the custom `publishedAt` field
- This marks them as "published on this date" for historical accuracy
- Going forward, new publications and edits work with the deduplicated logic

## Troubleshooting

**"STRAPI_API_TOKEN is not set"**

- Export your API token: `export STRAPI_API_TOKEN=your_token_here`
- Make sure you're using an admin token with write access

**"STRAPI_BRIDGE_SECRET is not set"**

- Export the bridge secret: `export STRAPI_BRIDGE_SECRET=your_secret_here`
- Required for Strapi to process draft/publish status

**Script hangs or times out**

- Reduce `pageSize` in the fetch queries (default 100)
- Run against smaller batch sizes to debug connectivity

**Articles not updating**

- Check the API token has write permissions
- Verify the Strapi URL is reachable
- Review error logs in the script output

## Data Integrity

The backfill is **non-destructive**:

- Only sets `publishedAt` if it's currently null
- Uses Strapi's existing `publishedAt` as the source
- Doesn't modify any other article fields
- Can be re-run safely without side effects

The edit history is **preserved**:

- Existing change records are not modified
- Only new "publish" events are deduplicated after this point
- Existing "published" entries in edit history remain as-is

## Related Changes

See the main commit for:

- Schema updates: `blog-article/schema.json`, `wiki-article/schema.json`
- Lifecycle hooks: `blog-article/lifecycles.ts`, `wiki-article/lifecycles.ts`
- Middleware update: `change-records.ts` (recordArticle function)
