'use client';
import {useParams} from 'next/navigation';
import {local} from '../../../lib/config';

export default function ErrorPage({reset}:{error:Error&{digest?:string};reset:()=>void}){
 const params=useParams<{lang:string}>(),lang=params?.lang==='en'?'en':'ar';
 return <main id="main" className="container section empty-state"><h1>{local(lang,'تعذر تحميل الصفحة','This page could not be loaded')}</h1><p>{local(lang,'حاول تحميلها مرة أخرى. إذا استمرت المشكلة، تواصل معنا لمساعدتك.','Try loading the page again. If the problem continues, contact us for help.')}</p><button className="button primary" onClick={reset}>{local(lang,'إعادة المحاولة','Try again')}</button><p><a className="text-link" href={'/'+lang+'/contact'}>{local(lang,'التواصل مع الفريق','Contact our team')}</a></p></main>;
}
