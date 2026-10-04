# Most read this month, from Vercel Web Analytics

Status: needs-info

The Journal landing's sidebar has a "Most read this month" card (`components/blog/MostReadCard.tsx`). Nothing counts reads yet, so `fetchMostReadJournalArticles` in `lib/journal-landing.ts` returns an empty list and the card says "Coming soon".

Plan: once Vercel Web Analytics is on, rank `/journal/{section}/{slug}` pages by views over the last 30 days and return the top five as `JournalCardData` in the requested language.

Open questions:

- How to read the data: check whether Vercel exposes Web Analytics through an API; if not, a Web Analytics drain into a small store (or a periodic export) that the UI can read.
- Whether the privacy notice needs a line about it (page views only, no personal data).
- Caching: the ranking can be recomputed daily.
