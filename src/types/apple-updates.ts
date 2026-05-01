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
