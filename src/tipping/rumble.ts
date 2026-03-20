/**
 * Rumble creator metrics collector.
 *
 * Fetches public data from Rumble channels to evaluate creators
 * for autonomous tipping decisions. Rumble uses Tether WDK as
 * its native wallet — tips go directly via USDT/XAU₮/BTC.
 *
 * For the MVP we fetch the channel HTML page and extract metrics
 * from embedded JSON (window.__INITIAL_STATE__ or meta tags).
 * In production this would use Rumble's internal API.
 */

import { createLogger } from '../utils/logger.js';

const log = createLogger('Rumble');

// ─── Types ───────────────────────────────────────────────

export interface RumbleCreator {
  username: string;
  displayName: string;
  walletAddress: string;          // Sepolia address for receiving tips
  rumbleUrl: string;
  followers?: number;
  totalViews?: number;
  recentVideoCount?: number;
  recentVideos: RumbleVideo[];
  engagementScore: number;        // 0-100, computed from metrics
  lastFetched: string;
}

export interface RumbleVideo {
  title: string;
  views: number;
  likes: number;
  date: string;
  url: string;
}

// ─── Creator Registry ────────────────────────────────────
// Maps Rumble creators to their tip-receiving wallet addresses.
// In production: on-chain registry or Rumble WDK wallet lookup.

const CREATOR_REGISTRY: Array<{
  username: string;
  displayName: string;
  walletAddress: string;
}> = [
  {
    username: 'Rumble',
    displayName: 'Rumble Official',
    walletAddress: '0x000000000000000000000000000000000000dEaD', // burn address for testing
  },
  {
    username: 'DonaldTrump',
    displayName: 'Donald J. Trump',
    walletAddress: '0x000000000000000000000000000000000000dEaD',
  },
  {
    username: 'russellbrand',
    displayName: 'Russell Brand',
    walletAddress: '0x000000000000000000000000000000000000dEaD',
  },
  {
    username: 'Bongino',
    displayName: 'Dan Bongino',
    walletAddress: '0x000000000000000000000000000000000000dEaD',
  },
  {
    username: 'DineshDSouza',
    displayName: 'Dinesh D\'Souza',
    walletAddress: '0x000000000000000000000000000000000000dEaD',
  },
];

// Allow overriding the default test address for real tips
let defaultTipAddress = '0x000000000000000000000000000000000000dEaD';

export function setDefaultTipAddress(addr: string): void {
  defaultTipAddress = addr;
  // Update all creators that still have the burn address
  for (const c of CREATOR_REGISTRY) {
    if (c.walletAddress === '0x000000000000000000000000000000000000dEaD') {
      c.walletAddress = addr;
    }
  }
  log.info(`Default tip address set to ${addr}`);
}

// ─── Fetch Creator Metrics ───────────────────────────────

/**
 * Fetch public metrics for a Rumble creator.
 * Attempts to parse the channel page HTML for embedded data.
 * Falls back to estimated metrics if scraping fails.
 */
export async function fetchCreatorMetrics(username: string): Promise<RumbleCreator | null> {
  const registry = CREATOR_REGISTRY.find(c => c.username.toLowerCase() === username.toLowerCase());
  if (!registry) return null;

  const rumbleUrl = `https://rumble.com/c/${username}`;

  try {
    const res = await fetch(rumbleUrl, {
      headers: { 'User-Agent': 'OmniAgent/1.0 (Hackathon Tipping Bot)' },
    });

    if (!res.ok) {
      log.warn(`Rumble fetch failed for ${username}: ${res.status}`);
      return buildFallbackCreator(registry, rumbleUrl);
    }

    const html = await res.text();
    return parseCreatorFromHtml(html, registry, rumbleUrl);
  } catch (err) {
    log.warn(`Rumble fetch error for ${username}: ${String(err).slice(0, 80)}`);
    return buildFallbackCreator(registry, rumbleUrl);
  }
}

/**
 * Parse creator metrics from Rumble channel HTML.
 * Looks for subscriber counts, video data in meta tags and structured data.
 */
