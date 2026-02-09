# Tiger Den – UX Improvement Suggestions

**Date:** 2026-02-09  
**Purpose:** Review of the app and docs with concrete UX suggestions. No code changes yet—review and prioritize, then we can implement.

---

## Decisions (from product)

- **Export CSV:** Show “Coming soon” (don’t remove the button).
- **Delete All:** Hide for non-admins.
- **Search modes:** Improve discoverability for new users (show modes always, with clear labeling when search is empty).
- **Date range filter:** Important—prioritize so we can see fresh vs old content.
- **Queue in nav:** Show only to admins (move under Admin or role-gate).
- **Toasts:** Add a toast library (e.g. sonner) for success/error feedback.
- **Campaign highlight:** See explanation in §10 (Q7)—implement in first batch.
- **Home for logged-in users:** Build a simple dashboard on `/` instead of redirecting straight to `/content`.
- **Content table columns:** Consider adding more fields/columns to the content list table (see §3.7).

---

## 1. Bugs / Incomplete Behavior

### 1.1 Content list: pagination not reset when filters change
**Where:** `src/app/content/_components/content-table.tsx`  
**Issue:** `useEffect` that resets `page` to 0 has dependency array `[]`, so it only runs on mount. When the user changes search, content type, or campaign, they can stay on e.g. page 3 and see wrong or empty results.  
**Suggestion:** Reset page when any filter changes, e.g. depend on `filters.search`, `filters.contentTypeIds`, `filters.campaignIds`.

### 1.2 Export CSV button does nothing
**Where:** `src/app/content/_components/content-filters.tsx` (Export CSV button)  
**Issue:** Button has no `onClick`. Export was deferred (see FOLLOW-UP.md Task 14) but the button is still visible.  
**Decision:** Show “Coming soon”—disable the button and add a tooltip (or subtitle) so users know the feature is planned.

### 1.3 Campaign highlight from content detail is unused
**Where:** Content detail links to `/campaigns?highlight=${campaignId}`; campaigns page never reads `highlight`.  
**Issue:** Clicking a campaign badge on a content item goes to campaigns but doesn’t scroll to or highlight that campaign.  
**Suggestion:** On campaigns page, read `searchParams.highlight`, scroll to that row and/or add a brief highlight (e.g. background) so the link feels meaningful.

### 1.4 Delete content: errors not shown in UI
**Where:** `src/app/content/_components/delete-content-dialog.tsx`  
**Issue:** On delete failure, only `console.error` is used. User sees no toast or inline message.  
**Suggestion:** Show error state in the dialog (e.g. Alert below the buttons or replace description with error message) and keep dialog open so they can retry or cancel.

---

## 2. Navigation & Information Architecture

### 2.1 Home vs content for logged-in users
**Current:** Logged-in users are redirected from `/` to `/content`. Home is only for sign-in.  
**Suggestion:** Consider keeping a lightweight “dashboard” on `/` for signed-in users (e.g. quick stats, recent content, links to Content / Campaigns / Admin) so “Tiger Den” feels like a hub. Optional; only if you want a true landing experience after login.

### 2.2 Nav: active state and hierarchy
**Current:** Main nav is plain links with hover underline. No clear “you are here.”  
**Suggestion:** Add an active state (e.g. font weight, border, or background) for the current section. If Admin has many sub-pages, consider a compact breadcrumb or “Admin > API Import” in the admin layout.

### 2.3 Queue in main nav
**Current:** “Queue” is in the main nav for all authenticated users.  
**Suggestion:** If Queue is mostly for admins or power users, consider moving it under Admin or showing it only for certain roles to reduce clutter for readers/contributors.

### 2.4 Admin sub-nav active state
**Where:** `src/app/admin/layout.tsx`  
**Current:** Admin sub-nav has no active state.  
**Suggestion:** Highlight the current admin section (e.g. Content Types, Users, Queue, API Import) the same way you do for the main nav.

---

## 3. Content List & Filters

