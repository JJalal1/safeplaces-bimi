import type {MetadataRoute} from 'next';
import {env} from 'cloudflare:workers';
import {SITE_URL} from '../lib/config';
export const dynamic='force-dynamic';
export default function robots():MetadataRoute.Robots{
 const publicSite=(env as unknown as Record<string,string>).SITE_PUBLIC==='true';
 return {rules:{userAgent:'*',...(publicSite?{allow:'/',disallow:['/api/','/ar/admin','/en/admin','/ar/account','/en/account','/ar/checkout','/en/checkout','/ar/cart','/en/cart','/ar/wishlist','/en/wishlist','/*?']}:{disallow:'/'})},sitemap:SITE_URL+'/sitemap.xml'};
}
