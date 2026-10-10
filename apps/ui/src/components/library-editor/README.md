# Library record editor

`IndexRecordWizard` is the shared form for contribute new/edit and staff new/edit: seven steps for fixed libraries, eight for Mobile libraries. Route pages handle authentication, permissions and loading the record; the form owns draft state and renders the same fields and controls in every area.

- `new` and `improve` save submission drafts and send changes for editorial review.
- `staff-new` sends the new record and staff/Team request together for review.
- `staff` uses `StaffPublishControls`: permitted changes publish directly, protected fields go to a moderator, and previous values/hashes detect conflicts.

For Mobile records, step 2 is Base & area, step 3 is Stops & times and step 4 is Visit & access. Stops & times contains the timetable, service notices and timetable source link. Visit & access reuses the fixed library's contact, service, amenity and accessibility fields. `TimetableEditor` owns the timetable controls, map, calendar and import/pin tools. `timetableContext` supplies published notices and the library timezone independently of the editable draft. `TimetableServiceNotices` allows existing staff to manage notices using the published stops and cycle; notices publish separately from the draft timetable.

Step IDs, ordering, labels and query aliases live in `wizard.steps.ts`. IDs stored in drafts identify field groups; the rail and headings display their position in the current library's order. Mobile Visit & access uses ID 8, inserted after ID 3. Timetable editing is `/staff/{slug}/edit?step=timetable`; access and contact links use `?step=access` and `?step=links`, which resolve for either library type. There is no separate timetable route. Translation mode keeps shared timetable fields read-only.

Editor fields use the application’s design tokens and design-system primitives. Side panels use `ds/Drawer`; `ds/Sheet` is its controlled wrapper with padded content and an action footer. Staff and Editorial use shared `ds/DrawerCards` for their shortcuts. Find pins, spreadsheet import, service notices, filters, Atlas plans and event details use the same modal drawer shell. Keep route imports out of this folder.