### 3.1 Search mode discoverability
**Current:** Search mode (Titles/Metadata, Keywords, Full Content) only appears after the user types in the search box.  
**Suggestion:** Consider always showing the three options (disabled/gray when search is empty) so users learn that multiple search modes exist. Optional: short tooltips or a “?” explaining “Keywords (BM25)” vs “Full Content (AI)” and cost/speed.

### 3.2 Filter UX: multi-select for type and campaign
**Current:** Content type and campaign are single-select. To see “Blog + Video” or “Campaign A and B” you can’t.  
**Suggestion:** If that’s a common need, use multi-select (e.g. same pattern as CampaignMultiSelect) for content type and campaign. If not, leave as-is but ensure “All” is obvious.

### 3.3 Date range filter in UI
**Current:** Backend supports `publishDateFrom` / `publishDateTo` but the content filters UI doesn’t expose them.  
**Suggestion:** Add optional “Publish date from/to” (e.g. two date pickers or a range) and pass them into the list query so “date range” in CLAUDE.md is fulfilled.

### 3.4 Delete All placement and safety
**Current:** “Delete All” is next to Add Content and Import CSV.  
**Suggestion:** Move to a “Danger zone” (e.g. bottom of the filters area or a “…” menu), or at least add a confirmation step that requires typing “delete all” or similar. The dialog already says “testing feature”—if it’s only for dev, consider hiding it behind a role or a query flag.

### 3.5 Loading and empty states
**Current:** “Loading...” is plain text. Empty table has a single message.  
**Suggestion:** Use a small skeleton for the table (e.g. shimmer rows) and differentiate empty states: “No content” vs “No results for this search/filter” with a “Clear filters” CTA in the latter case.

### 3.6 Result count and search summary
**Current:** Pagination shows “Showing X to Y of Z”; hybrid search shows “Top N most relevant results” with no total.  
**Suggestion:** For hybrid/keyword search, consider showing “X results” or “Top 50 of ~N matches” if the backend can return an approximate total. Keeps users oriented.

### 3.7 Content table: additional columns (product request)
**Current:** Table shows Title, Type, Publish Date, Campaigns, Author, Relevance (when searching), Actions, Index Status.  
**Suggestion:** Consider adding or making configurable other fields that might be useful in list view, e.g. Description (truncated), Target audience, Tags, Source, Created/Updated dates, or URL. Could be a “column picker” or a fixed set of extra columns—decide based on how the team actually uses the list. Capture in implementation plan as “audit content table columns / add optional columns.”

---

## 4. Content Detail Page

### 4.1 Edit/Delete prominence
**Current:** Edit and Delete are outline buttons in the header.  
**Suggestion:** Fine as-is; ensure keyboard users can reach them and that Delete is clearly destructive (already is in the dialog). Optional: move Delete to a “…” menu to reduce accidental clicks.

### 4.2 Back to list
**Current:** Breadcrumb “Content Inventory / {title}” with “Content Inventory” linking back.  
**Suggestion:** Add an explicit “← Back to content” or “Back to list” so it’s obvious how to return without losing context. Optionally preserve list filters in the URL (e.g. `/content?search=...`) so back keeps the same view.

### 4.3 Index status and re-index
**Current:** Search Index card shows status and Re-index button.  
**Suggestion:** If Re-index is only shown for failed/pending (in reindex-button), consider always showing a “Re-index” action for indexed items too (e.g. “Refresh index”) with a short note that it’s for when the source content changed. Makes the feature discoverable.

---

## 5. Forms (Add/Edit Content, Campaigns)

### 5.1 Add Content form defaults
**Current:** New content defaults to first content type; other fields empty.  
**Suggestion:** If one content type is dominant, default to it; otherwise keep “first” but ensure the dropdown is visible. Optional: remember last-used content type in localStorage.

### 5.2 Campaign multi-select: create from form
**Current:** Can create a campaign from the multi-select; flow is good.  
**Suggestion:** If “Create new campaign” is used often, consider a quick-add on the campaigns list page (e.g. inline “+ Add” that expands to name + save) so users don’t have to open the full dialog.