function parseCreatorFromHtml(
  html: string,
  registry: typeof CREATOR_REGISTRY[0],
  rumbleUrl: string,
): RumbleCreator {
  let followers: number | undefined;
  const videos: RumbleVideo[] = [];

  // 1. Try JSON-LD structured data (most reliable)
  const jsonLdMatch = html.match(/<script\s+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
  if (jsonLdMatch) {
    for (const block of jsonLdMatch) {
      try {
        const json = block.replace(/<\/?script[^>]*>/gi, '').trim();
        const ld = JSON.parse(json);
        // Channel data
        if (ld['@type'] === 'Person' || ld['@type'] === 'Organization') {
          if (ld.interactionStatistic) {
            const stats = ([] as any[]).concat(ld.interactionStatistic);
            for (const stat of stats) {
              if (stat.interactionType?.includes?.('Subscribe') || stat.name?.includes?.('subscriber')) {
                followers = Number(stat.userInteractionCount) || undefined;
              }
            }
          }
        }
        // Video items
        if (ld['@type'] === 'VideoObject') {
          videos.push({
            title: ld.name || 'Untitled',
            views: Number(ld.interactionStatistic?.userInteractionCount) || 0,
            likes: 0,
            date: ld.uploadDate || new Date().toISOString(),
            url: ld.url || rumbleUrl,
          });
        }
        // ItemList of videos
        if (ld['@type'] === 'ItemList' && ld.itemListElement) {
          for (const item of ld.itemListElement.slice(0, 5)) {
            const v = item.item || item;
            if (v.name) {
              videos.push({
                title: v.name,
                views: Number(v.interactionStatistic?.userInteractionCount) || 0,
                likes: 0,
                date: v.uploadDate || new Date().toISOString(),
                url: v.url || rumbleUrl,
              });
            }
          }
        }
      } catch { /* invalid JSON-LD */ }
    }
  }

  // 2. Try subscriber count patterns (multiple formats)
  if (!followers) {
    const subPatterns = [
      /(\d[\d,.]*[KkMm]?)\s*(?:followers|subscribers|Followers|Subscribers)/,
      /subscribers['":\s]*(\d[\d,.]*[KkMm]?)/i,
      /class="[^"]*subscribe[^"]*"[^>]*>[\s\S]*?(\d[\d,.]*[KkMm]?)/i,
      /channel-header--subscribers[^>]*>[\s\S]*?(\d[\d,.]*[KkMm]?)/i,
    ];
    for (const pat of subPatterns) {
      const m = html.match(pat);
      if (m) { followers = parseHumanNumber(m[1]); break; }
    }
  }

  // 3. Try og:description meta tag
  if (!followers) {
    const ogMatch = html.match(/<meta\s+(?:property|name)="og:description"\s+content="([^"]*?)"/i);
    if (ogMatch) {
      const numMatch = ogMatch[1].match(/(\d[\d,.]*[KkMm]?)\s*(?:follower|subscriber)/i);
      if (numMatch) followers = parseHumanNumber(numMatch[1]);
    }
  }

  // 4. Try video titles from thumbnail classes (Rumble uses thumbnail__title)
  if (videos.length === 0) {
    const titlePattern = /class="thumbnail__title[^"]*"[^>]*>([^<]+)</gi;
    const viewPattern = /class="videostream__views--count[^"]*"[^>]*>[\s\S]*?(\d[\d,.]*[KkMm]?)/gi;
    let m;
    const titles: string[] = [];
    while ((m = titlePattern.exec(html)) !== null && titles.length < 5) {
      titles.push(m[1].trim());
    }
    const viewCounts: number[] = [];
    while ((m = viewPattern.exec(html)) !== null && viewCounts.length < 5) {
      viewCounts.push(parseHumanNumber(m[1]));
    }
    for (let i = 0; i < titles.length; i++) {
      videos.push({
        title: titles[i],
        views: viewCounts[i] || 0,
        likes: 0,
        date: new Date().toISOString(),
        url: rumbleUrl,
      });
    }
  }

  // 5. Broad fallback: any view counts in the page
  if (videos.length === 0) {
    const broadPattern = /(\d[\d,.]*[KkMm]?)\s*views/gi;
    let m;
    let count = 0;
    while ((m = broadPattern.exec(html)) !== null && count < 5) {
      videos.push({
        title: `Video ${count + 1}`,
        views: parseHumanNumber(m[1]),
        likes: 0,
        date: new Date().toISOString(),
        url: rumbleUrl,
      });
      count++;
    }
  }

  const totalViews = videos.reduce((sum, v) => sum + v.views, 0);
  const engagementScore = computeEngagement(followers, totalViews, videos.length);

  return {
    username: registry.username,
    displayName: registry.displayName,
    walletAddress: registry.walletAddress,
    rumbleUrl,
    followers,
    totalViews: totalViews || undefined,
    recentVideoCount: videos.length || undefined,
    recentVideos: videos,
    engagementScore,
    lastFetched: new Date().toISOString(),
  };
}

