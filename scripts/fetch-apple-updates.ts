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

async function fetchGdmf(): Promise<{ updates: GeneratedAppleData['updates']; status: DataSourceStatus }> {
  try {
    const gdmf = await fetchJson('https://gdmf.apple.com/v2/pmv');
    return { updates: normalizeGdmfUpdates(gdmf, fetchedAt), status: ok('Apple GDMF') };
  } catch (error) {
    return { updates: [], status: failed('Apple GDMF', error) };
  }
}

async function fetchSofaStatus(name: Extract<DataSourceStatus['name'], 'SOFA macOS' | 'SOFA iOS'>, url: string): Promise<DataSourceStatus> {
  try {
    await fetchJson(url);
    return ok(name);
  } catch (error) {
    return failed(name, error);
  }
}

async function fetchDeveloperTimeline(): Promise<{ timeline: GeneratedTimelineData['items']; status: DataSourceStatus }> {
  try {
    const rssText = await fetchText('https://developer.apple.com/news/releases/rss/releases.rss');
    return { timeline: normalizeRssTimeline(parser.parse(rssText)), status: ok('Apple Developer RSS') };
  } catch (error) {
    return { timeline: [], status: failed('Apple Developer RSS', error) };
  }
}

async function main(): Promise<void> {
  await mkdir(generatedDir, { recursive: true });

  const [gdmf, sofaMacosStatus, sofaIosStatus, developerTimeline] = await Promise.all([
    fetchGdmf(),
    fetchSofaStatus('SOFA macOS', 'https://sofa.macadmins.io/v1/macos_data_feed.json'),
    fetchSofaStatus('SOFA iOS', 'https://sofa.macadmins.io/v1/ios_data_feed.json'),
    fetchDeveloperTimeline()
  ]);
  const statuses = [gdmf.status, sofaMacosStatus, sofaIosStatus, developerTimeline.status];

  if (gdmf.updates.length === 0 && developerTimeline.timeline.length === 0) {
    await writeJson(join(generatedDir, 'data-source-status.json'), statuses);
    throw new Error('All Apple update data sources failed or returned no usable data.');
  }

  await writeJson(join(generatedDir, 'apple-updates.json'), { generatedAt: fetchedAt, updates: gdmf.updates });
  await writeJson(join(generatedDir, 'release-timeline.json'), { generatedAt: fetchedAt, items: developerTimeline.timeline });
  await writeJson(join(generatedDir, 'data-source-status.json'), statuses);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
