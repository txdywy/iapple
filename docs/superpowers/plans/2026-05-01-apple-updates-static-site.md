# Apple Updates Static Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a GitHub Pages-hosted Astro static site that displays Apple software update data refreshed by GitHub Actions.

**Architecture:** A TypeScript fetch script retrieves Apple-related update feeds, normalizes them into generated JSON files, and Astro renders the dashboard from those local files at build time. GitHub Actions runs the fetch/build/deploy flow on a six-hour schedule and publishes the `dist` artifact to GitHub Pages.

**Tech Stack:** Astro, TypeScript, Tailwind CSS, Vitest, Node 22, GitHub Actions, GitHub Pages.

---

## File Structure

Create these files:

- `package.json` — npm scripts and dependencies.
- `tsconfig.json` — TypeScript config for scripts and source files.
- `astro.config.mjs` — Astro config using static output.
- `tailwind.config.mjs` — Tailwind content paths.
- `postcss.config.mjs` — Tailwind/PostCSS wiring.
- `src/styles/global.css` — Tailwind directives and global visual polish.
- `src/types/apple-updates.ts` — shared normalized data types.
- `src/lib/apple-update-normalizer.ts` — pure functions that normalize fetched feeds.
- `src/lib/apple-update-normalizer.test.ts` — Vitest coverage for normalization behavior.
- `scripts/fetch-apple-updates.ts` — network script that writes generated JSON files.
- `src/data/generated/apple-updates.json` — generated placeholder data for local build before first fetch.
- `src/data/generated/release-timeline.json` — generated placeholder timeline data.
- `src/data/generated/data-source-status.json` — generated placeholder source status data.
- `src/pages/index.astro` — dashboard page.
- `.github/workflows/update-data-and-deploy.yml` — scheduled fetch/build/deploy workflow.
- `.gitignore` — ignore dependencies, build output, and Firecrawl cache.

Modify these files if present:

- No existing application files are present in the current empty repository.

---

### Task 1: Initialize Astro project skeleton

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `astro.config.mjs`
- Create: `tailwind.config.mjs`
- Create: `postcss.config.mjs`
- Create: `src/styles/global.css`
- Create: `.gitignore`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "iapple",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "astro dev",
    "build": "astro check && astro build",
    "preview": "astro preview",
    "fetch:data": "tsx scripts/fetch-apple-updates.ts",
    "test": "vitest run"
  },
  "dependencies": {
    "@astrojs/check": "latest",
    "@astrojs/tailwind": "latest",
    "astro": "latest",
    "fast-xml-parser": "latest",
    "tailwindcss": "latest",
    "typescript": "latest"
  },
  "devDependencies": {
    "@types/node": "latest",
    "tsx": "latest",
    "vitest": "latest"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "extends": "astro/tsconfigs/strict",
  "compilerOptions": {
    "types": ["node", "vitest/globals"],
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true
  },
  "include": [".astro/types.d.ts", "src/**/*", "scripts/**/*"]
}
```

- [ ] **Step 3: Create `astro.config.mjs`**

```js
import tailwind from '@astrojs/tailwind';
import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',
  integrations: [tailwind()]
});
```

- [ ] **Step 4: Create `tailwind.config.mjs`**

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
};
```

- [ ] **Step 5: Create `postcss.config.mjs`**

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {}
  }
};
```

- [ ] **Step 6: Create `src/styles/global.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  color-scheme: light;
  font-family: Inter, ui-sans-serif, system-ui, sans-serif;
  background: #f5f5f7;
  color: #1d1d1f;
}