### 5.3 Form validation feedback
**Current:** Zod + react-hook-form show messages per field.  
**Suggestion:** On submit, scroll to first error and optionally show a short summary “Please fix 2 errors” so users don’t miss messages below the fold.

### 5.4 Success feedback after create/update
**Current:** Dialog closes and list invalidates. No toast or banner.  
**Suggestion:** Optional: brief toast “Content created” / “Content updated” so users get explicit confirmation, especially after creating from the table.

---

## 6. CSV Import

### 6.1 Template and column mapping
**Current:** Template download and dropzone; columns are fixed.  
**Suggestion:** (From FOLLOW-UP.) Add a “Validate only” step that checks CSV structure and required columns before starting import, and reports fixable issues (e.g. “Row 5: invalid date”, “Missing column: title”) so users can fix the file and re-upload.

### 6.2 Post-import: stay vs close
**Current:** After import, user sees results and can “Close” or “Import Another File.”  
**Suggestion:** “Close” could also refresh the content list (or invalidate the query) so when they close the dialog they immediately see the new items. Confirm this is already happening via invalidation when the dialog closes.

### 6.3 Large file and limits
**Current:** 1000 rows, 5MB; error shown on drop.  
**Suggestion:** Before they pick a file, show a short note: “Max 1000 rows, 5MB. Use the template for column format.” Reduces failed drops.

---

## 7. Admin

### 7.1 Queue dashboard: replace `alert()` and `confirm()`
**Where:** `src/app/admin/queue/page.tsx`  
**Current:** Success and error use `alert()`; confirmations use `confirm()`.  
**Suggestion:** Use in-app toasts for success/error and proper modal/dialog for “Enqueue all pending?” / “Re-index all?” so the experience is consistent with the rest of the app and works better on small screens.

### 7.2 Queue: button styling
**Current:** Buttons use raw `className` (e.g. `rounded-md border bg-primary...`) instead of the shared `Button` component.  
**Suggestion:** Use `<Button>` from `~/components/ui/button` for consistency and to get disabled/loading states and a11y for free.

### 7.3 API Import: single-item “Actually Import”
**Current:** Single Item Tester only has “Fetch”; no “Actually Import” from that screen (per API integration design).  
**Suggestion:** If you want the workflow “fetch one → verify → import that one,” add an “Import this item” button that calls the existing import for that single item so admins don’t have to switch to bulk.

### 7.4 API Import: bulk import progress
**Current:** Bulk import runs as a mutation; for large runs there’s no live progress.  
**Suggestion:** If bulk can run long, consider SSE or polling for progress (similar to CSV import) so users see “Imported 45/120…” and don’t think the tab is stuck.

### 7.5 Content Types: delete confirmation
**Current:** Delete/reassign uses AlertDialog with detailed copy; good.  
**Suggestion:** When reassigning, show which content type items will be reassigned to (e.g. “Other”) in the dialog so it’s explicit.

### 7.6 Users: role change feedback
**Current:** Role change uses `confirm()` and on error `alert(error.message)`.  
**Suggestion:** Replace with in-app confirmation dialog and toast (or inline message) for success/error so it matches the rest of the app.

---

## 8. Consistency & Polish

### 8.1 Reindex button styling
**Where:** `src/app/content/_components/reindex-button.tsx`  
**Current:** Uses custom `className` (e.g. `bg-blue-600`) instead of design system.  
**Suggestion:** Use `<Button size="sm" variant="secondary">` (or a small “outline”) so it matches other actions and works with themes.

### 8.2 Loading text
**Current:** “Loading...”, “Loading campaigns...”, “Loading history...” in different places.  
**Suggestion:** Optionally use a single small spinner + “Loading” component so all loading states look and feel the same.

### 8.3 Empty states
**Current:** Some pages have “No X yet. Do Y to get started”; others are minimal.  
**Suggestion:** Standardize: icon + short message + primary CTA (e.g. “Add first content” / “Create campaign”) so empty states feel intentional and guide the next step.

