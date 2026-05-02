import { applePlatforms, dataSources, type ApplePlatform, type AppleUpdate, type ReleaseTimelineItem } from '../types/apple-updates';

interface GdmfAsset {
  ProductVersion?: unknown;
  Build?: unknown;
  PostingDate?: unknown;
  SupportedDevices?: unknown;
}

const devicePrefixesByPlatform: Record<ApplePlatform, string[]> = {
  iOS: ['iPhone', 'iPod'],
  iPadOS: ['iPad'],
  macOS: ['J', 'Mac-', 'VMM', 'VMA'],
  watchOS: ['Watch'],
  tvOS: ['AppleTV', 'AudioAccessory'],
  visionOS: ['RealityDevice']
};

export function normalizeGdmfUpdates(data: unknown, fetchedAt: string): AppleUpdate[] {
  const publicAssetSets = getPublicAssetSets(data);
  const assets = Object.values(publicAssetSets).flat();
  const latestByPlatform = new Map<ApplePlatform, GdmfAsset>();

  for (const asset of assets) {
    if (typeof asset.ProductVersion !== 'string' || asset.ProductVersion.length === 0) {
      continue;
    }

    for (const platform of classifyAsset(asset)) {
      const previous = latestByPlatform.get(platform);

      if (!previous || compareAssets(asset, previous) > 0) {
        latestByPlatform.set(platform, asset);
      }
    }
  }

  return applePlatforms.flatMap((platform) => {
    const asset = latestByPlatform.get(platform);

    if (!asset || typeof asset.ProductVersion !== 'string') {
      return [];
    }

    return [
      {
        platform,
        version: asset.ProductVersion,
        build: typeof asset.Build === 'string' && asset.Build.length > 0 ? asset.Build : null,
        source: dataSources.appleGdmf,
        fetchedAt
      }
    ];
  });
}

function getPublicAssetSets(data: unknown): Record<string, GdmfAsset[]> {
  if (!isRecord(data) || !isRecord(data.PublicAssetSets)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(data.PublicAssetSets)
      .filter(([, value]) => Array.isArray(value))
      .map(([key, value]) => [key, (value as unknown[]).filter(isRecord)])
  );
}

function classifyAsset(asset: GdmfAsset): ApplePlatform[] {
  const devices = Array.isArray(asset.SupportedDevices) ? asset.SupportedDevices.filter((device): device is string => typeof device === 'string') : [];

  return applePlatforms.filter((platform) => devices.some((device) => devicePrefixesByPlatform[platform].some((prefix) => device.startsWith(prefix))));
}

function compareAssets(left: GdmfAsset, right: GdmfAsset): number {
  const versionDifference = compareVersions(String(left.ProductVersion), String(right.ProductVersion));

  if (versionDifference !== 0) {
    return versionDifference;
  }

  const leftDate = typeof left.PostingDate === 'string' ? Date.parse(left.PostingDate) : 0;
  const rightDate = typeof right.PostingDate === 'string' ? Date.parse(right.PostingDate) : 0;

  return leftDate - rightDate;
}

function compareVersions(left: string, right: string): number {
  const leftParts = parseVersionParts(left);
  const rightParts = parseVersionParts(right);
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);

    if (difference !== 0) {
      return difference;
    }
  }

  return 0;
}

function parseVersionParts(version: string): number[] {
  const match = version.match(/^\d+(?:\.\d+)*/);
  return match ? match[0].split('.').map(Number) : [];
}

interface RssItem {
  title?: unknown;
  link?: unknown;
  pubDate?: unknown;
}

export function normalizeSofaUpdates(macOsData: unknown, iosData: unknown, fetchedAt: string): AppleUpdate[] {
  const updates: AppleUpdate[] = [];

  const addSofaUpdate = (data: unknown, platform: ApplePlatform) => {
    if (!isRecord(data) || !Array.isArray(data.OSVersions)) return;
    for (const os of data.OSVersions) {
      if (!isRecord(os) || !isRecord(os.Latest)) continue;
      const latest = os.Latest;
      if (typeof latest.ProductVersion === 'string' && latest.ProductVersion.length > 0) {
        updates.push({
          platform,
          version: latest.ProductVersion,
          build: typeof latest.Build === 'string' && latest.Build.length > 0 ? latest.Build : null,
          source: 'SOFA',
          fetchedAt
        });
        break;
      }
    }
  };

  addSofaUpdate(macOsData, 'macOS');
  addSofaUpdate(iosData, 'iOS');
  addSofaUpdate(iosData, 'iPadOS');

  return updates;
}

export function normalizeRssTimeline(data: unknown): ReleaseTimelineItem[] {
  return getRssItems(data)
    .filter((item) => typeof item.title === 'string' && item.title.length > 0)
    .slice(0, 12)
    .map((item) => ({
      title: item.title as string,
      url: typeof item.link === 'string' && item.link.length > 0 ? item.link : null,
      publishedAt: toIsoDateOrNull(item.pubDate),
      source: dataSources.appleDeveloperRss
    }));
}

function getRssItems(data: unknown): RssItem[] {
  if (!isRecord(data) || !isRecord(data.rss) || !isRecord(data.rss.channel)) {
    return [];
  }

  const rawItems = data.rss.channel.item ?? [];
  return (Array.isArray(rawItems) ? rawItems : [rawItems]).filter(isRecord);
}

function toIsoDateOrNull(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0) {
    return null;
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