body {
  margin: 0;
  min-height: 100vh;
}
```

- [ ] **Step 7: Create `.gitignore`**

```gitignore
node_modules/
dist/
.astro/
.firecrawl/
.DS_Store
.env
.env.*
```

- [ ] **Step 8: Install dependencies**

Run: `npm install`

Expected: dependencies install successfully and `package-lock.json` is created.

- [ ] **Step 9: Run initial validation**

Run: `npm run build`

Expected: build fails because `src/pages/index.astro` does not exist yet. This is acceptable at this step and confirms the toolchain is installed.

- [ ] **Step 10: Commit**

Only commit if the user has explicitly authorized commits in this session.

```bash
git add package.json package-lock.json tsconfig.json astro.config.mjs tailwind.config.mjs postcss.config.mjs src/styles/global.css .gitignore
git commit -m "chore: initialize Astro static site"
```

---

### Task 2: Add normalized data model and tests

**Files:**
- Create: `src/types/apple-updates.ts`
- Create: `src/lib/apple-update-normalizer.ts`
- Create: `src/lib/apple-update-normalizer.test.ts`

- [ ] **Step 1: Create `src/types/apple-updates.ts`**

```ts
export type ApplePlatform = 'iOS' | 'iPadOS' | 'macOS' | 'watchOS' | 'tvOS' | 'visionOS';

export interface AppleUpdate {
  platform: ApplePlatform;
  version: string;
  build: string | null;
  source: 'Apple GDMF' | 'SOFA' | 'Manual fallback';
  fetchedAt: string;
}

export interface ReleaseTimelineItem {
  title: string;
  url: string | null;
  publishedAt: string | null;
  source: 'Apple Developer RSS';
}

export interface DataSourceStatus {
  name: 'Apple GDMF' | 'SOFA macOS' | 'SOFA iOS' | 'Apple Developer RSS';
  status: 'ok' | 'failed';
  fetchedAt: string;
  message: string | null;
}

export interface GeneratedAppleData {
  generatedAt: string;
  updates: AppleUpdate[];
}

export interface GeneratedTimelineData {
  generatedAt: string;
  items: ReleaseTimelineItem[];
}
```

- [ ] **Step 2: Create failing tests in `src/lib/apple-update-normalizer.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { normalizeGdmfUpdates, normalizeRssTimeline } from './apple-update-normalizer';

const fetchedAt = '2026-05-01T00:00:00.000Z';

describe('normalizeGdmfUpdates', () => {
  it('extracts known Apple OS updates from PublicAssetSets', () => {
    const data = {
      PublicAssetSets: {
        iOS: [{ ProductVersion: '18.5', Build: '22F76' }],
        iPadOS: [{ ProductVersion: '18.5', Build: '22F76' }],
        macOS: [{ ProductVersion: '15.5', Build: '24F74' }],
        watchOS: [{ ProductVersion: '11.5', Build: '22T556' }],
        tvOS: [{ ProductVersion: '18.5', Build: '22L556' }],
        visionOS: [{ ProductVersion: '2.5', Build: '22O473' }]
      }
    };

    expect(normalizeGdmfUpdates(data, fetchedAt)).toEqual([
      { platform: 'iOS', version: '18.5', build: '22F76', source: 'Apple GDMF', fetchedAt },
      { platform: 'iPadOS', version: '18.5', build: '22F76', source: 'Apple GDMF', fetchedAt },
      { platform: 'macOS', version: '15.5', build: '24F74', source: 'Apple GDMF', fetchedAt },
      { platform: 'watchOS', version: '11.5', build: '22T556', source: 'Apple GDMF', fetchedAt },
      { platform: 'tvOS', version: '18.5', build: '22L556', source: 'Apple GDMF', fetchedAt },
      { platform: 'visionOS', version: '2.5', build: '22O473', source: 'Apple GDMF', fetchedAt }
    ]);
  });

  it('ignores malformed platform entries', () => {
    const data = {
      PublicAssetSets: {
        iOS: [{ ProductVersion: '', Build: '22F76' }],
        macOS: [{ ProductVersion: '15.5' }]
      }
    };

    expect(normalizeGdmfUpdates(data, fetchedAt)).toEqual([
      { platform: 'macOS', version: '15.5', build: null, source: 'Apple GDMF', fetchedAt }
    ]);
  });
});

