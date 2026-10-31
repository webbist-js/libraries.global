# Discussions across the platform

One original conversation can appear on a Library, one or more Drives and the Discussions directory. Its authors, messages, reactions, images, subscriptions and review decisions remain attached to that same thread.

## Delivered touchpoints

| Place                 | Behaviour                                                                                                                                                                                                                                                                     |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Suggestions board     | Expand a suggestion card to read recent messages, load earlier replies and post for review. Collapsing preserves the draft. Shared links select and open the card, including decided suggestions; former detail URLs redirect to the board.                                   |
| Drive builder/editor  | Optional feed, searchable links to your own or another member’s readable published threads, one featured conversation, and a new moderated conversation. Save the Drive and its links atomically.                                                                             |
| Drive proposals       | Contributors request a feed and existing links, including a featured thread. Reviewers inspect the request; approval rechecks the proposer’s current thread access before creating the scheduled Drive. New discussion text uses its separate review workflow.                |
| Drive page            | Shared sidebar feed, featured-first ordering, language filter, links to the original conversations, and Board link/settings controls. Closed Drives retain their feed; closure does not lock a shared thread.                                                                 |
| Community Noticeboard | Compact recent-conversations feed across enabled open Drives, labelled with their Drive names.                                                                                                                                                                                |
| Library page          | Shared feed replaces the single full-thread embed. Existing primary attachments are backfilled idempotently, preserving content, authors and subscriptions. New Library conversations can coexist with older pending or rejected roots. The `#discussion` anchor is retained. |
| Discussions directory | Libraries/Drives filters, searchable context picker and bookmarkable entity filters, combined with subject, language, unanswered, following and text search.                                                                                                                  |
| Thread sidebar        | Currently readable linked contexts and versioned feature/unlink controls for their managers. Member preview excludes private contexts and management controls.                                                                                                                |

`DiscussionFeed`, `DiscussionLinkPicker`, `DiscussionContextFilter` and `DiscussionContextActions` are shared components. All dropdowns use `SelectField`; editorial tooling uses `EditorialToolbar`. Feeds browse all languages by default; composition follows the profile language preference/country rules. Account and authorization changes clear private UI state.

## Ownership, moderation and privacy

The standalone plugin owns normalized context associations and settings. Each association has a unique thread/context key, state, optimistic version and audit attribution. Host adapters resolve current titles/URLs and decide context management authority; no host schemas are imported by the plugin.

- The Editorial Board manages Drive and Library links/settings. Verified Library staff may propose links; a different authorized manager must review them. Rejected requests have private contributor feedback and can be proposed again.
- Managing a context does not confer discussion moderation. New roots, replies and edits continue through the existing discussion review queue, including self-review restrictions, profanity policy, image checks, bans/mutes and language-scoped moderator access.
- Every feed, context picker, title, count and page requires access to both the context and the original thread/primary target. A public context cannot publish a private thread. Unpublished/cancelled Drive references are unavailable to ordinary readers.
- Pending thread text and proposed links are visible only to their author and permitted reviewers/managers. Public previews contain approved text and current safe author projections. Private actor keys and feedback never enter public context DTOs.
- Linking does not transfer ownership or imply the original author’s endorsement. Unlinking removes an association, not the conversation. Approved edits and removals take effect across every feed.
- Drive follows and thread subscriptions remain separate. Linking produces audit events, without generating duplicate publication events or subscriber notifications.
- Writes recheck live grants, use optimistic versions and serialize featured swaps. Database uniqueness handles competing first writes with a reloadable conflict. Drive and proposal writes roll back if a link is invalid or inaccessible.

Reads use bounded authorization-aware scans. Counts and pagination follow filtering; capacity overflow returns a generic error. Resolver/settings caches exist only within one read and actor scope. Historical erasure removes private association requests and anonymizes surviving visible association attribution.

## Issues resolved during implementation