---

## 9. Accessibility & Keyboard

### 9.1 Focus and dialogs
**Current:** Dialogs use Radix/shadcn; focus trap is likely in place.  
**Suggestion:** After opening Add/Edit content or Delete, ensure focus moves to the first focusable element (or “Cancel”) and that Escape closes the dialog; verify with keyboard-only.

### 9.2 Table actions
**Current:** Row actions are icon buttons (Pencil, Trash) with aria-labels in some places.  
**Suggestion:** Audit all table rows: every icon button should have `aria-label` (e.g. “Edit [title]”, “Delete [title]”) so screen readers and tooltips are clear.

### 9.3 Search and filters
**Current:** Search is a single input; filters are selects and buttons.  
**Suggestion:** Ensure tab order is logical (search → content type → campaign → Clear → Add/Import/Export) and that “Clear filters” is reachable and announced.

---

## 10. Questions & Answers (reference)

Decisions are summarized at the top of this doc. Below: quick reference and the campaign-highlight explanation.

1. **Export CSV:** Do you want to implement it soon? If not, should we remove the button or show “Coming soon”?
→ "Coming soon" (see Decisions).
2. **Delete All:** Is it only for testing? Should it be hidden for non-admins or behind a feature flag?
→ Hidden for non-admins (see Decisions).
3. **Search modes:** Do you want the three modes (Titles/Metadata, Keywords, Full Content) visible even when the search box is empty, or is “only when typing” intentional?
→ Show always for discoverability (see Decisions).
4. **Date range filter:** How high is the priority for “filter by publish date range” in the UI?
→ Important; prioritized (see Decisions).
5. **Queue in nav:** Should “Queue” stay in the main nav for everyone, or move under Admin / restrict by role?
→ Admins only (see Decisions).
6. **Toasts:** Are you okay adding a toast library (e.g. sonner) for success/error feedback, or do you prefer inline messages only?
→ Add toast library (see Decisions).
7. **Campaign highlight:** Implementing `?highlight=` on the campaigns page—is that something you want in the first batch of UX changes?
On a content item's detail page, each campaign badge links to `/campaigns?highlight=<campaignId>`. The campaigns page does not read that param today. Implementing it: when you land with `?highlight=...`, we scroll to that campaign row and/or give it a brief visual highlight so "click campaign on content → see that campaign in context" feels intentional. → First batch (see Decisions).
8. **Home for logged-in users:** Keep redirect to `/content`, or add a simple dashboard on `/`?
→ Simple dashboard on `/` (see Decisions).

**Additional:** Content table may benefit from more columns/fields (see §3.7).

---

## Suggested priority (for implementation)

Updated to reflect your decisions.

**High (bugs & must-fix)**  
- 1.1 Pagination reset when filters change  
- 1.2 Export CSV: show "Coming soon" (disable + tooltip)  
- 1.4 Delete content: show errors in dialog (inline, no toasts yet)

**High (decisions & safety)**  
- 1.3 Campaign highlight on campaigns page (`?highlight=`)  
- 2.1 Simple dashboard on `/` for logged-in users  
- 2.3 Queue in nav: show only to admins (move or role-gate)  
- 2.4 Admin sub-nav active state  
- 3.3 Date range filter in content list UI  
- Add toast library (sonner) and use for success/error where we replace `alert()`

**Medium**  
- 3.1 Search mode discoverability (always show modes, clear when empty)  
- 3.4 Delete All: hide for non-admins  
- 3.5 Loading and empty states  
- 7.1 Queue: replace `alert()`/`confirm()` with toasts + dialogs  
- 7.2 Queue: use shared `Button` component  
- 8.1 Reindex button: use design system  

**Backlog / later**  
- 3.7 Content table: audit/add optional columns  
- Multi-select for type/campaign, CSV validate-before-import, API Import single-item import and bulk progress, form success toasts, etc.

---

