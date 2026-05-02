export const applePlatforms = ['iOS', 'iPadOS', 'macOS', 'watchOS', 'tvOS', 'visionOS'] as const;
export type ApplePlatform = (typeof applePlatforms)[number];

export const dataSources = {
  appleGdmf: 'Apple GDMF',
  sofaMacos: 'SOFA macOS',
  sofaIos: 'SOFA iOS',
  appleDeveloperRss: 'Apple Developer RSS'
} as const;

export type UpdateDataSource = typeof dataSources.appleGdmf | 'SOFA' | 'Manual fallback';
export type StatusDataSource = (typeof dataSources)[keyof typeof dataSources];

export interface AppleUpdate {
  platform: ApplePlatform;
  version: string;
  build: string | null;
  source: UpdateDataSource;
  fetchedAt: string;
}

export interface ReleaseTimelineItem {
  title: string;
  url: string | null;
  publishedAt: string | null;
  source: typeof dataSources.appleDeveloperRss;
}

export interface DataSourceStatus {
  name: StatusDataSource;
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
