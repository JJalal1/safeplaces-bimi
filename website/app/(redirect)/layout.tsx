import type {Metadata} from 'next';
import {siteIcons} from '../../lib/site-icons';

export const metadata:Metadata={icons:siteIcons};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="ar" dir="rtl"><body>{children}</body></html>;}

