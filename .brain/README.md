# NewPurchaseFMS Project Brain

This folder is a compact project memory for the Purchase FMS codebase. It captures the architecture, data contracts, workflows, integrations, and current maintenance risks discovered from the repository.

Start here:

- [project-overview.md](project-overview.md) - what this app is and how it is used.
- [architecture.md](architecture.md) - runtime structure, routing, providers, and UI layers.
- [data-model.md](data-model.md) - Google Sheet backing store, important sheets, and key column indexes.
- [workflow-stages.md](workflow-stages.md) - stage-by-stage behavior and gating rules.
- [apis-and-integrations.md](apis-and-integrations.md) - Next API routes, Apps Script API expectations, local mock layer, and cron reporting.
- [code-map.md](code-map.md) - important files and ownership map.
- [maintenance-notes.md](maintenance-notes.md) - risks, inconsistencies, and recommended future cleanup.

Current stack:

- Next.js App Router with React 19 and TypeScript.
- Tailwind CSS v4 plus shadcn-style Radix UI components.
- Google Sheets/Google Apps Script as the operational database.
- Local browser mock database through `lib/mock-fetch.ts` when `NEXT_PUBLIC_API_URI` is missing or points to Google Script URLs.
- Vercel deployment with a scheduled report cron.

Important environment variables:

- `NEXT_PUBLIC_API_URI`: Google Apps Script endpoint used by almost every stage.
- `NEXT_PUBLIC_IMAGE_FOLDER_ID`: optional Google Drive folder for report/file uploads through Apps Script.
- `CRON_SECRET`: optional bearer token protecting `/api/cron/generate-report`.

Developer commands:

```bash
npm run dev
npm run build
npm run lint
npm run start
```

Build caveat: `next.config.mjs` currently has `typescript.ignoreBuildErrors = true`, so production builds can pass with TypeScript errors. Do not treat a successful build as full type verification.
