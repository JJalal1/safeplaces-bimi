import type {Product} from './catalog';
import {matchesProduct,normalizeSearch} from './shopping';
export type ShopFilters={q:string;categories:string[];brands:string[];kinds:string[];min:string;max:string;documents:boolean;sale:boolean;specs:Record<string,string[]>;sort:string;page:number};
export type SpecFacet={key:string;ar:string;en:string;values:string[]};
export const shopSorts=['featured','new','name'];
export const emptyFilters=():ShopFilters=>({q:'',categories:[],brands:[],kinds:[],min:'',max:'',documents:false,sale:false,specs:{},sort:'featured',page:1});
const values=(value:string|string[]|undefined)=>[...new Set((Array.isArray(value)?value:value?[value]:[]).map(item=>item.slice(0,160)).filter(Boolean))].slice(0,40);
const price=(value:string|string[]|undefined)=>{const text=Array.isArray(value)?value[0]:value;const amount=Number(text);return text&&Number.isFinite(amount)&&amount>=0&&amount<=1e10?String(amount):'';};
export function parseShopFilters(query:Record<string,string|string[]|undefined>,category=''):ShopFilters{
 const specs:Record<string,string[]>={};for(const [key,value]of Object.entries(query))if(key.startsWith('spec.')&&key.length<150)specs[key.slice(5)]=values(value);
 return {...emptyFilters(),q:values(query.q)[0]?.slice(0,100)||'',categories:category?[category]:values(query.category),brands:values(query.brand),kinds:[],min:'',max:'',documents:query.documents==='1',sale:false,specs,sort:typeof query.sort==='string'&&shopSorts.includes(query.sort)?query.sort:'featured',page:Math.min(10000,Math.max(1,Math.floor(Number(query.page)||1)))};
}
export function productSpecs(product:Product){
 try{const value=JSON.parse(product.specs);if(!Array.isArray(value))return [];return value.filter((spec):spec is {ar:string;en:string;value:string}=>!!spec&&typeof spec.value==='string'&&(typeof spec.ar==='string'||typeof spec.en==='string')).map(spec=>({ar:spec.ar||spec.en,en:spec.en||spec.ar,value:spec.value.trim()})).filter(spec=>!!spec.value&&spec.value.length<=160);}catch{return [];}
}
export function specKey(spec:{ar:string;en:string}){return normalizeSearch(spec.en||spec.ar).trim().replace(/[^\p{L}\p{N}]+/gu,'_');}
export function specificationFacets(products:Product[],filters:ShopFilters):SpecFacet[]{
 const scoped=products.filter(product=>(!filters.categories.length||filters.categories.includes(product.category))&&(!filters.q||matchesProduct(product,filters.q)));
 const facets=new Map<string,SpecFacet>();for(const product of scoped)for(const spec of productSpecs(product)){
  const key=specKey(spec);if(!key)continue;const old=facets.get(key)||{key,ar:spec.ar,en:spec.en,values:[]};if(!old.values.includes(spec.value))old.values.push(spec.value);facets.set(key,old);
 }
 return [...facets.values()].filter(facet=>facet.values.length<=40).slice(0,20).map(facet=>({...facet,values:facet.values.sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}))}));
}
export function filterShopProducts(products:Product[],filters:ShopFilters,lang='en'):Product[]{
 const minimum=filters.min?Number(filters.min)*100:0;const maximum=filters.max?Number(filters.max)*100:Infinity;
 const result=products.filter(product=>{
  if(!product.active||filters.q&&!matchesProduct(product,filters.q))return false;
  if(filters.categories.length&&!filters.categories.includes(product.category))return false;
  if(filters.brands.length&&!filters.brands.includes(product.brand||''))return false;
  if(filters.kinds.length&&!filters.kinds.includes(product.kind==='quote'?'quote':'direct'))return false;
  if((filters.min||filters.max)&&(product.price===null||product.price<minimum||product.price>maximum))return false;
  if(filters.documents&&!product.datasheet)return false;
  if(filters.sale&&!(product.price!==null&&product.oldPrice!==null&&product.oldPrice>product.price))return false;
  const specs=productSpecs(product);
  return Object.entries(filters.specs).every(([key,selected])=>!selected.length||specs.some(spec=>specKey(spec)===key&&selected.includes(spec.value)));
 });
 return result.sort((a,b)=>filters.sort==='price'?(a.price??Infinity)-(b.price??Infinity):filters.sort==='price_high'?(b.price??-1)-(a.price??-1):filters.sort==='new'?b.createdAt.localeCompare(a.createdAt):filters.sort==='name'?(lang==='ar'?a.nameAr:a.nameEn).localeCompare(lang==='ar'?b.nameAr:b.nameEn,lang):b.featured-a.featured);
}
export function filterCount(filters:ShopFilters){return filters.categories.length+filters.brands.length+filters.kinds.length+(filters.min||filters.max?1:0)+Number(filters.documents)+Number(filters.sale)+Object.values(filters.specs).reduce((sum,selected)=>sum+selected.length,0);}
export function shopUrl(filters:ShopFilters,lang:string,patch:Partial<ShopFilters>={}){
 const current={...filters,...patch};const query=new URLSearchParams();if(current.q)query.set('q',current.q);
 for(const value of current.categories)query.append('category',value);for(const value of current.brands)query.append('brand',value);for(const value of current.kinds)query.append('kind',value);
 if(current.min)query.set('min',current.min);if(current.max)query.set('max',current.max);if(current.documents)query.set('documents','1');if(current.sale)query.set('sale','1');
 for(const [key,selected]of Object.entries(current.specs))for(const value of selected)query.append('spec.'+key,value);
 if(current.sort!=='featured')query.set('sort',current.sort);if(current.page>1)query.set('page',String(current.page));
 return '/'+lang+'/shop'+(query.size?'?'+query.toString():'');
}
