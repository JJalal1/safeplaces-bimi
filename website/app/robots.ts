import type {MetadataRoute} from 'next';
import {env} from 'cloudflare:workers';
import {siteOrigin,siteIndexable} from '../lib/site-origin';
export const dynamic='force-dynamic';
export default function robots():MetadataRoute.Robots{
 const publicSite=siteIndexable();
 return {rules:{userAgent:'*',...(publicSite?{allow:'/',disallow:['/api/','/ar/admin','/en/admin','/ar/account','/en/account','/ar/checkout','/en/checkout','/ar/cart','/en/cart','/ar/wishlist','/en/wishlist','/*?']}:{disallow:'/'})},sitemap:siteOrigin()+'/sitemap.xml'};
}