- Stale context grants could retain private UI state; the account boundary now includes Board capabilities, staff memberships and claims as well as moderation scopes.
- A competing pending association could reveal another proposer’s private link ID; non-managers now receive an opaque conflict.
- Role promotion could allow review of an actor’s own association; review checks the original proposer regardless of current authority.
- Drive/link writes could partially succeed or turn valid conflicts into generic server errors; writes now share a transaction and preserve validation/conflict responses.
- Hiding a feed could remove the author’s recovery path; private pending/rejected recovery remains available without restoring the public feed.
- A context’s content locale could be lost when opening the directory; shareable context locale is now distinct from the thread-language filter.
- Member preview could retain private context details; private references and inaccessible primary-context content are excluded.

## Moderation workspace

`/moderation` provides an overview and categories for Library changes, Articles, Claims, Drives, Discussions and Role applications. A reviewer with only one category opens it directly. Checklist ideas remain available to eligible reviewers. Articles can be narrowed to Knowledge or Journal.

These categories group submission types within the existing queue and language scopes; they grant no additional permissions. Library changes submitted through a Drive remain in Library changes, with a Drive filter. Drives contains proposals to create a Drive. Review links retain the category and filters when returning to the queue.

Submission listing and statistics accept a `category` filter, applied on the server before counting and pagination. `GET /api/moderation/stats?group=category` supplies scoped category totals. Unknown counts remain unavailable rather than appearing as zero.

The workspace requests discussion revisions with `reviewableOnly=true`, which excludes self-review when the host disallows it, before pagination and totals. Thread views retain the author's pending messages. Report listing returns the total after checking moderation scope and target visibility.

## API and defaults

Reply listing accepts `order=chronological` for inline hosts showing recent messages first. Pagination follows the same approved-message and parent-visibility checks as the full discussion view. Suggestion summaries contain approved-message counts, recent participants and the latest public author; private profiles remain anonymous.

Public bylines include current Editor, Moderator or Editorial board tags from active role grants. Board membership takes precedence; users who hold both editor and moderator roles can show both. These tags describe membership, while moderation controls still check the permitted queue and language for each action. Private or activity-hidden profiles show anonymous bylines without tags. On suggestion conversations, `Suggested this` identifies the published suggestion's creator by private identity, independently of who started the thread. The shared `AuthorBadges` component displays these tags on embedded messages, full discussions, review cards, feeds, participants and suggestion bylines.

Plugin content API: `GET/PUT /context`, `GET /contexts`, `POST /context-links`, `PUT /context-links/:id`. Thread listing accepts `contextType`, `contextUid`, `contextId`, `contextLocale`, `activeContexts=1`, and `mine=1`. Equivalent Strapi-admin routes require the plugin’s read/manage RBAC permissions.

Host kinds are `libraries` and `drives`. Library feeds default on; Drive feeds default off. A Drive can select up to ten existing threads in its builder; a thread may hold at most twenty visible and twenty pending associations. Context managers can enable/hide feeds without changing thread publication. The existing primary attachment stays as an access boundary; additional associations supplement it.

## Follow-on work

Conversation-to-Drive prefill shortcuts and Journal wrap-up shortcuts remain a later stage. Suggestions, Journal/Knowledge article embeds, profile activity, explicit regional links and Events can reuse the portable model when their own publishing/privacy rules are defined. Do not automatically associate every regional Drive with every Library or mirror discussion text into another publication.

## Verification

Behavioural coverage includes one thread across multiple contexts, another author’s thread, private subject/draft-context isolation, owner recovery, staff proposals and rejection feedback, self-review denial, stale versions, competing links/featured swaps, active-Drive filters, erasure, and unchanged notification fan-out. Host tests cover live Board/target permissions and atomic Drive rollback. UI checks cover combined filters, shared thread URLs, language defaults, disabled feeds and account-authority changes.

Independent packed-host marketplace acceptance remains a release check; local implementation does not publish the plugin or deploy production.
