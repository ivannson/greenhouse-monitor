# Greenhouse Dashboard

Mobile-first, gardener-friendly view of the ThingSpeak data written by the ESP32-C3 firmware in this repo. Vite + React + TypeScript SPA with a single Vercel serverless function that hides the ThingSpeak Read API Key.

## Features

- **Detail view** — current readings (temperature, humidity, pressure) with configurable status badges, plus a line chart per metric. Presets: **24h / 7 days / 30 days**, or a custom from/to date range via the native OS date picker. Default is 7 days.
- **Overview view** — one dot per day with an error-bar showing the robust daily min/max (single-sample spikes excluded via a MAD rule). Default range: since data collection began (2026-04-01) → today.
- **Readings before 2026-04-01 MSK are always hidden.** Earlier timestamps were bench-testing data.
- All timestamps render in **Europe/Moscow (MSK)**.
- **EN / RU language toggle** in the header, persisted in `localStorage`.
- Alert thresholds (too hot / too cold / too dry / too humid / high or low pressure) are **user-configurable** in a settings drawer and persisted in `localStorage`.

## Local development

```bash
cd dashboard
npm install
cp .env.example .env.local    # add THINGSPEAK_CHANNEL_ID and THINGSPEAK_READ_KEY
npm run dev                    # Vite on http://localhost:5173
```

Two ways to serve `/api/feeds` locally:

1. **Recommended — use `vercel dev`** so the serverless function runs exactly as in production:
   ```bash
   npm i -g vercel
   vercel link           # one-time, pick this project on your Vercel account
   vercel dev            # serves both the Vite bundle and /api on :3000
   ```
   Then open `http://localhost:3000`.
2. **Alternative — point Vite at a deployed preview.** Set `VITE_API_BASE=https://<your-preview>.vercel.app` in `.env.local` and run `npm run dev`. The Vite dev server will proxy `/api/*` to that URL.

## Type-check & build

```bash
npm run typecheck
npm run build       # outputs dist/
npm run preview     # serves the production bundle locally
```

## Deploying to Vercel

1. In Vercel create a new project and set **Root Directory = `dashboard`**.
2. Framework preset: **Vite**. Build command: `npm run build`. Output directory: `dist`.
3. Add the two environment variables to Production **and** Preview:
   - `THINGSPEAK_CHANNEL_ID` — the numeric channel ID that the firmware writes to
   - `THINGSPEAK_READ_KEY` — a read API key for that channel (Channel Settings → API Keys → Read API Keys)
4. Deploy. The dashboard is at the root URL; data fetches go through `/api/feeds`, never straight to ThingSpeak.

## How the field mapping works

The firmware at `src/main.cpp` publishes four fields every 10 minutes:

| ThingSpeak | Meaning |
|------------|---------|
| `field1` | AHT20 temperature (°C) |
| `field2` | BMP280 temperature (°C) |
| `field3` | Relative humidity (%) |
| `field4` | Pressure (hPa) |

The server function averages `field1` and `field2` into a single `temp` value before sending it to the browser. If you add or rename sensor fields in the firmware, update [api/feeds.ts](api/feeds.ts) and [src/lib/thingspeak.ts](src/lib/thingspeak.ts).

## Daily aggregation (Overview)

For each local day (Europe/Moscow):

1. Collect readings for that day.
2. Compute the median and median absolute deviation (MAD).
3. Drop any reading outside `median ± 3 · 1.4826 · MAD`. That rejects single-sample spikes — e.g. a spurious 7°C reading on a day that averaged 27°C stays out of the bar.
4. Plot a dot at the remaining mean, with an error bar from the remaining min to max.
5. Days with fewer than 6 kept samples (~1 hour of data) are omitted so partial days don't distort the range.

The firmware's 10-minute cadence (`DEEP_SLEEP_SECONDS = 600` in `src/main.cpp`) informs the ≥6-sample threshold. If you change the cadence, revisit [src/lib/aggregate.ts](src/lib/aggregate.ts).