function buildFallbackCreator(
  registry: typeof CREATOR_REGISTRY[0],
  rumbleUrl: string,
): RumbleCreator {
  return {
    username: registry.username,
    displayName: registry.displayName,
    walletAddress: registry.walletAddress,
    rumbleUrl,
    recentVideos: [],
    engagementScore: 50, // neutral score when metrics unavailable
    lastFetched: new Date().toISOString(),
  };
}

// ─── Engagement Scoring ──────────────────────────────────

function computeEngagement(followers?: number, totalViews?: number, videoCount?: number): number {
  let score = 50; // base

  if (followers) {
    if (followers > 1_000_000) score += 25;
    else if (followers > 100_000) score += 20;
    else if (followers > 10_000) score += 15;
    else if (followers > 1_000) score += 10;
    else score += 5;
  }

  if (totalViews && videoCount && videoCount > 0) {
    const avgViews = totalViews / videoCount;
    if (avgViews > 100_000) score += 15;
    else if (avgViews > 10_000) score += 10;
    else if (avgViews > 1_000) score += 5;
  }

  if (videoCount) {
    if (videoCount >= 5) score += 10; // active creator
    else if (videoCount >= 2) score += 5;
  }

  return Math.min(100, score);
}

// ─── Search Rumble ───────────────────────────────────────

/**
 * Search Rumble for creators/videos matching a query.
 * Parses the public search results page for channels and videos.
 */
export async function searchRumble(query: string): Promise<RumbleCreator[]> {
  const url = `https://rumble.com/search/video?q=${encodeURIComponent(query)}&sort=relevance`;
  log.info(`Searching Rumble: "${query}"`);

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'OmniAgent/1.0 (Hackathon Tipping Bot)' },
    });
    if (!res.ok) {
      log.warn(`Rumble search failed: ${res.status}`);
      return [];
    }

    const html = await res.text();
    return parseSearchResults(html, query);
  } catch (err) {
    log.warn(`Rumble search error: ${String(err).slice(0, 80)}`);
    return [];
  }
}

