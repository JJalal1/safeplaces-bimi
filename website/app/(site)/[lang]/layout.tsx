import type {Metadata,Viewport} from 'next';
import {notFound} from 'next/navigation';
import {SITE_URL} from '../../../lib/config';
import {StoreProvider} from '../../../components/store';
import '../../globals.css';
import '../../corporate.css';
import '../../marketplace.css';
import '../../admin.css';
import '../../shopping-refinements.css';
import '../../home-hero.css';
import '../../customer-account.css';
export const viewport:Viewport={width:'device-width',initialScale:1,viewportFit:'cover'};
export const metadata:Metadata={metadataBase:new URL(SITE_URL),title:{default:'Safe Places | المناطق الآمنة',template:'%s | Safe Places'},description:'مؤسسة المناطق الآمنة لأدوات ومواد السلامة في الخبر. حلول الحماية من الحريق ومعدات السلامة والتوريد والتركيب والصيانة.',icons:{icon:'/images/brand-favicon.png',apple:'/images/brand-favicon.png'},robots:{index:false,follow:false},openGraph:{type:'website',siteName:'Safe Places',images:[{url:'/images/hero.webp',width:1920,height:692}]}};
export default async function Layout({children,params}:{children:React.ReactNode;params:Promise<{lang:string}>}){const {lang}=await params;if(!['ar','en'].includes(lang))notFound();return <html lang={lang} dir={lang==='ar'?'rtl':'ltr'}><body><StoreProvider lang={lang as 'ar'|'en'}>{children}</StoreProvider></body></html>;}
