# GrowEasy CSV Importer

AI-powered lead importer that converts **any** CSV format into GrowEasy CRM records.

Upload a CSV from Facebook Lead Ads, Google Ads, real-estate CRMs, manual spreadsheets — any structure — and the AI automatically maps your columns to the GrowEasy CRM schema.

---

## Features

- **Format-agnostic**: Works with any column naming convention, any delimiter, any layout
- **AI field mapping**: Claude infers intent from headers and values, not hardcoded column names
- **Streaming progress**: Real-time batch progress via Server-Sent Events
- **Batch processing**: Large files processed in parallel batches with per-batch retry
- **Drag & drop upload**: Accessible upload zone with file picker fallback
- **Sticky-header preview table**: See raw data before AI processing runs
- **Results with skip details**: Full import summary + expandable skipped-rows panel
- **Dark mode**: Respects system preference

---

## Project Structure

```
groweasy-csv-importer/
├── backend/                   # Express + TypeScript API
│   └── src/
│       ├── config/            # Constants (batch size, concurrency, retries)
│       ├── middleware/        # Multer upload, error handler
│       ├── routes/            # POST /upload, GET /:jobId/stream
│       ├── services/          # CSV parsing, AI extraction, prompt builder, job store
│       ├── types/             # CRM domain types + enums
│       └── server.ts
├── frontend/                  # Next.js 14 + Tailwind
│   ├── app/                   # App router: layout, page, global CSS
│   ├── components/            # UI: UploadZone, DataTable, ProgressBar, ResultsTable …
│   ├── lib/                   # API client, CSV preview parser
│   └── types/                 # Shared TypeScript types
├── sample-csvs/               # Test files (Facebook, Google Ads, real-estate)
├── docker-compose.yml
└── README.md
```

---

## Quick Start (Local)

### Prerequisites

- Node.js 18+
- An Anthropic API key ([get one here](https://aistudio.google.com/))

### 1. Clone & configure

```bash
git clone <your-repo-url>
cd groweasy-csv-importer
```

**Backend:**

```bash
cd backend
cp .env.example .env
# Edit .env and set GEMINI_API_KEY=AIza...
```

**Frontend:**

```bash
cd ../frontend
cp .env.example .env.local
# NEXT_PUBLIC_API_URL=http://localhost:4000 is already set
```

### 2. Install & run

**Backend** (in `/backend`):

```bash
npm install
npm run dev
# Listening on http://localhost:4000
```

**Frontend** (in `/frontend`):

```bash
npm install
npm run dev
# Open http://localhost:3000
```

---

## Docker Compose

Run both services with a single command:

```bash
GEMINI_API_KEY=AIza... docker compose up --build
```

- Frontend: http://localhost:3000
- Backend: http://localhost:4000

---

## API Reference

### `POST /api/import/upload`

Upload a CSV file. Parses it immediately (no AI calls), creates a processing job.

**Request:** `multipart/form-data`, field `file` (.csv)

**Response:**
```json
{
  "jobId": "uuid",
  "totalRows": 42,
  "totalBatches": 2,
  "batchSize": 25
}
```

---

### `GET /api/import/:jobId/stream`

Stream AI extraction progress as Server-Sent Events.

**Events emitted:**

```
event: progress
data: {"batchesDone": 1, "batchesTotal": 2}

event: result
data: { "records": [...], "skipped": [...], "totalImported": 40, "totalSkipped": 2, "totalRows": 42 }

event: error
data: {"error": "..."}
```

## Configuration

All tuning lives in `backend/src/config/constants.ts` and can be overridden via environment variables:

| Variable | Default | Description |
|---|---|---|
| `GEMINI_API_KEY` | — | **Required** |
| `ANTHROPIC_MODEL` | `gemini-1.5-flash` | Model to use |
| `AI_BATCH_SIZE` | `25` | Rows per AI call |
| `AI_MAX_CONCURRENCY` | `3` | Parallel batch calls |
| `AI_MAX_RETRIES` | `3` | Retries per failed batch |
| `PORT` | `4000` | Backend port |
| `CORS_ORIGIN` | `*` | Allowed frontend origin |

---

## Deployment

### Vercel (frontend) + Railway (backend)

**Backend (Railway):**
1. Connect your repo, select `/backend` as the root
2. Set `GEMINI_API_KEY` and `CORS_ORIGIN=https://your-frontend.vercel.app` in Railway env vars
3. Railway auto-detects `npm run build` + `npm start`

**Frontend (Vercel):**
1. Connect your repo, select `/frontend` as the root
2. Set `NEXT_PUBLIC_API_URL=https://your-backend.railway.app`
3. Deploy — Vercel auto-detects Next.js

---

## Sample CSVs

Test files are in `sample-csvs/`:

| File | Simulates |
|---|---|
| `facebook-leads.csv` | Facebook Lead Ads export |
| `google-ads-leads.csv` | Google Ads lead form export |
| `real-estate-crm.csv` | Real-estate CRM with split name/phone/email columns |

---

