# APIs and Integrations

## Google Apps Script API

Most frontend components call `process.env.NEXT_PUBLIC_API_URI` directly from the browser. This endpoint is expected to accept URL-encoded form posts and JSON posts depending on the action.

Common frontend calls:

```ts
fetch(`${NEXT_PUBLIC_API_URI}?sheet=INDENT-LIFT&action=getAll`)
fetch(NEXT_PUBLIC_API_URI, { method: "POST", body: URLSearchParams })
fetch(NEXT_PUBLIC_API_URI, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
```

Common payload fields:

- `action`
- `sheetName`
- `sheet`
- `rowIndex`
- `rowData`
- `rowsData`
- `startRow`
- `columnIndex`
- `value`
- file/report upload fields

The frontend assumes row indexes submitted to the backend are 1-based sheet row numbers.

## Local Mock Fetch

File: `lib/mock-fetch.ts`

Installed by importing `@/lib/mock-fetch` in `components/providers.tsx`.

Behavior:

- Runs only in the browser.
- Saves mock sheet state in `localStorage.mockSheets_data`.
- Intercepts calls when:
  - URL includes `script.google.com`
  - URL includes `script.googleusercontent.com`
  - `NEXT_PUBLIC_API_URI` is missing
- Returns mock sheet data for `GET`/`getAll`.
- Implements sparse row merge for `action=update`.
- Implements `append`, `batchInsert`, `updateCell`, `insertIndent`, and `uploadFile`.
- Contains workflow routing logic for `INDENT-LIFT`.

Useful local reset:

```js
localStorage.removeItem("mockSheets_data")
```

Then reload the app to rebuild defaults.

## Upload API

File: `app/api/upload/route.ts`

This endpoint writes uploaded files to:

```text
public/purchase-images
```

It returns:

```json
{ "success": true, "url": "/purchase-images/<filename>" }
```

Most production-like stage uploads appear to use Apps Script `uploadFile` instead, so `/api/upload` is a local filesystem alternative.

## Cron Report API

File: `app/api/cron/generate-report/route.ts`

Route:

```text
GET /api/cron/generate-report
```

Vercel schedule:

```text
30 1 * * *
```

Security:

- If `CRON_SECRET` is set, the request must include `Authorization: Bearer <CRON_SECRET>`.
- If `CRON_SECRET` is not set, the endpoint is callable without auth.

Data fetched:

- `INDENT-LIFT`
- `RECEIVING-ACCOUNTS`
- `Master`
- `Transport Flw-Up`

Report scope:

- Indent Approval
- Make PO
- Follow-Up Vendor
- Transporter Follow-Up

Output:

- Renders `components/report-pdf.tsx` with `@react-pdf/renderer`.
- Converts PDF to base64.
- Sends `action=uploadReport` to Apps Script.

## Public Vendor Quotation

Route:

```text
/quotation-form?id=<indentNo>_<rowIndex>&v=<vendorSlot>
```

The form trusts `rowIndex` from the URL, fetches `INDENT-LIFT`, and updates the vendor block for slot 1, 2, or 3. Because this route is public, backend-side validation in Apps Script is important.
