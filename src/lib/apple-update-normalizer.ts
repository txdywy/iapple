import type { ApplePlatform, AppleUpdate, ReleaseTimelineItem } from '../types/apple-updates';

const platformOrder: ApplePlatform[] = ['iOS', 'iPadOS', 'macOS', 'watchOS', 'tvOS', 'visionOS'];

interface GdmfAsset {
  ProductVersion?: unknown;
  Build?: unknown;
  PostingDate?: unknown;
  SupportedDevices?: unknown;
}

interface GdmfData {
  PublicAssetSets?: Record<string, GdmfAsset[]>;
}

export function normalizeGdmfUpdates(data: unknown, fetchedAt: string): AppleUpdate[] {
  const gdmfData = data as GdmfData;
  const publicAssetSets = gdmfData.PublicAssetSets ?? {};
  const assets = Object.values(publicAssetSets).flat();
  const latestByPlatform = new Map<ApplePlatform, GdmfAsset>();

  for (const asset of assets) {
    if (typeof asset.ProductVersion !== 'string' || asset.ProductVersion.length === 0) {
      continue;
    }

    const assetPlatforms = classifyAsset(asset);

    for (const platform of assetPlatforms) {
      const previous = latestByPlatform.get(platform);

      if (!previous || compareAssets(asset, previous) > 0) {
        latestByPlatform.set(platform, asset);
      }
    }
  }

  return platformOrder.flatMap((platform) => {
    const asset = latestByPlatform.get(platform);

    if (!asset || typeof asset.ProductVersion !== 'string') {
      return [];
    }

    return [
      {
        platform,
        version: asset.ProductVersion,
        build: typeof asset.Build === 'string' && asset.Build.length > 0 ? asset.Build : null,
        source: 'Apple GDMF',
        fetchedAt
      }
    ];
  });
}

function classifyAsset(asset: GdmfAsset): ApplePlatform[] {
  const devices = Array.isArray(asset.SupportedDevices) ? asset.SupportedDevices.filter((device): device is string => typeof device === 'string') : [];
  const platforms: ApplePlatform[] = [];

  if (devices.some((device) => device.startsWith('iPhone') || device.startsWith('iPod'))) {
    platforms.push('iOS');
  }

  if (devices.some((device) => device.startsWith('iPad'))) {
    platforms.push('iPadOS');
  }

  if (devices.some((device) => device.startsWith('J') || device.startsWith('Mac-') || device.startsWith('VMM') || device.startsWith('VMA'))) {
    platforms.push('macOS');
  }

  if (devices.some((device) => device.startsWith('Watch'))) {
    platforms.push('watchOS');
  }

  if (devices.some((device) => device.startsWith('AppleTV') || device.startsWith('AudioAccessory'))) {
    platforms.push('tvOS');
  }

  if (devices.some((device) => device.startsWith('RealityDevice'))) {
    platforms.push('visionOS');
  }

  return platforms;
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
  const leftParts = left.split('.').map((part) => Number.parseInt(part, 10));
  const rightParts = right.split('.').map((part) => Number.parseInt(part, 10));
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const difference = (leftParts[index] || 0) - (rightParts[index] || 0);

    if (difference !== 0) {
      return difference;
    }
  }

  return 0;
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
