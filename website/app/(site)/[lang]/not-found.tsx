'use client';
import {useParams} from 'next/navigation';
import {Brand} from '../../../components/brand';
import {local} from '../../../lib/config';

export default function NotFound(){
 const params=useParams<{lang:string}>(),lang=params?.lang==='en'?'en':'ar';
 return <main id="main" className="container section empty-state"><Brand lang={lang}/><p className="eyebrow">404</p><h1>{local(lang,'الصفحة غير موجودة','Page not found')}</h1><p>{local(lang,'يمكنك العودة للمنتجات أو إرسال احتياجك لفريقنا.','Browse our equipment or send your requirements to our team.')}</p><a className="button primary" href={'/'+lang+'/shop'}>{local(lang,'تصفح معدات السلامة','Browse safety equipment')}</a><p><a className="text-link" href={'/'+lang+'/quote'}>{local(lang,'طلب عرض سعر','Request a quotation')}</a></p></main>;
}