function parseSearchResults(html: string, query: string): RumbleCreator[] {
  const creators = new Map<string, RumbleCreator>();
  let match;

  // 1. Try JSON-LD structured data from search results
  const jsonLdMatch = html.match(/<script\s+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
  if (jsonLdMatch) {
    for (const block of jsonLdMatch) {
      try {
        const json = block.replace(/<\/?script[^>]*>/gi, '').trim();
        const ld = JSON.parse(json);
        if (ld['@type'] === 'ItemList' && ld.itemListElement) {
          for (const item of ld.itemListElement) {
            const v = item.item || item;
            // Extract channel from video author
            const authorUrl = v.author?.url || '';
            const authorMatch = authorUrl.match(/\/c\/([a-zA-Z0-9_-]+)/);
            if (authorMatch && !creators.has(authorMatch[1])) {
              creators.set(authorMatch[1], {
                username: authorMatch[1],
                displayName: v.author?.name || authorMatch[1],
                walletAddress: defaultTipAddress,
                rumbleUrl: `https://rumble.com/c/${authorMatch[1]}`,
                recentVideos: [{
                  title: v.name || 'Untitled',
                  views: Number(v.interactionStatistic?.userInteractionCount) || 0,
                  likes: 0,
                  date: v.uploadDate || new Date().toISOString(),
                  url: v.url || '',
                }],
                engagementScore: 50,
                lastFetched: new Date().toISOString(),
              });
            }
          }
        }
      } catch { /* invalid JSON */ }
    }
  }

  // 2. Try author links with multiple HTML patterns
  if (creators.size === 0) {
    const patterns = [
      // videostream author link
      /<a[^>]*href="\/c\/([a-zA-Z0-9_-]+)"[^>]*class="[^"]*videostream__author[^"]*"[^>]*>([^<]+)/gi,
      // any link to /c/ with display text
      /<a[^>]*href="\/c\/([a-zA-Z0-9_-]+)"[^>]*>([^<]{2,40})<\/a>/gi,
    ];
    for (const pat of patterns) {
      while ((match = pat.exec(html)) !== null) {
        const username = match[1];
        if (!creators.has(username) && username.length >= 3) {
          creators.set(username, {
            username,
            displayName: match[2].trim(),
            walletAddress: defaultTipAddress,
            rumbleUrl: `https://rumble.com/c/${username}`,
            recentVideos: [],
            engagementScore: 50,
            lastFetched: new Date().toISOString(),
          });
        }
      }
      if (creators.size > 0) break;
    }
  }

  // 3. Broad fallback: /c/ links
  if (creators.size === 0) {
    const channelPattern = /\/c\/([a-zA-Z0-9_-]+)/g;
    const seen = new Set<string>();
    while ((match = channelPattern.exec(html)) !== null && seen.size < 15) {
      const username = match[1];
      if (seen.has(username) || username.length < 3) continue;
      // Skip common non-channel paths
      if (['undefined', 'null', 'css', 'js', 'img', 'api'].includes(username.toLowerCase())) continue;
      seen.add(username);
      creators.set(username, {
        username,
        displayName: username,
        walletAddress: defaultTipAddress,
        rumbleUrl: `https://rumble.com/c/${username}`,
        recentVideos: [],
        engagementScore: 50,
        lastFetched: new Date().toISOString(),
      });
    }
  }

  const result = Array.from(creators.values()).slice(0, 10);
  log.info(`Rumble search "${query}": found ${result.length} creators`);
  return result;
}

// ─── Scan All Creators ───────────────────────────────────

/**
 * Scan registered creators + discover new ones via search.
 * Two-step: first check known creators, then search for new ones.
 */
export async function scanAllCreators(searchQuery?: string): Promise<RumbleCreator[]> {
  log.info(`Scanning Rumble creators...`);

  // 1. Fetch metrics for registered creators
  const registryResults = await Promise.allSettled(
    CREATOR_REGISTRY.map(c => fetchCreatorMetrics(c.username))
  );

  const creators: RumbleCreator[] = [];
  for (const r of registryResults) {
    if (r.status === 'fulfilled' && r.value) {
      creators.push(r.value);
    }
  }

  // 2. Search Rumble for additional creators if query provided
  if (searchQuery) {
    const searched = await searchRumble(searchQuery);
    const known = new Set(creators.map(c => c.username.toLowerCase()));
    for (const s of searched) {
      if (!known.has(s.username.toLowerCase())) {
        creators.push(s);
      }
    }
  }

  // Sort by engagement score
  creators.sort((a, b) => b.engagementScore - a.engagementScore);

  log.info(`Total creators: ${creators.length}, top: ${creators[0]?.displayName ?? 'none'} (score: ${creators[0]?.engagementScore ?? 0})`);
  return creators;
}

/**
 * Format creators for Claude to evaluate tipping decisions.
 */
export function formatCreatorsForLlm(creators: RumbleCreator[]): string {
  if (creators.length === 0) return 'No Rumble creators found.';

  return creators.map((c, i) => {
    const parts = [
      `${i + 1}. ${c.displayName} (@${c.username})`,
      `Engagement: ${c.engagementScore}/100`,
    ];
    if (c.followers) parts.push(`Followers: ${formatNum(c.followers)}`);
    if (c.totalViews) parts.push(`Recent views: ${formatNum(c.totalViews)}`);
    if (c.recentVideoCount) parts.push(`Recent videos: ${c.recentVideoCount}`);
    if (c.recentVideos.length > 0) {
      parts.push(`Latest: "${c.recentVideos[0].title}" (${formatNum(c.recentVideos[0].views)} views)`);
    }
    return parts.join(' | ');
  }).join('\n');
}

// ─── Helpers ─────────────────────────────────────────────

function parseHumanNumber(s: string): number {
  const clean = s.replace(/,/g, '').trim();
  const mult = clean.match(/[Kk]$/) ? 1_000 : clean.match(/[Mm]$/) ? 1_000_000 : 1;
  return Math.round(parseFloat(clean.replace(/[KkMm]$/, '')) * mult);
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, '').trim();
}

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
