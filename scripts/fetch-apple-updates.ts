import { execFile as execFileCallback } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { XMLParser } from 'fast-xml-parser';
import { dataSources } from '../src/types/apple-updates';
import { normalizeGdmfUpdates, normalizeRssTimeline, normalizeSofaUpdates, mergeUpdates } from '../src/lib/apple-update-normalizer';
import type { DataSourceStatus, GeneratedAppleData, GeneratedTimelineData } from '../src/types/apple-updates';

const urls = {
  appleGdmf: process.env.APPLE_GDMF_URL ?? 'https://gdmf.apple.com/v2/pmv',
  sofaMacos: process.env.SOFA_MACOS_URL ?? 'https://sofafeed.macadmins.io/v1/macos_data_feed.json',
  sofaIos: process.env.SOFA_IOS_URL ?? 'https://sofafeed.macadmins.io/v1/ios_data_feed.json',
  appleDeveloperRss: process.env.APPLE_DEVELOPER_RSS_URL ?? 'https://developer.apple.com/news/releases/rss/releases.rss'
} as const;

const rootDir = dirname(fileURLToPath(new URL('../package.json', import.meta.url)));
const generatedDir = join(rootDir, 'src/data/generated');
const fetchedAt = new Date().toISOString();
const parser = new XMLParser({ ignoreAttributes: false });
const requestTimeoutMs = 10_000;
const maxAttempts = 2;
const execFile = promisify(execFileCallback);

async function fetchJson(url: string): Promise<unknown> {
  return JSON.parse(await fetchBody(url, 'application/json'));
}

async function fetchText(url: string): Promise<string> {
  return fetchBody(url, 'application/rss+xml, application/xml, text/xml');
}

async function fetchBody(url: string, accept: string): Promise<string> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await fetchBodyWithNode(url, accept);
    } catch (error) {
      lastError = error;
    }
  }

  try {
    return await fetchBodyWithCurl(url, accept);
  } catch (curlError) {
    throw new Error(`${url}: ${describeError(lastError)}; curl fallback failed: ${describeError(curlError)}`);
  }
}

async function fetchBodyWithNode(url: string, accept: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      accept,
      'User-Agent': 'iapple-update-fetcher/1.0 (+https://github.com/iapple/iapple)'
    },
    signal: AbortSignal.timeout(requestTimeoutMs)
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  return response.text();
}

async function fetchBodyWithCurl(url: string, accept: string): Promise<string> {
  const { stdout } = await execFile(
    'curl',
    [
      '--fail',
      '--silent',
      '--show-error',
      '--location',
      '--max-time',
      String(Math.ceil(requestTimeoutMs / 1000)),
      '--header',
      `Accept: ${accept}`,
      '--header',
      'User-Agent: iapple-update-fetcher/1.0 (+https://github.com/iapple/iapple)',
      url
    ],
    { maxBuffer: 5 * 1024 * 1024 }
  );

  return stdout;
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

function describeError(error: unknown): string {
  if (!(error instanceof Error)) {
    return String(error);
  }

  const cause = (error as Error & { cause?: unknown }).cause;
  const causeMessage = describeCause(cause);
  const stderr = (error as Error & { stderr?: unknown }).stderr;
  const stderrMessage = typeof stderr === 'string' ? stderr.trim() : '';

  if (stderrMessage && error.message.startsWith('Command failed:')) {
    return stderrMessage;
  }

  const message = causeMessage && causeMessage !== error.message ? `${error.message}: ${causeMessage}` : error.message;
  return stderrMessage ? `${message}: ${stderrMessage}` : message;
}

function describeCause(cause: unknown): string | null {
  if (cause instanceof Error) {
    const code = (cause as Error & { code?: unknown }).code;
    return typeof code === 'string' ? `${cause.message} (${code})` : cause.message;
  }

  if (typeof cause === 'string') {
    return cause;
  }

  return cause ? String(cause) : null;
}

function ok(name: DataSourceStatus['name']): DataSourceStatus {
  return { name, status: 'ok', fetchedAt, message: null };
}

function failed(name: DataSourceStatus['name'], error: unknown): DataSourceStatus {
  return {
    name,
    status: 'failed',
    fetchedAt,
    message: describeError(error)
  };
}

async function fetchGdmf(): Promise<{ updates: GeneratedAppleData['updates']; status: DataSourceStatus }> {
  try {
    const gdmf = await fetchJson(urls.appleGdmf);
    return { updates: normalizeGdmfUpdates(gdmf, fetchedAt), status: ok(dataSources.appleGdmf) };
  } catch (error) {
    return { updates: [], status: failed(dataSources.appleGdmf, error) };
  }
}

async function fetchSofaData(name: Extract<DataSourceStatus['name'], 'SOFA macOS' | 'SOFA iOS'>, url: string): Promise<{ data: unknown | null; status: DataSourceStatus }> {
  try {
    const data = await fetchJson(url);
    return { data, status: ok(name) };
  } catch (error) {
    return { data: null, status: failed(name, error) };
  }
}

async function fetchDeveloperTimeline(): Promise<{ timeline: GeneratedTimelineData['items']; status: DataSourceStatus }> {
  try {
    const rssText = await fetchText(urls.appleDeveloperRss);
    return { timeline: normalizeRssTimeline(parser.parse(rssText)), status: ok(dataSources.appleDeveloperRss) };
  } catch (error) {
    return { timeline: [], status: failed(dataSources.appleDeveloperRss, error) };
  }
}

async function main(): Promise<void> {
  await mkdir(generatedDir, { recursive: true });

  console.log(`Starting update check at: ${fetchedAt}`);

  console.log('Fetching all data sources in parallel...');
  const [gdmf, sofaMacos, sofaIos, developerTimeline] = await Promise.all([
    fetchGdmf(),
    fetchSofaData(dataSources.sofaMacos, urls.sofaMacos),
    fetchSofaData(dataSources.sofaIos, urls.sofaIos),
    fetchDeveloperTimeline()
  ]);

  console.log(`GDMF fetch status: ${gdmf.status.status} (${gdmf.updates.length} updates found)`);
  console.log(`SOFA macOS fetch status: ${sofaMacos.status.status}`);
  console.log(`SOFA iOS fetch status: ${sofaIos.status.status}`);
  console.log(`Apple Developer RSS fetch status: ${developerTimeline.status.status} (${developerTimeline.timeline.length} timeline items found)`);

  const sofaUpdates = normalizeSofaUpdates(sofaMacos.data, sofaIos.data, fetchedAt);
  console.log(`Normalized ${sofaUpdates.length} updates from SOFA feeds.`);

  const updates = mergeUpdates(gdmf.updates, sofaUpdates);
  console.log(`Merged updates: ${updates.length} total active versions tracked.`);

  const statuses = [gdmf.status, sofaMacos.status, sofaIos.status, developerTimeline.status];

  if (updates.length === 0 && developerTimeline.timeline.length === 0) {
    await writeJson(join(generatedDir, 'data-source-status.json'), statuses);
    throw new Error('All Apple update data sources failed or returned no usable data.');
  }

  await writeJson(join(generatedDir, 'apple-updates.json'), { generatedAt: fetchedAt, updates });
  await writeJson(join(generatedDir, 'release-timeline.json'), { generatedAt: fetchedAt, items: developerTimeline.timeline });
  await writeJson(join(generatedDir, 'data-source-status.json'), statuses);

  console.log('Successfully wrote data files to src/data/generated/');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
