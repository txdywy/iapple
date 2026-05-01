# Apple Updates Static Site Design

## Goal

Build a pure static website that tracks Apple software update information for iOS, iPadOS, macOS, watchOS, tvOS, and visionOS. The site will be deployed to GitHub Pages and refreshed automatically by GitHub Actions on a schedule.

## Recommended Stack

- Astro for the static site framework.
- TypeScript for data-fetching and normalization scripts.
- Tailwind CSS for styling.
- GitHub Actions for scheduled data refresh and deployment.
- GitHub Pages for hosting.

Astro is preferred because the first version is primarily a data/content dashboard, not a heavy client-side application. It can output static files cleanly while still allowing interactive components later if needed.

## First-Version Scope

The first version will provide an Apple software update dashboard with:

- Latest version cards for:
  - iOS
  - iPadOS
  - macOS
  - watchOS
  - tvOS
  - visionOS
- Fields shown per platform:
  - Platform name
  - Latest version
  - Build number when available
  - Source label
  - Last fetched timestamp
- A recent release timeline from Apple Developer RSS when available.
- A visible data-source status section showing whether each source was fetched successfully.

The first version will not attempt to become a full firmware database, jailbreak signing tracker, or historical AppleDB clone.

## Data Sources

The site will fetch and normalize data from these sources:

1. Apple GDMF
   - URL: `https://gdmf.apple.com/v2/pmv`
   - Role: primary source for latest public OS versions, build numbers, and supported device information.

2. MacAdmins SOFA
   - URLs:
     - `https://sofa.macadmins.io/v1/macos_data_feed.json`
     - `https://sofa.macadmins.io/v1/ios_data_feed.json`
   - Role: monitored supplemental source for structured macOS/iOS update metadata and security/CVE context; v1 records source health but does not merge SOFA fields into update cards.

3. Apple Developer Releases RSS
   - URL: `https://developer.apple.com/news/releases/rss/releases.rss`
   - Role: recent release timeline, including beta, RC, and public release announcements when present.

ipsw.me and AppleDB are deferred until the site needs firmware download links, signing status, accessory firmware, or deeper historical coverage.

## Architecture

The repository will contain:

```text
scripts/fetch-apple-updates.ts
src/data/generated/apple-updates.json
src/data/generated/release-timeline.json
src/data/generated/data-source-status.json
src/pages/index.astro
.github/workflows/update-data-and-deploy.yml
```

The data flow will be:

```text
External Apple-related data sources
  -> scripts/fetch-apple-updates.ts
  -> normalized generated JSON files
  -> Astro pages render from generated JSON
  -> npm run build
  -> GitHub Pages artifact
  -> GitHub Pages deployment
```

The browser will read only local static assets generated during build. It will not call Apple, SOFA, ipsw.me, or AppleDB directly. This avoids CORS issues, reduces runtime dependency on third-party availability, and makes the deployed site fast and deterministic.

## GitHub Actions Automation

The workflow will run on:

- A scheduled cron every hour.
- Manual `workflow_dispatch`.
- Pushes to `main`.

The cron should avoid the top of the hour to reduce scheduling delays and still run hourly:

```yaml
cron: "23 * * * *"
```

The workflow will:

1. Check out the repository.
2. Install Node dependencies.
3. Run the data-fetching script.
4. Build the Astro site.
5. Upload the built `dist` directory as a GitHub Pages artifact.
6. Deploy through `actions/deploy-pages`.

Generated data will not be committed back to the repository in the first version. It will be included in the deployed Pages artifact, keeping repository history clean.

## Error Handling

The fetch script should treat each data source independently.

If one source fails:

- The script should still generate the site data from any sources that succeeded.
- `data-source-status.json` should record the failure.
- The page should show the failed source in the status section.

If all sources fail:

- The script should fail the build so GitHub Pages keeps serving the previous successful deployment.

The status file should include:

- Source name.
- Status: `ok` or `failed`.
- Last attempted fetch timestamp.
- Error message for failed sources.

## UI Direction

The site should feel like a clean Apple software status dashboard rather than a generic table dump.

The first page should prioritize:

- A prominent latest-update summary.
- Platform cards for each OS family.
- Freshness/status indicators.
- A compact recent-release timeline.

The visual design should be polished but simple enough to implement quickly.

## Verification

Before claiming the implementation is complete, verify:

- `npm run fetch:data` succeeds locally.
- `npm run build` succeeds locally.
- Generated JSON files contain entries for the expected OS families when the upstream data provides them.
- The page renders from generated local data only.
- The GitHub Actions workflow has valid Pages permissions:
  - `contents: read`
  - `pages: write`
  - `id-token: write`

## Deferred Work

Potential later additions:

- Firmware download links and signing status via ipsw.me.
- Historical release archive.
- Device-specific support lookup.
- Security-focused CVE pages.
- AirPods and accessory firmware tracking via AppleDB.
- Notifications through Slack, Telegram, or email.
