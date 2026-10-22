import {ShieldCheck,Flame,AlarmSmoke,HardHat,Settings2,Wrench,ClipboardCheck,Users,ArrowLeft,ArrowRight,Check,Phone,Mail,MapPin} from 'lucide-react';
import {local,type Lang} from '../lib/config';
import {productName,type Product} from '../lib/catalog';
import {responsiveImage,catalogImageSizes} from '../lib/responsive-images';
export const Icon=({name,size=24}:{name:string;size?:number})=>{const icons:Record<string,typeof ShieldCheck>={shield:ShieldCheck,extinguisher:Flame,alarm:AlarmSmoke,helmet:HardHat,pump:Settings2,valve:Settings2,sign:ClipboardCheck,wrench:Wrench,clipboard:ClipboardCheck,users:Users,check:Check,phone:Phone,mail:Mail,pin:MapPin};const Component=icons[name]||ShieldCheck;return <Component size={size} strokeWidth={1.6} aria-hidden="true"/>;};
export const Arrow=({lang}:{lang:string})=>lang==='ar'?<ArrowLeft size={18}/>:<ArrowRight size={18}/>;
const photos:Record<string,{src:string;ar:string;en:string}>={
 extinguishers:{src:'/images/catalog/extinguishers.webp',ar:'طفايات حريق',en:'Fire extinguishers'},
 ppe:{src:'/images/catalog/ppe.webp',ar:'معدات وقاية شخصية',en:'Personal protective equipment'},
 alarms:{src:'/images/catalog/alarms.webp',ar:'أجهزة إنذار الحريق',en:'Fire alarm equipment'},
 emergency:{src:'/images/catalog/emergency.webp',ar:'مستلزمات الطوارئ',en:'Emergency equipment'},
 firefighting:{src:'/images/hero.webp',ar:'أنظمة مكافحة الحريق',en:'Firefighting systems'},
 suppression:{src:'/images/hero.webp',ar:'حلول الحماية من الحريق',en:'Fire protection solutions'}
};
export function EquipmentPhoto({category,lang='ar',caption=false,imageSizes=catalogImageSizes}:{category:string;lang?:Lang;caption?:boolean;imageSizes?:string}){
 const photo=photos[category]||photos.firefighting;
 return <div className={'product-art equipment-photo photo-'+category}><img src={photo.src} {...responsiveImage(photo.src,imageSizes)} alt={local(lang,photo.ar+' — صورة توضيحية','Reference photograph: '+photo.en)} width={640} height={480} loading="lazy" decoding="async"/>{caption&&<span className="photo-caption">{local(lang,'صورة توضيحية للفئة','Category reference image')}</span>}</div>;
}
const productPhotos:Record<string,string>={'fire-extinguishers':'extinguishers','fire-alarm-devices':'alarms','fire-pumps':'fire-pump','sprinklers':'sprinkler','hoses-and-reels':'hose-reel','safety-helmets':'helmet','protective-equipment':'ppe','emergency-and-signs':'emergency'};
export function referencePhotoSrc(product:Pick<Product,'slug'>){return productPhotos[product.slug]?'/images/catalog/'+productPhotos[product.slug]+'.webp':null;}
export function ProductPhoto({product,lang,caption=false,imageSizes=catalogImageSizes}:{product:Pick<Product,'slug'|'image'|'category'|'nameAr'|'nameEn'>;lang:Lang;caption?:boolean;imageSizes?:string}){
 const src=product.image||referencePhotoSrc(product);
 if(!src)return <EquipmentPhoto category={product.category} lang={lang} caption={caption} imageSizes={imageSizes}/>;
 return <div className={'product-art '+(product.image?'':'product-photo')}><img src={src} {...responsiveImage(src,imageSizes)} alt={productName(product,lang)+(product.image?'':local(lang,' — صورة توضيحية',' — reference image'))} width={640} height={480} loading="lazy" decoding="async"/>{!product.image&&caption&&<span className="photo-caption">{local(lang,'صورة توضيحية','Reference image')}</span>}</div>;
}