## Implementation plan (execution order)

Steps are tracked as GitHub issues so we don’t lose track. Suggested order (dependencies first):

**Phase 1 – Foundation & bugs**  
1. Add toast library (sonner) – needed for later steps  
2. 1.1 Pagination reset when filters change  
3. 1.2 Export CSV: show “Coming soon” (disable + tooltip)  
4. 1.4 Delete content: show errors in dialog (inline)

**Phase 2 – Decisions & nav**  
5. 2.4 Admin sub-nav active state  
6. 2.3 Queue in nav: show only to admins (move or role-gate)  
7. 1.3 Campaign highlight on campaigns page (`?highlight=`)  
8. 2.1 Simple dashboard on `/` for logged-in users  
9. 3.3 Date range filter in content list UI  

**Phase 3 – Polish**  
10. 3.1 Search mode discoverability (always show modes, clear when empty)  
11. 3.4 Delete All: hide for non-admins  
12. 3.5 Loading and empty states  
13. 7.1 Queue: replace `alert()`/`confirm()` with toasts + dialogs  
14. 7.2 Queue: use shared `Button` component  
15. 8.1 Reindex button: use design system  

**Backlog (separate issues)**  
- 3.7 Content table: audit/add optional columns  
- Multi-select for type/campaign filters  
- CSV validate-before-import  
- API Import single-item import and bulk progress  
- Form success toasts  

---

## GitHub issues (created)

All 15 implementation-plan issues are tracked in the repo. Filter by title prefix `[UX]` or open [tiger-den issues](https://github.com/mattstratton/tiger-den/issues).

| Step | Issue | Phase |
|------|--------|--------|
| 1 | [#18 Add toast library (sonner)](https://github.com/mattstratton/tiger-den/issues/18) | 1 – Foundation |
| 2 | [#19 Reset content list pagination when filters change](https://github.com/mattstratton/tiger-den/issues/19) | 1 – Bug |
| 3 | [#20 Export CSV: show "Coming soon"](https://github.com/mattstratton/tiger-den/issues/20) | 1 – Bug |
| 4 | [#21 Delete content: show errors in dialog](https://github.com/mattstratton/tiger-den/issues/21) | 1 – Bug |
| 5 | [#22 Admin sub-nav active state](https://github.com/mattstratton/tiger-den/issues/22) | 2 – Nav |
| 6 | [#23 Queue in nav: show only to admins](https://github.com/mattstratton/tiger-den/issues/23) | 2 – Nav |
| 7 | [#24 Campaign highlight on campaigns page (?highlight=)](https://github.com/mattstratton/tiger-den/issues/24) | 2 – Feature |
| 8 | [#25 Simple dashboard on / for logged-in users](https://github.com/mattstratton/tiger-den/issues/25) | 2 – Feature |
| 9 | [#26 Date range filter in content list UI](https://github.com/mattstratton/tiger-den/issues/26) | 2 – Feature |
| 10 | [#27 Search mode discoverability](https://github.com/mattstratton/tiger-den/issues/27) | 3 – Polish |
| 11 | [#28 Delete All: hide for non-admins](https://github.com/mattstratton/tiger-den/issues/28) | 3 – Polish |
| 12 | [#29 Loading and empty states](https://github.com/mattstratton/tiger-den/issues/29) | 3 – Polish |
| 13 | [#30 Queue: replace alert()/confirm() with toasts + dialogs](https://github.com/mattstratton/tiger-den/issues/30) | 3 – Polish |
| 14 | [#31 Queue: use shared Button component](https://github.com/mattstratton/tiger-den/issues/31) | 3 – Polish |
| 15 | [#32 Reindex button: use design system](https://github.com/mattstratton/tiger-den/issues/32) | 3 – Polish |

**Backlog (create when ready)**  
- [UX] Content table: audit/add optional columns  
- [UX] Multi-select for type/campaign filters  
- [UX] CSV validate-before-import  
- [UX] API Import single-item import and bulk progress  
- [UX] Form success toasts