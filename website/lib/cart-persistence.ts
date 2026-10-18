/** Local guest-cart persistence. Never trusts browser prices for server orders. */
export const CART_STORAGE_KEY='safeplaces-store';
export type StoredItem={
 id:string;slug:string;nameAr:string;nameEn:string;category:string;
 image:string|null;price:number|null;quantity:number;previewOnly?:boolean;selected?:boolean
};
export type StoredState={cart:StoredItem[];quote:StoredItem[];wish:string[];recent:string[];buyNow:StoredItem|null};
export const emptyStore=():StoredState=>({cart:[],quote:[],wish:[],recent:[],buyNow:null});

function readLines(value:unknown):StoredItem[]{
 if(!Array.isArray(value))return [];
 const lines:StoredItem[]=[];const seen=new Set<string>();
 for(const raw of value.slice(0,300)){
  if(!raw||typeof raw!=='object')continue;
  const line=raw as Record<string,unknown>;
  if(typeof line.id!=='string'||!line.id||line.id.length>180||seen.has(line.id))continue;
  if(typeof line.slug!=='string'||!line.slug||line.slug.length>180)continue;
  if(line.price!==null&&(typeof line.price!=='number'||!Number.isFinite(line.price)||line.price<0||line.price>1e11))continue;
  const nameAr=typeof line.nameAr==='string'?line.nameAr:line.slug;
  const nameEn=typeof line.nameEn==='string'?line.nameEn:line.slug;
  const category=typeof line.category==='string'?line.category:'';
  const image=typeof line.image==='string'&&(line.image.startsWith('/')||line.image.startsWith('https://'))?line.image:null;
  const number=typeof line.quantity==='number'&&Number.isFinite(line.quantity)?line.quantity:1;
  lines.push({id:line.id,slug:line.slug,nameAr,nameEn,category,image,price:line.price as number|null,
   quantity:Math.max(1,Math.min(999,Math.floor(number))),previewOnly:line.previewOnly===true,selected:line.selected!==false});
  seen.add(line.id);
 }
 return lines;
}
/** Migrates existing 'safeplaces-store' data without discarding valid guest items. */
export function restoreStore(raw:string|null):StoredState{
 if(!raw)return emptyStore();
 try{
  const data=JSON.parse(raw) as Record<string,unknown>|null;
  if(!data||typeof data!=='object')return emptyStore();
  return {cart:readLines(data.cart),quote:readLines(data.quote),wish:[],buyNow:readLines([data.buyNow])[0]||null,
   recent:Array.isArray(data.recent)?data.recent.filter((v):v is string=>typeof v==='string'&&v.length<=180).slice(0,8):[]};
 }catch{return emptyStore();}
}
/** Wishlists are account-backed; guest cart and quote remain local across routes. */
export function serializeStore(state:StoredState):string{
 return JSON.stringify({cart:state.cart,quote:state.quote,wish:[],recent:state.recent,buyNow:state.buyNow??null});
}
/** Replays actions occurring during first client hydration on top of the restored basket. */
export function replayStoreActions(state:StoredState,actions:((s:StoredState)=>StoredState)[]):StoredState{
 return actions.reduce((value,fn)=>fn(value),state);
}
