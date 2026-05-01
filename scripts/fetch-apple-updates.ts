import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { XMLParser } from 'fast-xml-parser';
import { dataSources } from '../src/types/apple-updates';
import { normalizeGdmfUpdates, normalizeRssTimeline } from '../src/lib/apple-update-normalizer';
import type { DataSourceStatus, GeneratedAppleData, GeneratedTimelineData } from '../src/types/apple-updates';

const urls = {
  appleGdmf: 'https://gdmf.apple.com/v2/pmv',
  sofaMacos: 'https://sofa.macadmins.io/v1/macos_data_feed.json',
  sofaIos: 'https://sofa.macadmins.io/v1/ios_data_feed.json',
  appleDeveloperRss: 'https://developer.apple.com/news/releases/rss/releases.rss'
} as const;

const rootDir = dirname(fileURLToPath(new URL('../package.json', import.meta.url)));
const generatedDir = join(rootDir, 'src/data/generated');
const fetchedAt = new Date().toISOString();
const parser = new XMLParser({ ignoreAttributes: false });
const requestTimeoutMs = 10_000;
const maxAttempts = 2;

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetchResponse(url, 'application/json');
  return response.json();
}

async function fetchText(url: string): Promise<string> {
  const response = await fetchResponse(url, 'application/rss+xml, application/xml, text/xml');
  return response.text();
}

async function fetchResponse(url: string, accept: string): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { accept },
        signal: AbortSignal.timeout(requestTimeoutMs)
      });

      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }

      return response;
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(`${url}: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
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
    const gdmf = await fetchJson(urls.appleGdmf);
    return { updates: normalizeGdmfUpdates(gdmf, fetchedAt), status: ok(dataSources.appleGdmf) };
  } catch (error) {
    return { updates: [], status: failed(dataSources.appleGdmf, error) };
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
    const rssText = await fetchText(urls.appleDeveloperRss);
    return { timeline: normalizeRssTimeline(parser.parse(rssText)), status: ok(dataSources.appleDeveloperRss) };
  } catch (error) {
    return { timeline: [], status: failed(dataSources.appleDeveloperRss, error) };
  }
}

async function main(): Promise<void> {
  await mkdir(generatedDir, { recursive: true });

  const [gdmf, sofaMacosStatus, sofaIosStatus, developerTimeline] = await Promise.all([
    fetchGdmf(),
    fetchSofaStatus(dataSources.sofaMacos, urls.sofaMacos),
    fetchSofaStatus(dataSources.sofaIos, urls.sofaIos),
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
