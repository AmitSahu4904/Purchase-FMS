# Maintenance Notes

## Current Worktree State

At the time this brain folder was created, the repository already had many uncommitted modifications, deletions, renames, and new files. The `.brain` files were added without reverting or modifying those existing changes.

## Important Inconsistencies

### Stage naming drift

Several names have changed, but legacy names remain in logic:

- `Quotation` replaced older `Update 3 Vendors` / `Negotiation` wording in some areas.
- `Lifting` is rendered through slug `follow-up-vendor`.
- `Billing` is rendered through slug `receipt-in-tally`.
- Dashboard still contains older labels such as `Update 3 Vendors`, `Negotiation`, `Serial Generation`, `Submit Invoice`, and `Verification by Accounts`.

When changing stage behavior, update all of these together:

- `lib/constants.ts`
- `app/stages/[slug]/page.tsx`
- `components/sidebar.tsx` count logic
- `components/dashboard.tsx` count logic
- `app/api/cron/generate-report/route.ts` report logic
- Apps Script/backend sheet contract

### Column index drift

Some columns are interpreted differently across components. Examples:

- `INDENT-LIFT row[47]` is selected vendor id in some places and delay/comment-adjacent in others.
- `row[48]` and `row[49]` are used in selected-vendor fallback logic.
- Dashboard labels and stage component labels do not always match.

Best future fix: create a central sheet schema module with named constants, for example:

```ts
export const INDENT_LIFT = {
  indentNo: 1,
  quotationPlanned: 45,
  quotationActual: 46,
  poPlanned: 51,
  poActual: 52,
} as const;
```

Then migrate components gradually.

### Type safety is weakened

`next.config.mjs` sets:

```js
typescript: {
  ignoreBuildErrors: true
}
```

This makes builds less trustworthy. The codebase also uses many `any` sheet rows. Introduce row mapping helpers before attempting strict type cleanup.

### Client-side auth is not strong security

Auth state and page access are stored in `localStorage`. This is useful for the current Apps Script-style app, but it is not a secure authorization boundary. Sensitive write validation must happen in the Apps Script backend.

### Public quotation form trusts row index

`/quotation-form` accepts a row index in the URL and writes to that row. Backend validation should ensure:

- The row exists.
- The requested vendor slot is valid.
- The submitted quote belongs to the intended vendor.
- The stage is still open for quotation.

### Mock fetch can hide backend mismatches

`lib/mock-fetch.ts` implements a helpful local backend, but it may not exactly match production Apps Script behavior. Whenever changing data writes, verify against the real Apps Script contract as well.

### Header row assumptions vary

Most main sheets use row 7 as first data row (`slice(6)`), but `Partial QC` uses row 8 (`slice(7)`) in some logic. Keep this explicit.

## Suggested Cleanup Order

1. Create shared schema constants for every sheet used by multiple components.
2. Replace scattered `row[index]` usages in sidebar and dashboard first, because they are most likely to drift.
3. Normalize stage names and slugs in one pass.
4. Add small mapper functions per sheet, such as `mapIndentLiftRow(row, rowIndex)`.
5. Add backend contract docs or generated types for Apps Script actions.
6. Remove `ignoreBuildErrors` only after the most common `any`/typing issues are handled.

## Local Debugging Tips

- If data looks stale locally, clear `localStorage.mockSheets_data`.
- If auth behaves oddly, clear `isAuthenticated`, `user`, `fullName`, `role`, and `pageAccess` from `localStorage`.
- Sidebar counts refresh every 60 seconds and on route changes.
- The dashboard and sidebar compute counts independently; mismatches do not always indicate backend data problems.