describe('normalizeRssTimeline', () => {
  it('normalizes RSS items into timeline entries', () => {
    const rss = {
      rss: {
        channel: {
          item: [
            {
              title: 'iOS 18.5 beta released',
              link: 'https://developer.apple.com/news/releases/',
              pubDate: 'Fri, 01 May 2026 10:00:00 GMT'
            }
          ]
        }
      }
    };

    expect(normalizeRssTimeline(rss)).toEqual([
      {
        title: 'iOS 18.5 beta released',
        url: 'https://developer.apple.com/news/releases/',
        publishedAt: '2026-05-01T10:00:00.000Z',
        source: 'Apple Developer RSS'
      }
    ]);
  });
});
```

- [ ] **Step 3: Run tests to verify failure**

Run: `npm test -- src/lib/apple-update-normalizer.test.ts`

Expected: FAIL because `src/lib/apple-update-normalizer.ts` does not exist.

- [ ] **Step 4: Create `src/lib/apple-update-normalizer.ts`**

```ts
import type { ApplePlatform, AppleUpdate, ReleaseTimelineItem } from '../types/apple-updates';

const platforms: ApplePlatform[] = ['iOS', 'iPadOS', 'macOS', 'watchOS', 'tvOS', 'visionOS'];

interface GdmfAsset {
  ProductVersion?: unknown;
  Build?: unknown;
}

interface GdmfData {
  PublicAssetSets?: Partial<Record<ApplePlatform, GdmfAsset[]>>;
}

export function normalizeGdmfUpdates(data: unknown, fetchedAt: string): AppleUpdate[] {
  const gdmfData = data as GdmfData;
  const publicAssetSets = gdmfData.PublicAssetSets ?? {};

  return platforms.flatMap((platform) => {
    const assets = publicAssetSets[platform] ?? [];
    const latest = assets.find((asset) => typeof asset.ProductVersion === 'string' && asset.ProductVersion.length > 0);

    if (!latest || typeof latest.ProductVersion !== 'string') {
      return [];
    }

    return [
      {
        platform,
        version: latest.ProductVersion,
        build: typeof latest.Build === 'string' && latest.Build.length > 0 ? latest.Build : null,
        source: 'Apple GDMF',
        fetchedAt
      }
    ];
  });
}

interface RssItem {
  title?: unknown;
  link?: unknown;
  pubDate?: unknown;
}

interface RssData {
  rss?: {
    channel?: {
      item?: RssItem | RssItem[];
    };
  };
}

export function normalizeRssTimeline(data: unknown): ReleaseTimelineItem[] {
  const rssData = data as RssData;
  const rawItems = rssData.rss?.channel?.item ?? [];
  const items = Array.isArray(rawItems) ? rawItems : [rawItems];

  return items
    .filter((item) => typeof item.title === 'string' && item.title.length > 0)
    .slice(0, 12)
    .map((item) => ({
      title: item.title as string,
      url: typeof item.link === 'string' && item.link.length > 0 ? item.link : null,
      publishedAt: typeof item.pubDate === 'string' && item.pubDate.length > 0 ? new Date(item.pubDate).toISOString() : null,
      source: 'Apple Developer RSS'
    }));
}
```

- [ ] **Step 5: Run tests to verify pass**

Run: `npm test -- src/lib/apple-update-normalizer.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

Only commit if the user has explicitly authorized commits in this session.

```bash
git add src/types/apple-updates.ts src/lib/apple-update-normalizer.ts src/lib/apple-update-normalizer.test.ts
git commit -m "test: add Apple update normalization"
```

---

### Task 3: Add data fetch script and generated fallback data

**Files:**
- Create: `scripts/fetch-apple-updates.ts`
- Create: `src/data/generated/apple-updates.json`
- Create: `src/data/generated/release-timeline.json`
- Create: `src/data/generated/data-source-status.json`

- [ ] **Step 1: Create placeholder generated data files**

Create `src/data/generated/apple-updates.json`:

```json
{
  "generatedAt": "1970-01-01T00:00:00.000Z",
  "updates": []
}
```

