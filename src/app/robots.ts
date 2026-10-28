import type { MetadataRoute } from 'next';
// The application sits behind a login: nothing here should be indexed.
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: '*', disallow: '/' } };
}
