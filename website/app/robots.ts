import type {MetadataRoute} from 'next';
import {siteOrigin,siteIndexable} from '../lib/site-origin';
export const dynamic='force-dynamic';
export default function robots():MetadataRoute.Robots{
 const publicSite=siteIndexable();
 // Public product photos/datasheets use /api/media/. Its authorization still
 // protects private files; robots rules do not grant permission to read them.
 return {rules:{userAgent:'*',...(publicSite?{allow:['/','/api/media/'],disallow:['/api/','/ar/admin','/en/admin','/ar/account','/en/account','/ar/checkout','/en/checkout','/ar/cart','/en/cart','/ar/wishlist','/en/wishlist']}:{disallow:'/'})},sitemap:siteOrigin()+'/sitemap.xml'};
}