Create `src/data/generated/release-timeline.json`:

```json
{
  "generatedAt": "1970-01-01T00:00:00.000Z",
  "items": []
}
```

Create `src/data/generated/data-source-status.json`:

```json
[
  {
    "name": "Apple GDMF",
    "status": "failed",
    "fetchedAt": "1970-01-01T00:00:00.000Z",
    "message": "Data has not been fetched yet."
  },
  {
    "name": "SOFA macOS",
    "status": "failed",
    "fetchedAt": "1970-01-01T00:00:00.000Z",
    "message": "Data has not been fetched yet."
  },
  {
    "name": "SOFA iOS",
    "status": "failed",
    "fetchedAt": "1970-01-01T00:00:00.000Z",
    "message": "Data has not been fetched yet."
  },
  {
    "name": "Apple Developer RSS",
    "status": "failed",
    "fetchedAt": "1970-01-01T00:00:00.000Z",
    "message": "Data has not been fetched yet."
  }
]
```

- [ ] **Step 2: Create `scripts/fetch-apple-updates.ts`**

```ts
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { XMLParser } from 'fast-xml-parser';
import { normalizeGdmfUpdates, normalizeRssTimeline } from '../src/lib/apple-update-normalizer';
import type { DataSourceStatus, GeneratedAppleData, GeneratedTimelineData } from '../src/types/apple-updates';

const rootDir = dirname(fileURLToPath(new URL('../package.json', import.meta.url)));
const generatedDir = join(rootDir, 'src/data/generated');
const fetchedAt = new Date().toISOString();
const parser = new XMLParser({ ignoreAttributes: false });

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, { headers: { accept: 'application/json' } });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, { headers: { accept: 'application/rss+xml, application/xml, text/xml' } });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  return response.text();
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

function ok(name: DataSourceStatus['name']): DataSourceStatus {
  return { name, status: 'ok', fetchedAt, message: null };
}

function failed(name: DataSourceStatus['name'], error: unknown): DataSourceStatus {
  return {
    name,
    status: 'failed',
    fetchedAt,
    message: error instanceof Error ? error.message : String(error)
  };
}

async function main(): Promise<void> {
  await mkdir(generatedDir, { recursive: true });

  const statuses: DataSourceStatus[] = [];
  let updates: GeneratedAppleData['updates'] = [];
  let timeline: GeneratedTimelineData['items'] = [];

  try {
    const gdmf = await fetchJson('https://gdmf.apple.com/v2/pmv');
    updates = normalizeGdmfUpdates(gdmf, fetchedAt);
    statuses.push(ok('Apple GDMF'));
  } catch (error) {
    statuses.push(failed('Apple GDMF', error));
  }

  for (const [name, url] of [
    ['SOFA macOS', 'https://sofa.macadmins.io/v1/macos_data_feed.json'],
    ['SOFA iOS', 'https://sofa.macadmins.io/v1/ios_data_feed.json']
  ] as const) {
    try {
      await fetchJson(url);
      statuses.push(ok(name));
    } catch (error) {
      statuses.push(failed(name, error));
    }
  }

  try {
    const rssText = await fetchText('https://developer.apple.com/news/releases/rss/releases.rss');
    timeline = normalizeRssTimeline(parser.parse(rssText));
    statuses.push(ok('Apple Developer RSS'));
  } catch (error) {
    statuses.push(failed('Apple Developer RSS', error));
  }

  if (updates.length === 0 && timeline.length === 0) {
    await writeJson(join(generatedDir, 'data-source-status.json'), statuses);
    throw new Error('All Apple update data sources failed or returned no usable data.');
  }

  await writeJson(join(generatedDir, 'apple-updates.json'), { generatedAt: fetchedAt, updates });
  await writeJson(join(generatedDir, 'release-timeline.json'), { generatedAt: fetchedAt, items: timeline });
  await writeJson(join(generatedDir, 'data-source-status.json'), statuses);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

- [ ] **Step 3: Run data fetch**

Run: `npm run fetch:data`

Expected: command succeeds and rewrites files in `src/data/generated/` with current timestamps and at least one update or timeline item.

- [ ] **Step 4: Run tests**

Run: `npm test`

Expected: PASS.

- [ ] **Step 5: Commit**

Only commit if the user has explicitly authorized commits in this session.

```bash
git add scripts/fetch-apple-updates.ts src/data/generated/apple-updates.json src/data/generated/release-timeline.json src/data/generated/data-source-status.json
git commit -m "feat: fetch Apple update data"
```

---

### Task 4: Build the Astro dashboard page

**Files:**
- Create: `src/pages/index.astro`

- [ ] **Step 1: Create `src/pages/index.astro`**

```astro
---
import '../styles/global.css';
import appleData from '../data/generated/apple-updates.json';
import timelineData from '../data/generated/release-timeline.json';
import sourceStatuses from '../data/generated/data-source-status.json';
import type { AppleUpdate, DataSourceStatus, ReleaseTimelineItem } from '../types/apple-updates';

