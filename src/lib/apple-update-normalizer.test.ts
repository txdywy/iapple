import { describe, expect, it } from 'vitest';
import { normalizeGdmfUpdates, normalizeRssTimeline, normalizeSofaUpdates } from './apple-update-normalizer';

const fetchedAt = '2026-05-01T00:00:00.000Z';

describe('normalizeGdmfUpdates', () => {
  it('returns empty updates for malformed GDMF payloads', () => {
    expect(normalizeGdmfUpdates(null, fetchedAt)).toEqual([]);
    expect(normalizeGdmfUpdates({ PublicAssetSets: null }, fetchedAt)).toEqual([]);
    expect(normalizeGdmfUpdates({ PublicAssetSets: { iOS: 'not an array' } }, fetchedAt)).toEqual([]);
  });

  it('extracts known Apple OS updates from PublicAssetSets', () => {
    const data = {
      PublicAssetSets: {
        iOS: [{ ProductVersion: '18.5', Build: '22F76', SupportedDevices: ['iPhone16,1'] }],
        iPadOS: [{ ProductVersion: '18.5', Build: '22F76', SupportedDevices: ['iPad14,1'] }],
        macOS: [{ ProductVersion: '15.5', Build: '24F74', SupportedDevices: ['J713AP'] }],
        watchOS: [{ ProductVersion: '11.5', Build: '22T556', SupportedDevices: ['Watch6,1'] }],
        tvOS: [{ ProductVersion: '18.5', Build: '22L556', SupportedDevices: ['AppleTV11,1'] }],
        visionOS: [{ ProductVersion: '2.5', Build: '22O473', SupportedDevices: ['RealityDevice14,1'] }]
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
        iOS: [{ ProductVersion: '', Build: '22F76', SupportedDevices: ['iPhone16,1'] }],
        macOS: [{ ProductVersion: '15.5', SupportedDevices: ['J713AP'] }]
      }
    };

    expect(normalizeGdmfUpdates(data, fetchedAt)).toEqual([
      { platform: 'macOS', version: '15.5', build: null, source: 'Apple GDMF', fetchedAt }
    ]);
  });


  it('classifies mixed GDMF iOS assets by supported device family', () => {
    const data = {
      PublicAssetSets: {
        iOS: [
          { ProductVersion: '9.6.4', Build: '20U512', SupportedDevices: ['Watch4,1'] },
          { ProductVersion: '26.4.2', Build: '23E261', SupportedDevices: ['iPad11,1'] },
          { ProductVersion: '26.4.1', Build: '23E252', SupportedDevices: ['iPhone16,1'] },
          { ProductVersion: '26.4', Build: '23T240', SupportedDevices: ['Watch6,1'] },
          { ProductVersion: '26.3', Build: '23K6620', SupportedDevices: ['AppleTV11,1'] }
        ],
        visionOS: [{ ProductVersion: '26.4', Build: '23O247', SupportedDevices: ['RealityDevice14,1'] }]
      }
    };

    expect(normalizeGdmfUpdates(data, fetchedAt)).toEqual([
      { platform: 'iOS', version: '26.4.1', build: '23E252', source: 'Apple GDMF', fetchedAt },
      { platform: 'iPadOS', version: '26.4.2', build: '23E261', source: 'Apple GDMF', fetchedAt },
      { platform: 'watchOS', version: '26.4', build: '23T240', source: 'Apple GDMF', fetchedAt },
      { platform: 'tvOS', version: '26.3', build: '23K6620', source: 'Apple GDMF', fetchedAt },
      { platform: 'visionOS', version: '26.4', build: '23O247', source: 'Apple GDMF', fetchedAt }
    ]);
  });


  it('prefers the highest platform version over a newer posting date', () => {
    const data = {
      PublicAssetSets: {
        iOS: [
          { ProductVersion: '17.7.10', Build: '21H450', PostingDate: '2026-05-01', SupportedDevices: ['iPad7,1'] },
          { ProductVersion: '26.4.2', Build: '23E261', PostingDate: '2026-04-29', SupportedDevices: ['iPad11,1'] }
        ]
      }
    };

    expect(normalizeGdmfUpdates(data, fetchedAt)).toEqual([
      { platform: 'iPadOS', version: '26.4.2', build: '23E261', source: 'Apple GDMF', fetchedAt }
    ]);
  });


  it('assigns universal iPhone and iPad assets to both iOS and iPadOS', () => {
    const data = {
      PublicAssetSets: {
        iOS: [
          { ProductVersion: '26.4.2', Build: '23E261', SupportedDevices: ['iPhone16,1', 'iPad11,1'] }
        ]
      }
    };

    expect(normalizeGdmfUpdates(data, fetchedAt)).toEqual([
      { platform: 'iOS', version: '26.4.2', build: '23E261', source: 'Apple GDMF', fetchedAt },
      { platform: 'iPadOS', version: '26.4.2', build: '23E261', source: 'Apple GDMF', fetchedAt }
    ]);
  });

});

describe('normalizeSofaUpdates', () => {
  it('extracts macOS, iOS, and iPadOS updates from SOFA feeds', () => {
    const macos = {
      OSVersions: [
        {
          Latest: {
            ProductVersion: '15.5',
            Build: '24F74'
          }
        }
      ]
    };
    const ios = {
      OSVersions: [
        {
          Latest: {
            ProductVersion: '18.5',
            Build: '22F76'
          }
        }
      ]
    };

    expect(normalizeSofaUpdates(macos, ios, fetchedAt)).toEqual([
      { platform: 'macOS', version: '15.5', build: '24F74', source: 'SOFA', fetchedAt },
      { platform: 'iOS', version: '18.5', build: '22F76', source: 'SOFA', fetchedAt },
      { platform: 'iPadOS', version: '18.5', build: '22F76', source: 'SOFA', fetchedAt }
    ]);
  });

  it('returns empty updates for malformed SOFA payloads', () => {
    expect(normalizeSofaUpdates(null, { OSVersions: 'bad' }, fetchedAt)).toEqual([]);
  });
});

describe('normalizeRssTimeline', () => {
  it('keeps RSS timeline items with malformed dates', () => {
    const rss = { rss: { channel: { item: { title: 'Malformed date release', link: '', pubDate: 'not-a-date' } } } };

    expect(normalizeRssTimeline(rss)).toEqual([
      { title: 'Malformed date release', url: null, publishedAt: null, source: 'Apple Developer RSS' }
    ]);
  });

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
