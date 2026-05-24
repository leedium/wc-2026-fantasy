import type { MetadataRoute } from 'next';

// Block all polite crawlers from the entire site. The companion
// `robots: { index: false, follow: false }` entry on the root layout
// metadata adds a <meta name="robots"> tag so pages already discovered
// (e.g. via social shares) drop out of indexes too.
//
// This file produces /robots.txt at build time via the App Router. To
// re-open the site to crawlers later, delete this file (and the metadata
// entry on layout.tsx).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', disallow: '/' },
  };
}