const updates = appleData.updates as AppleUpdate[];
const timeline = timelineData.items as ReleaseTimelineItem[];
const statuses = sourceStatuses as DataSourceStatus[];
const generatedAt = new Intl.DateTimeFormat('en', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'UTC'
}).format(new Date(appleData.generatedAt));
---

<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content="A static dashboard for Apple software update releases." />
    <title>iApple Updates</title>
  </head>
  <body>
    <main class="mx-auto max-w-6xl px-6 py-10 sm:py-14">
      <section class="rounded-[2rem] bg-[#1d1d1f] px-8 py-10 text-white shadow-2xl shadow-slate-300/50 sm:px-12">
        <p class="text-sm font-medium uppercase tracking-[0.35em] text-slate-300">iApple Updates</p>
        <h1 class="mt-4 max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl">
          Apple software releases, refreshed automatically.
        </h1>
        <p class="mt-5 max-w-2xl text-lg leading-8 text-slate-300">
          A GitHub Pages-powered dashboard for iOS, iPadOS, macOS, watchOS, tvOS, and visionOS update data.
        </p>
        <p class="mt-8 text-sm text-slate-400">Last generated: {generatedAt} UTC</p>
      </section>

      <section class="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {updates.map((update) => (
          <article class="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p class="text-sm font-medium text-slate-500">{update.platform}</p>
            <h2 class="mt-3 text-4xl font-semibold tracking-tight text-slate-950">{update.version}</h2>
            <dl class="mt-6 space-y-3 text-sm text-slate-600">
              <div class="flex justify-between gap-4">
                <dt>Build</dt>
                <dd class="font-medium text-slate-950">{update.build ?? 'Unavailable'}</dd>
              </div>
              <div class="flex justify-between gap-4">
                <dt>Source</dt>
                <dd class="font-medium text-slate-950">{update.source}</dd>
              </div>
            </dl>
          </article>
        ))}
      </section>

      <section class="mt-10 grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
        <article class="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 class="text-xl font-semibold text-slate-950">Recent release timeline</h2>
          <div class="mt-6 space-y-5">
            {timeline.length === 0 ? (
              <p class="text-sm text-slate-500">No release timeline items were generated.</p>
            ) : (
              timeline.map((item) => (
                <div class="border-l-2 border-slate-200 pl-4">
                  <h3 class="font-medium text-slate-950">
                    {item.url ? <a class="hover:underline" href={item.url}>{item.title}</a> : item.title}
                  </h3>
                  <p class="mt-1 text-sm text-slate-500">
                    {item.publishedAt ? new Date(item.publishedAt).toUTCString() : 'Date unavailable'} · {item.source}
                  </p>
                </div>
              ))
            )}
          </div>
        </article>

        <article class="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 class="text-xl font-semibold text-slate-950">Data source status</h2>
          <div class="mt-6 space-y-4">
            {statuses.map((source) => (
              <div class="rounded-2xl bg-slate-50 p-4">
                <div class="flex items-center justify-between gap-4">
                  <h3 class="font-medium text-slate-950">{source.name}</h3>
                  <span class:list={[
                    'rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide',
                    source.status === 'ok' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                  ]}>
                    {source.status}
                  </span>
                </div>
                {source.message && <p class="mt-2 text-sm text-slate-500">{source.message}</p>}
              </div>
            ))}
          </div>
        </article>
      </section>
    </main>
  </body>
