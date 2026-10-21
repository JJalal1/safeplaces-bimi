import type {Metadata,Viewport} from 'next';
import {notFound} from 'next/navigation';
import {siteOrigin,siteIndexable} from '../../../lib/site-origin';
import {StoreProvider} from '../../../components/store';
import '../../globals.css';
import '../../corporate.css';
import '../../marketplace.css';
import '../../admin.css';
import '../../shopping-refinements.css';
import '../../home-hero.css';
import '../../customer-account.css';
import '../../mobile-polish.css';
import '../../company-experience.css';
import '../../page-experience.css';
import '../../brand-fonts.css';
import '../../brand-theme.css';
import '../../company-brand.css';
import '../../store-brand.css';
import '../../shop-interactions.css';
import '../../product-shopping.css';
import '../../cart-shopping.css';
import '../../seo-guide.css';
import '../../sign-out-confirmation.css';
export const viewport:Viewport={width:'device-width',initialScale:1,viewportFit:'cover'};
export async function generateMetadata():Promise<Metadata>{return {metadataBase:new URL(siteOrigin()),title:{default:'Safe Places | المناطق الآمنة',template:'%s | Safe Places'},description:'مؤسسة المناطق الآمنة لأدوات ومواد السلامة في الخبر. حلول الحماية من الحريق ومعدات السلامة والتوريد والتركيب والصيانة.',icons:{icon:'/images/brand-favicon.png',apple:'/images/brand-favicon.png'},robots:{index:siteIndexable(),follow:siteIndexable()},openGraph:{type:'website',siteName:'Safe Places',images:[{url:'/images/hero.webp',width:1920,height:692}]}};}
export default async function Layout({children,params}:{children:React.ReactNode;params:Promise<{lang:string}>}){const {lang}=await params;if(!['ar','en'].includes(lang))notFound();return <html lang={lang} dir={lang==='ar'?'rtl':'ltr'}><body><StoreProvider lang={lang as 'ar'|'en'}>{children}</StoreProvider></body></html>;}

