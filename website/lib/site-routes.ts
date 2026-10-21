const singlePageRoutes = new Set([
  'about', 'quote', 'contact', 'certificates', 'privacy', 'terms',
  'returns', 'collection', 'cart', 'checkout', 'wishlist', 'admin',
]);
const accountRoutes = new Set(['login', 'register', 'forgot', 'confirm', 'reset', 'verify']);

/**
 * Reject unused catch-all segments before reading content or generating a
 * self-canonical URL. Dynamic product, service and project existence is still
 * checked when the corresponding page loads.
 */
export function isSupportedSiteRoute(slug: readonly string[]): boolean {
  if (!slug.length) return true;
  if (slug.some(segment => !segment)) return false;
  const [section, detail] = slug;
  if (singlePageRoutes.has(section)) return slug.length === 1;
  if (section === 'services' || section === 'projects') return slug.length <= 2;
  if (section === 'shop') {
    if (detail === 'category') return slug.length === 3;
    return slug.length <= 2;
  }
  if (section === 'account') {
    return slug.length === 1 || (slug.length === 2 && accountRoutes.has(detail));
  }
  return false;
}