</html>
```

- [ ] **Step 2: Run build**

Run: `npm run build`

Expected: PASS and `dist/index.html` is created.

- [ ] **Step 3: Commit**

Only commit if the user has explicitly authorized commits in this session.

```bash
git add src/pages/index.astro
git commit -m "feat: add Apple updates dashboard"
```

---

### Task 5: Add GitHub Pages deployment workflow

**Files:**
- Create: `.github/workflows/update-data-and-deploy.yml`

- [ ] **Step 1: Create `.github/workflows/update-data-and-deploy.yml`**

```yaml
name: Update Apple Data and Deploy

on:
  schedule:
    - cron: "23 */6 * * *"
  workflow_dispatch:
  push:
    branches:
      - main

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v5

      - name: Setup Node
        uses: actions/setup-node@v5
        with:
          node-version: 22
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Fetch Apple update data
        run: npm run fetch:data

      - name: Build site
        run: npm run build

      - name: Configure Pages
        uses: actions/configure-pages@v5

      - name: Upload Pages artifact
        uses: actions/upload-pages-artifact@v4
        with:
          path: ./dist

  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}

    runs-on: ubuntu-latest
    needs: build

    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Validate workflow YAML parses**

Run: `ruby -e 'require "yaml"; YAML.load_file(".github/workflows/update-data-and-deploy.yml"); puts "ok"'`

Expected: `ok`.

- [ ] **Step 3: Run final local verification**

Run: `npm test && npm run fetch:data && npm run build`

Expected: all commands PASS.

- [ ] **Step 4: Commit**

Only commit if the user has explicitly authorized commits in this session.

```bash
git add .github/workflows/update-data-and-deploy.yml
git commit -m "ci: deploy Apple updates site to GitHub Pages"
```

---

### Task 6: Final verification and handoff

**Files:**
- Inspect all created files.

- [ ] **Step 1: Check working tree**

Run: `git status --short`

Expected: only intentional files are modified or untracked.

- [ ] **Step 2: Verify generated data shape**

Run: `node -e 'const data=require("./src/data/generated/apple-updates.json"); console.log(data.updates.map((u)=>u.platform).join(","))'`

Expected: output includes at least one of `iOS`, `iPadOS`, `macOS`, `watchOS`, `tvOS`, or `visionOS`.

- [ ] **Step 3: Verify local static output exists**

Run: `test -f dist/index.html && echo ok`

Expected: `ok`.

- [ ] **Step 4: Summarize deployment setup**

Tell the user:

```text
Implemented Astro static dashboard, scheduled GitHub Actions data refresh, and GitHub Pages deployment workflow. To publish, enable GitHub Pages with GitHub Actions as the source in repository settings, then push to main or run the workflow manually.
```

---

## Self-Review

Spec coverage:

- Astro + TypeScript + Tailwind stack: covered by Task 1.
- Normalized generated data files: covered by Tasks 2 and 3.
- GDMF, SOFA, RSS fetching: covered by Task 3.
- Local-only browser data access: covered by Task 4 imports from generated JSON.
- Scheduled GitHub Actions deployment: covered by Task 5.
- Error handling and source status: covered by Task 3 and surfaced in Task 4.
- Verification commands: covered by Tasks 2 through 6.

Placeholder scan:

- No TBD, TODO, placeholder, or unspecified implementation steps remain.

Type consistency:

- `AppleUpdate`, `ReleaseTimelineItem`, `DataSourceStatus`, `GeneratedAppleData`, and `GeneratedTimelineData` are defined in Task 2 and used consistently by Tasks 3 and 4.
