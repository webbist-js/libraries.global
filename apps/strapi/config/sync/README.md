# Library admin view

The five files in `apps/strapi/config/sync/` configure the native Library edit
and list views, plus the Social, Source Record, Collection Stat and Library Stat
component layouts. They contain view settings only; they do not change schemas
or Library content.

The edit view puts identity, location, contact details and visitor information
first. Longer editorial content, collections, media, sources and mobile service
fields follow. Generated completeness, gaps, verification timestamps, feed and
staff flags are hidden. The component titles use their platform, source URL,
collection category or statistic label.

To apply the saved layouts to another environment:

1. Open **Settings → Config Sync → Interface**.
2. Clear **Select all entries**.
3. Select only the five configuration entries represented by these files:
   - `content_types::api::library.library`
   - `components::shared.social`
   - `components::library.source-record`
   - `components::library.collection-stat`
   - `components::library.library-stat`
4. Click **Import**, then confirm the import.
5. Reload the Library view.

These files are a partial export. Importing database-only entries would remove
their configuration, so keep the import selection limited to the five files.
Automatic imports on bootstrap are disabled.

For later adjustments, use **Configure the view** in Strapi. Export only the
changed entries through Config Sync to update the files in the repository.
Social's component layout applies wherever `shared.social` is used.
