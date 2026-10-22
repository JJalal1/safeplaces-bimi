'use client';
import {createContext,useContext,useState,useEffect,useCallback,useRef,type ReactNode} from 'react';
import {Search,ShoppingBag,Heart,UserRound,LogOut,Home,Store,Menu,X,Minus,Plus,ArrowLeft,ArrowRight,Trash2,Check,ChevronDown} from 'lucide-react';
import {local,money,type Lang} from '../lib/config';
import {productName,type Product} from '../lib/catalog';
import {EquipmentPhoto,ProductPhoto,referencePhotoSrc} from './visuals';
import {SearchBox} from './search';
import {Brand} from './brand';
import {useDialog} from './accessibility';
import {SignOutConfirmation} from './sign-out-confirmation';
import {customerLoginPath,type CustomerUser} from '../lib/customer-routes';
import {CART_STORAGE_KEY,emptyStore,restoreStore,serializeStore,replayStoreActions,type StoredItem,type StoredState} from '../lib/cart-persistence';
type Item=StoredItem;
type State=StoredState;
type Store={lang:Lang;state:State;add:(p:Product,type:'cart'|'quote',quantity?:number,feedback?:boolean)=>void;remove:(id:string,type:'cart'|'quote')=>void;quantity:(id:string,q:number,type:'cart'|'quote')=>void;selectCartItem:(id:string,selected:boolean)=>void;selectAllCartItems:(selected:boolean)=>void;removeSelectedCartItems:()=>void;removeCartItems:(ids:string[])=>void;startBuyNow:(p:Product,quantity:number)=>boolean;setBuyNowQuantity:(quantity:number)=>void;clearBuyNow:(expected?:Item)=>void;wish:(id:string)=>void;clear:(type:'cart'|'quote')=>void;view:(id:string)=>void;openCart:()=>void;notify:(s:string)=>void;user:CustomerUser|null;ready:boolean;authReady:boolean;signingOut:boolean;signOut:()=>Promise<void>};
const boundedQuantity=(quantity:number)=>Math.min(999,Math.max(1,Math.floor(Number.isFinite(quantity)?quantity:1)));
const productLine=(p:Product,quantity:number):Item=>({id:p.id,slug:p.slug,nameAr:p.nameAr,nameEn:p.nameEn,category:p.category,image:p.image,price:p.price,quantity:boundedQuantity(quantity),previewOnly:!!p.previewOnly,selected:true});
const initial:State=emptyStore();
const Context=createContext<Store|null>(null);
export const useStore=()=>{const store=useContext(Context);if(!store)throw new Error('Store unavailable');return store;};
export async function api<T=any>(path:string,data?:unknown):Promise<T>{const response=await fetch('/api/'+path,data===undefined?{credentials:'same-origin'}:{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});const result=await response.json() as any;if(!response.ok)throw new Error(result.error||'SERVER_ERROR');return result;}
export function errorText(error:unknown,lang:Lang){const code=error instanceof Error?error.message:'';const messages:Record<string,[string,string]>={
RECORD_CHANGED:['حُدّث الطلب بواسطة مسؤول آخر. احتفظ بأي نص غير محفوظ، ثم حدّث التفاصيل وراجع التغييرات قبل الحفظ.','Another administrator updated this request. Keep any unsaved text, then refresh details and review the changes before saving.'],
DRAFT_CHANGED:['تغيّرت المسودة بواسطة مسؤول آخر. انسخ نصك إن احتجته، ثم حدّث التفاصيل لمراجعة أحدث مسودة.','Another administrator changed the draft. Copy your text if needed, then refresh details to review the latest draft.'],
SEND_PENDING:['الإشعار قيد المعالجة أو تغيّرت حالته. حدّث التفاصيل وراجع الحالة قبل إعادة المحاولة.','The notification is being processed or its status has changed. Refresh details and review its status before retrying.'],
EMAIL_NOT_CONFIGURED:['خدمة إرسال البريد غير مفعّلة. يمكنك حفظ المسودة ومتابعة الطلب دون إرسال بريد.','Email sending is not enabled. You can save the draft and follow up without sending email.'],
DELIVERY_UNCERTAIN_REVIEW_REQUIRED:['نتيجة الإرسال السابق غير مؤكدة. تحقّق من سجل مزود البريد قبل تكرار الرسالة.','The previous sending result is uncertain. Check the email provider’s log before repeating the message.'],
IDEMPOTENCY_CONFLICT:['هذا الإرسال يتعارض مع عملية سابقة. راجع نتيجتها قبل إرسال التعديلات مرة أخرى.','This submission conflicts with an earlier operation. Review its result before submitting changes again.'],
TOO_LARGE:['المحتوى المرسل يتجاوز الحجم المسموح. قلّل طول النص أو عدد البنود ثم حاول مرة أخرى.','The submission exceeds the size limit. Shorten the text or reduce the number of items, then try again.'],
UNAUTHORIZED:['سجل الدخول لإتمام هذه العملية.','Sign in to continue.'],AUTH_NOT_CONFIGURED:['التسجيل في المتجر لم يُفتح بعد.','Shop registration is not open yet.'],AUTH_UNAVAILABLE:['خدمة تسجيل الدخول غير متاحة الآن. حاول لاحقًا.','Sign-in is temporarily unavailable. Please try later.'],AUTH_INVALID:['تعذر التحقق من بيانات الدخول أو انتهت صلاحية الرابط.','Sign-in details could not be verified or the link expired.'],EMAIL_NOT_CONFIRMED:['أكد بريدك من رسالة التفعيل قبل الدخول.','Confirm your email before signing in.'],PASSWORD_MISMATCH:['كلمتا المرور غير متطابقتين.','The passwords do not match.'],EMAIL_CHANGE_REQUIRES_VERIFICATION:['يحتاج تغيير بريد الحساب إلى تأكيد البريد الجديد.','Changing the account email requires verification.'],PRICE_REQUIRED:['أضف سعرًا معتمدًا للمنتجات المختارة قبل نشرها للبيع المباشر.','Add approved prices to the selected direct purchase products before publishing.'],NOT_FOUND:['السجل غير موجود. حدّث القائمة وحاول مجددًا.','The record could not be found. Refresh and try again.'],INVALID_BULK_ACTION:['هذا الإجراء غير متاح لهذا النوع من السجلات.','This action is not available for these records.'],GALLERY_LIMIT:['يمكن إضافة حتى 20 صورة للمعرض.','You can add up to 20 gallery images.'],INVALID_REGISTRATION_NUMBER:['رقم السجل أو الرقم الموحد يجب أن يتكون من 10 خانات.','Registration or unified number must contain 10 digits.'],INVALID_VAT_NUMBER:['رقم تسجيل VAT يجب أن يتكون من 15 خانة ويبدأ وينتهي بـ3.','VAT registration must contain 15 digits, beginning and ending with 3.'],BUSINESS_IDENTITY_INCOMPLETE:['أكمل اسم المؤسسة باللغتين ورقم السجل أو الرقم الموحد قبل اعتماد النشر.','Complete the company names and registration or unified number before approval.'],NATIONAL_ADDRESS_INCOMPLETE:['اعتمد بيانات السجل وأكمل العنوان الوطني باللغتين بعد مراجعته مع مستنده.','Approve the registration details and complete the national address in both languages after checking its record.'],VAT_VERIFICATION_REQUIRED:['اعتمد بيانات المؤسسة وأدخل رقم VAT الصحيح بعد مراجعة الشهادة.','Approve the company identity and enter a valid VAT number after checking its certificate.'],INVALID_IMAGE:['اختر صورة مرفوعة أو رابط HTTPS صحيح.','Choose an uploaded image or a valid HTTPS URL.'],VALIDATION:['راجع الحقول المطلوبة وصيغة بيانات التواصل.','Please check required fields and contact information.'],RATE_LIMIT:['طلبات كثيرة. حاول مجددًا بعد قليل.','Too many requests. Please try again later.'],PRODUCT_UNAVAILABLE:['أحد المنتجات غير متاح للشراء المباشر.','A product is not available for direct purchase.'],INVALID_COUPON:['الكوبون غير صالح أو انتهت صلاحيته.','The coupon is invalid or expired.'],COUPON_MINIMUM:['لم تصل قيمة الطلب للحد الأدنى للكوبون.','The coupon minimum order has not been met.'],COUPON_NOT_APPLICABLE:['الكوبون لا ينطبق على هذه المنتجات.','This coupon does not apply to these products.'],ORDER_CONFIRMATION_REQUIRED:['تواصل مع المبيعات لتأكيد تفاصيل الشراء والاستلام.','Contact sales to confirm purchase and collection details.'],FILE_TYPE:['الملف غير مدعوم. اختر PDF أو صورة أو XLSX.','Choose a PDF, image or XLSX file.'],FILE_TOO_LARGE:['الحد الأقصى للملف 10 ميجابايت.','The maximum file size is 10 MB.'],UPLOAD_UNAVAILABLE:['خدمة المرفقات غير متاحة حاليًا. يمكنك متابعة الطلب دون ملفات والمحاولة بعد عودة الخدمة.','Attachment storage is currently unavailable. You can continue without files and retry when the service is available.'],TEAM_EXISTS:['هذا البريد موجود بالفعل ضمن فريق الإدارة.','This email is already on the management team.'],TEAM_LIMIT:['تم الوصول إلى الحد الأقصى لأعضاء فريق الإدارة.','The management team member limit has been reached.'],FORBIDDEN:['ليس لديك صلاحية لهذا الإجراء.','You do not have permission for this action.']};return messages[code]?.[lang==='ar'?0:1]||local(lang,'تعذر إتمام العملية. حاول مرة أخرى أو تواصل معنا.','The operation could not be completed. Please retry or contact us.');}
export function StoreProvider({lang,children}:{lang:Lang;children:ReactNode}){
 const [user,setUser]=useState<CustomerUser|null>(null);const [authReady,setAuthReady]=useState(false);const [signingOut,setSigningOut]=useState(false);const wishBusy=useRef(new Set<string>());const wishQueue=useRef(Promise.resolve());const wishVersion=useRef(0);const [state,setState]=useState<State>(initial);const [loaded,setLoaded]=useState(false);const hydratedRef=useRef(false);const queuedChanges=useRef<Array<(s:State)=>State>>([]);const [cartOpen,setCartOpen]=useState(false);const [toast,setToast]=useState<{message:string;target:'cart'|'quote'|null}|null>(null);
 const currentState=useRef<State>(initial);
 const unsavedChanges=useRef<Array<(s:State)=>State>>([]);
 const readSaved=useCallback(()=>{try{return {...restoreStore(localStorage.getItem(CART_STORAGE_KEY)),wish:currentState.current.wish};}catch{return null;}},[]);
 const applyState=useCallback((next:State)=>{currentState.current=next;setState(next);},[]);
 const saveState=useCallback((next:State)=>{
  try{const serialized=serializeStore(next);if(localStorage.getItem(CART_STORAGE_KEY)!==serialized)localStorage.setItem(CART_STORAGE_KEY,serialized);unsavedChanges.current=[];return true;}catch{return false;}
 },[]);
 useEffect(()=>{
  if(hydratedRef.current)return;
  const restored=readSaved()||currentState.current;const pending=queuedChanges.current.splice(0);
  const next=replayStoreActions(restored,pending);hydratedRef.current=true;applyState(next);setLoaded(true);
  if(pending.length&&!saveState(next))unsavedChanges.current.push(...pending);
 },[readSaved,applyState,saveState]);
 const update=useCallback((fn:(s:State)=>State)=>{
  if(!hydratedRef.current){queuedChanges.current.push(fn);return;}
  // Rebase on storage at the moment of the action, so another tab's items survive.
  // Failed writes stay in memory and are replayed once storage is accessible again.
  const saved=readSaved();const base=saved?replayStoreActions(saved,unsavedChanges.current):currentState.current;
  const next=fn(base);applyState(next);
  const savedSuccessfully=saveState(next);if(!savedSuccessfully)unsavedChanges.current.push(fn);
  return savedSuccessfully;
 },[readSaved,applyState,saveState]);
 useEffect(()=>{
  const restoreLatest=()=>{
   if(!hydratedRef.current)return;const saved=readSaved();if(!saved)return;
   const next=replayStoreActions(saved,unsavedChanges.current);
   if(serializeStore(next)!==serializeStore(currentState.current))applyState(next);
   // A storage event never writes back unless this tab has unsaved local actions.
   if(unsavedChanges.current.length)saveState(next);
  };
  const storageChanged=(event:StorageEvent)=>{if(event.key===null||event.key===CART_STORAGE_KEY)restoreLatest();};
  const pageShown=(event:PageTransitionEvent)=>{if(event.persisted)restoreLatest();};
  window.addEventListener('storage',storageChanged);window.addEventListener('pageshow',pageShown);
  return()=>{window.removeEventListener('storage',storageChanged);window.removeEventListener('pageshow',pageShown);};
 },[readSaved,applyState,saveState]);
 // Account-backed favourites must not write an older basket back to local storage.
 const applyWishlist=useCallback((wish:string[])=>applyState({...currentState.current,wish}),[applyState]);
 useEffect(()=>{let cancelled=false;const version=wishVersion.current;api('session?scope=customer').then(async session=>{if(cancelled)return;setUser(session.user);setAuthReady(true);if(!session.user){applyWishlist([]);return;}let result=await api('wishlist');const pending=sessionStorage.getItem('safeplaces-save-after-login');if(pending){sessionStorage.removeItem('safeplaces-save-after-login');result=await api('wishlist',{id:pending,action:'add'});}if(!cancelled&&wishVersion.current===version)applyWishlist(result.ids);}).catch(()=>{if(!cancelled){setAuthReady(true);applyWishlist([]);}});return()=>{cancelled=true;};},[applyWishlist]);
 const announce=(message:string,target:'cart'|'quote'|null=null)=>setToast({message,target});
 // A sign-out must invalidate the server-side session, not just update the displayed label.
 async function signOut(){
  if(!user||signingOut)return;
  setSigningOut(true);
  try{
   if(user.provider==='standalone'){
    const {authClient}=await import('../lib/auth-client');
    const result=await authClient.signOut();
    if(result.error)throw new Error('AUTH_INVALID');
   }else if(user.provider==='supabase'){
    await api('auth/logout',{});
   }else{
    throw new Error('AUTH_UNAVAILABLE');
   }
   setUser(null);applyWishlist([]);
   window.location.assign('/'+lang);
  }catch(error){
   setSigningOut(false);throw error;
  }
 }
 useEffect(()=>{if(!toast)return;const timer=setTimeout(()=>setToast(null),3500);return()=>clearTimeout(timer);},[toast]);
 useDialog(cartOpen,'.cart-drawer',()=>setCartOpen(false));
 const add=(p:Product,_type:'cart'|'quote',quantity=1,feedback=true)=>{const amount=boundedQuantity(quantity);update(s=>{const found=s.quote.find(i=>i.id===p.id);const row={...productLine(p,amount),price:null,previewOnly:false};return {...s,quote:found?s.quote.map(i=>i.id===p.id?{...row,quantity:Math.min(i.quantity+amount,999)}:i):[...s.quote,row]};});if(feedback)announce(local(lang,'أُضيف المنتج إلى طلب عرض السعر','Added to your quote request'),'quote');};
 const remove=(id:string,type:'cart'|'quote')=>update(s=>({...s,[type]:s[type].filter(i=>i.id!==id)}));
 const quantity=(id:string,q:number,type:'cart'|'quote')=>update(s=>({...s,[type]:s[type].map(i=>i.id===id?{...i,quantity:boundedQuantity(q)}:i)}));
 const selectCartItem=(id:string,selected:boolean)=>update(s=>({...s,cart:s.cart.map(i=>i.id===id?{...i,selected}:i)}));
 const selectAllCartItems=(selected:boolean)=>update(s=>({...s,cart:s.cart.map(i=>({...i,selected}))}));
 const removeSelectedCartItems=()=>update(s=>({...s,cart:s.cart.filter(i=>i.selected===false)}));
 const removeCartItems=(ids:string[])=>{const selected=new Set(ids);update(s=>({...s,cart:s.cart.filter(i=>!selected.has(i.id))}));};
 // A direct-purchase intent is independent of the basket, including existing quantities.
 // Only leave the product page after persistence succeeds; failed writes remain retryable.
 const startBuyNow=(_p:Product,_amount:number)=>false;
 const setBuyNowQuantity=(q:number)=>update(s=>({...s,buyNow:s.buyNow?{...s.buyNow,quantity:boundedQuantity(q)}:null}));
 const clearBuyNow=(expected?:Item)=>update(s=>!expected||JSON.stringify(s.buyNow)===JSON.stringify(expected)?{...s,buyNow:null}:s);
 const wish=(id:string)=>{if(wishBusy.current.has(id))return;wishBusy.current.add(id);wishVersion.current++;wishQueue.current=wishQueue.current.then(async()=>{try{const session=await api('session?scope=customer');setUser(session.user);if(!session.user){sessionStorage.setItem('safeplaces-save-after-login',id);window.location.assign(customerLoginPath(lang,window.location.pathname+window.location.search,'wishlist'));return;}const result=await api('wishlist',{id,action:currentState.current.wish.includes(id)?'remove':'add'});applyWishlist(result.ids);}catch(error){announce(errorText(error,lang));}finally{wishBusy.current.delete(id);}});};
 const clear=(type:'cart'|'quote')=>update(s=>({...s,[type]:[]}));
 const view=useCallback((id:string)=>update(s=>s.recent[0]===id?s:{...s,recent:[id,...s.recent.filter(x=>x!==id)].slice(0,8)}),[update]);
 return <Context.Provider value={{lang,state,user,ready:loaded,authReady,signingOut,signOut,add,remove,quantity,selectCartItem,selectAllCartItems,removeSelectedCartItems,removeCartItems,startBuyNow,setBuyNowQuantity,clearBuyNow,wish,clear,view,openCart:()=>setCartOpen(true),notify:(message:string)=>announce(message)}}>{children}{toast&&<div className="toast" role="status"><Check size={18}/><span>{toast.message}</span>{toast.target&&<a href={'/'+lang+'/'+(toast.target==='cart'?'cart':'quote')}>{toast.target==='cart'?local(lang,'عرض السلة','View cart'):local(lang,'مراجعة الطلب','Review request')}</a>}</div>}{cartOpen&&<div className="drawer-backdrop" onClick={()=>setCartOpen(false)}><aside className="cart-drawer" role="dialog" aria-modal="true" aria-label={local(lang,'طلب عرض سعر','Quote request')} onClick={e=>e.stopPropagation()}><div className="drawer-heading"><h2>{local(lang,'قائمة طلب العرض','Your quote list')}</h2><button className="icon-button" aria-label={local(lang,'إغلاق','Close')} onClick={()=>setCartOpen(false)}><X/></button></div><CartLines type="quote" compact/>{!!state.quote.length&&<div className="drawer-bottom"><a className="button primary" href={'/'+lang+'/quote'} onClick={()=>setCartOpen(false)}>{local(lang,'إكمال طلب عرض السعر','Complete quote request')}</a></div>}</aside></div>}</Context.Provider>;
}
export function Header({path,phone,products,categories,query='',preview=false,checkoutIntent=false}:{path:string;phone:string;products:Product[];categories:{slug:string;ar:string;en:string}[];query?:string;preview?:boolean;checkoutIntent?:boolean}){
 const {lang,state,user,authReady,signOut,signingOut}=useStore();const [menu,setMenu]=useState(false),[departments,setDepartments]=useState(false),[moreOpen,setMoreOpen]=useState(false),[searchOpen,setSearchOpen]=useState(!!query);
 const headerRef=useRef<HTMLElement>(null);
 useEffect(()=>{const close=(e:KeyboardEvent)=>{if(e.key==='Escape'){setMenu(false);setDepartments(false);if(searchOpen&&window.matchMedia('(max-width:650px)').matches&&headerRef.current?.contains(document.activeElement))headerRef.current.querySelector<HTMLButtonElement>('.mobile-search-toggle')?.focus();setSearchOpen(false);}};document.addEventListener('keydown',close);return()=>document.removeEventListener('keydown',close);},[searchOpen]);
 useEffect(()=>{if(searchOpen)headerRef.current?.querySelector<HTMLInputElement>('.market-search input')?.focus();},[searchOpen]);
 useEffect(()=>{const phones=window.matchMedia('(max-width:650px)');const resized=()=>{if(!phones.matches)setMoreOpen(false);};phones.addEventListener('change',resized);return()=>phones.removeEventListener('change',resized);},[]);
 useDialog(moreOpen,'.mobile-more-sheet',()=>setMoreOpen(false));
 const root='/'+lang,cartCount=state.quote.reduce((sum,item)=>sum+item.quantity,0);
 const productDetail=path.startsWith('shop/')&&!path.startsWith('shop/category/')&&path.split('/').length===2;
 const cartActive=path==='quote',accountActive=path==='account'||path.startsWith('account/');
 const languagePath='/'+(lang==='ar'?'en':'ar')+(path?'/'+path:'');
 const canSignOut=user?.provider==='standalone'||user?.provider==='supabase';
 const accountLabel=authReady&&!user?local(lang,'تسجيل الدخول','Sign in'):local(lang,'حسابي','My account');
 const logoutLabel=local(lang,'تسجيل الخروج','Sign out');
 const backPath=productDetail||path==='quote'?root+'/shop':root;
 const entries=[['','الرئيسية','Home'],['shop','تسوق المنتجات','Shop'],['services','خدماتنا','Services'],['about','من نحن','About us'],['projects','المشاريع','Projects'],['contact','تواصل معنا','Contact']];
 return <><div className="topbar"><div className="container"><span>{local(lang,'معدات السلامة والحماية من الحريق · الخبر، السعودية','Safety & fire protection equipment · Al Khobar, Saudi Arabia')}</span><div className="topbar-links"><a href={'tel:'+phone} dir="ltr">{phone}</a><a href={languagePath} className="language">{lang==='ar'?'English':'العربية'}</a>{canSignOut?<SignOutConfirmation lang={lang} className="site-auth-signout site-auth-topbar" onConfirm={signOut} disabled={signingOut} formatError={error=>errorText(error,lang)}><LogOut size={14} aria-hidden="true"/>{logoutLabel}</SignOutConfirmation>:<a className="site-auth-topbar-login" href={root+'/account'}>{accountLabel}</a>}</div></div></div>
 <header ref={headerRef} className={'site-header marketplace-header'+(searchOpen?' is-search-open':'')}>
  <div className="container header-inner">
   <div className="mobile-header-leading"><a className="icon-button mobile-back" href={backPath} aria-label={local(lang,'العودة','Go back')}>{lang==='ar'?<ArrowRight size={23}/>:<ArrowLeft size={23}/>}</a><button type="button" className="icon-button mobile-menu-toggle" aria-label={local(lang,'القائمة والأقسام','Menu and categories')} aria-haspopup="dialog" aria-expanded={moreOpen} aria-controls="mobile-more-panel" onClick={()=>{setMoreOpen(true);setSearchOpen(false);}}><Menu size={24}/></button></div>
   <Brand lang={lang}/>
   <div className="header-search" id="store-header-search"><SearchBox lang={lang} products={products} categories={categories} query={query}/></div>
   <div className="header-tools">
    <button type="button" className="icon-button mobile-search-toggle" aria-label={searchOpen?local(lang,'إغلاق البحث','Close search'):local(lang,'البحث في المنتجات','Search products')} aria-expanded={searchOpen} aria-controls="store-header-search" onClick={()=>setSearchOpen(!searchOpen)}>{searchOpen?<X size={23}/>:<Search size={23}/>}</button>
    <a className={'header-tool account-link'+(accountActive?' active':'')} href={root+'/account'} aria-label={accountLabel} aria-current={accountActive?'page':undefined}><UserRound size={23}/><span>{accountLabel}</span></a>
    <a className="header-tool header-wishlist" href={root+'/wishlist'}><Heart size={23}/><span>{local(lang,'المفضلة','Saved')}</span></a>
    <a className={'header-tool bag'+(cartActive?' active':'')} href={root+'/quote'} aria-label={local(lang,'قائمة طلب العرض','Quote list')+(cartCount?' ('+cartCount+')':'')} aria-current={path==='quote'?'page':undefined}><ShoppingBag size={23}/>{cartCount>0&&<b>{cartCount}</b>}<span>{local(lang,'طلب عرض','Quote list')}</span></a>
    <button type="button" className="icon-button menu-toggle" aria-label={local(lang,'القائمة','Menu')} aria-expanded={menu} onClick={()=>{setMenu(!menu);setDepartments(false);}}>{menu?<X/>:<Menu/>}</button>
   </div>
  </div>
  <div className="navigation-bar"><div className="container navigation-inner"><div className="department-menu"><button type="button" className="departments-toggle" aria-expanded={departments} aria-controls="department-links" onClick={()=>{setDepartments(!departments);setMenu(false);}}><Menu size={18}/>{local(lang,'جميع الأقسام','All categories')}<ChevronDown size={14}/></button>{departments&&<nav id="department-links" className="department-links" aria-label={local(lang,'أقسام المتجر','Shop categories')}>{categories.map(c=><a key={c.slug} href={root+'/shop/category/'+c.slug}>{local(lang,c.ar,c.en)}{lang==='ar'?<ArrowLeft size={15}/>:<ArrowRight size={15}/>}</a>)}</nav>}</div><nav className={menu?'main-nav is-open':'main-nav'} aria-label={local(lang,'القائمة الرئيسية','Main navigation')}>{entries.map(([slug,ar,en])=><a key={slug} href={root+(slug?'/'+slug:'')} className={(path===slug||!!slug&&path.startsWith(slug+'/'))?'active':''} aria-current={path===slug?'page':undefined}>{local(lang,ar,en)}</a>)}<div className="mobile-nav-tools"><a href={root+'/account'}>{local(lang,'حسابي','My account')}</a><a href={root+'/wishlist'}>{local(lang,'المفضلة','Wishlist')}</a><a href={root+'/quote'}>{local(lang,'المشاريع وطلب عرض سعر','Project quotations')}</a></div></nav><a className="nav-project-link" href={root+'/quote'}>{local(lang,'حلول المشاريع وطلب عرض سعر','Projects & quotations')}{lang==='ar'?<ArrowLeft size={16}/>:<ArrowRight size={16}/>}</a></div></div>
 </header>{preview&&<div className="demo-strip"><div className="container">{local(lang,'نسخة المعاينة: الأسعار الموسومة «تجريبية» للتصميم فقط. إرسال الشراء بهذه الأسعار معطل.','Review version: prices marked “Demo” are for preview only. Ordering at these prices is disabled.')}</div></div>}
 <nav className={'mobile-shopping-nav'+(productDetail?' on-product':'')} aria-label={local(lang,'التنقل الرئيسي','Primary navigation')}>
  <a className={!path?'active':''} aria-current={!path?'page':undefined} href={root}><Home size={22}/>{local(lang,'الرئيسية','Home')}</a>
  <a className={path.startsWith('shop')?'active':''} aria-current={path.startsWith('shop')?'page':undefined} href={root+'/shop'}><Store size={22}/>{local(lang,'التسوق','Shop')}</a>
  <a className={cartActive?'active':''} aria-current={path==='quote'?'page':undefined} href={root+'/quote'}><ShoppingBag size={22}/>{local(lang,'طلب عرض','Quote')}{cartCount>0&&<b>{cartCount}</b>}</a>
  <a className={accountActive?'active':''} aria-current={accountActive?'page':undefined} href={root+'/account'}><UserRound size={22}/>{accountLabel}</a>
 </nav>
 {moreOpen&&<div className="mobile-more-backdrop" onClick={()=>setMoreOpen(false)}>
   <section className="mobile-more-sheet" id="mobile-more-panel" role="dialog" aria-modal="true" aria-label={local(lang,'المزيد من صفحات الموقع','More pages')} onClick={e=>e.stopPropagation()}>
     <div className="mobile-more-heading"><h2>{local(lang,'المؤسسة والخدمات','Company & services')}</h2><button type="button" aria-label={local(lang,'إغلاق القائمة','Close menu')} className="icon-button" onClick={()=>setMoreOpen(false)}><X size={22}/></button></div>
     <div className="mobile-menu-utilities"><a className="mobile-language" href={languagePath}>{lang==='ar'?'English':'العربية'}</a><a href={'tel:'+phone} dir="ltr">{phone}</a></div>
      <div className="mobile-account-actions"><a href={root+'/account'}><UserRound size={18}/>{accountLabel}</a>{canSignOut&&<SignOutConfirmation lang={lang} className="site-auth-signout" onConfirm={signOut} disabled={signingOut} formatError={error=>errorText(error,lang)}><LogOut size={18} aria-hidden="true"/>{logoutLabel}</SignOutConfirmation>}</div>
     <nav className="mobile-more-links" aria-label={local(lang,'الخدمات والصفحات الأخرى','Services and other pages')}>
       {([['services','الخدمات','Services'],['projects','المشاريع','Projects'],['quote','طلب عرض سعر','Request a quote'],['wishlist','المفضلة','Wishlist'],['contact','تواصل معنا','Contact'],['about','من نحن','About us'],['certificates','المستندات والشهادات','Documents & certificates']] as const).map(([slug,ar,en])=><a key={slug} href={root+'/'+slug} aria-current={path===slug?'page':undefined}>{local(lang,ar,en)}{lang==='ar'?<ArrowLeft size={16}/>:<ArrowRight size={16}/>}</a>)}
     </nav>
     <h3 className="mobile-menu-categories-title">{local(lang,'أقسام المتجر','Shop categories')}</h3>
     <nav className="mobile-more-links mobile-category-links" aria-label={local(lang,'أقسام المتجر','Shop categories')}>{categories.map(c=><a key={c.slug} href={root+'/shop/category/'+c.slug}>{local(lang,c.ar,c.en)}{lang==='ar'?<ArrowLeft size={16}/>:<ArrowRight size={16}/>}</a>)}</nav>
   </section>
 </div>}</>;
}
export function ProductActions({product,small=false,showWish=true}:{product:Product;small?:boolean;showWish?:boolean}){
 const {lang,add,wish,state}=useStore();const [quantity,setQuantity]=useState(1);
 const saved=state.wish.includes(product.id);
 const wishButton=showWish&&<button type="button" className={'icon-button wish-button '+(saved?'saved':'')} aria-label={saved?local(lang,'إزالة من المفضلة','Remove from wishlist'):local(lang,'حفظ في المفضلة','Save to wishlist')} aria-pressed={saved} onClick={()=>wish(product.id)}><Heart size={20}/></button>;
 const addButton=<button type="button" className="button primary request-quote" onClick={()=>add(product,'quote',small?1:quantity)}>{local(lang,'إضافة لطلب عرض سعر','Add to quote request')}{lang==='ar'?<ArrowLeft size={16}/>:<ArrowRight size={16}/>}</button>;
 if(small)return <div className="product-actions small quoted">{addButton}{wishButton}</div>;
 return <div className="product-actions product-purchase-actions quoted"><div className="product-choice-row"><div className="product-quantity-choice"><span>{local(lang,'الكمية المطلوبة','Required quantity')}</span><Quantity value={quantity} onChange={q=>setQuantity(boundedQuantity(q))}/></div>{wishButton}</div><div className="product-purchase-bar" role="group" aria-label={local(lang,'خيارات طلب عرض السعر','Quotation options')}>{addButton}<a className="button light review-quote" href={'/'+lang+'/quote'}>{local(lang,'مراجعة طلب العرض','Review quote list')}</a></div></div>;
}
export function ProductGallery({product}:{product:Product&{gallery?:string}}){const {lang}=useStore();const images=[product.image||referencePhotoSrc(product),...JSON.parse(product.gallery||'[]')].filter(Boolean) as string[];const [selected,setSelected]=useState(0);const [zoom,setZoom]=useState(false);useDialog(zoom,'.image-zoom',()=>setZoom(false));return <div className="product-gallery">{images.length?<button className="gallery-main" aria-label={local(lang,'تكبير الصورة','Enlarge image')} onClick={()=>setZoom(true)}><img src={images[selected]} alt={productName(product,lang)} width="600" height="500"/></button>:<><ProductPhoto product={product} lang={lang}/></>}{!product.image&&<span className="illustration-label">{local(lang,'صورة توضيحية — تُعتمد الصور والمواصفات النهائية قبل البيع','Reference image — final imagery and specifications to be confirmed')}</span>}{images.length>1&&<div className="gallery-thumbnails">{images.map((src,i)=><button key={src} onClick={()=>setSelected(i)} aria-label={local(lang,'الصورة '+(i+1),'Image '+(i+1))} className={i===selected?'selected':''}><img src={src} alt="" width="70" height="70"/></button>)}</div>}{zoom&&<div className="image-zoom" role="dialog" aria-modal="true" aria-label={local(lang,'عرض صورة المنتج','Product image viewer')} onClick={()=>setZoom(false)}><button className="icon-button" aria-label={local(lang,'إغلاق','Close')}><X/></button><img src={images[selected]} alt={productName(product,lang)}/></div>}</div>;}
export function RecentRecorder({id}:{id:string}){const {view}=useStore();useEffect(()=>view(id),[id,view]);return null;}
export function Quantity({value,onChange}:{value:number;onChange:(n:number)=>void}){const {lang}=useStore();return <div className="quantity"><button type="button" aria-label={local(lang,'تقليل الكمية','Decrease quantity')} onClick={()=>onChange(value-1)} disabled={value<=1}><Minus size={14}/></button><input type="number" aria-label={local(lang,'الكمية','Quantity')} min="1" max="999" step="1" inputMode="numeric" value={value} onChange={e=>onChange(boundedQuantity(Number(e.target.value)))}/><button type="button" aria-label={local(lang,'زيادة الكمية','Increase quantity')} onClick={()=>onChange(value+1)} disabled={value>=999}><Plus size={14}/></button></div>;}
export function CartLines({compact=false,type='cart',items,selectable=false,onQuantity,onRemove}:{compact?:boolean;type?:'cart'|'quote';items?:StoredItem[];selectable?:boolean;onQuantity?:(id:string,quantity:number)=>void;onRemove?:(id:string)=>void}){
 const {lang,state,remove,quantity,selectCartItem,ready}=useStore();const rows=items??state[type];
 if(!ready)return <div className="cart-loading" role="status" aria-live="polite">{local(lang,'جارٍ استعادة المنتجات المحفوظة…','Restoring your saved items…')}</div>;
 if(!rows.length)return <div className="empty-state"><ShoppingBag size={36}/><h3>{local(lang,type==='cart'?'السلة فارغة حاليًا':'لم تضف منتجات لطلب العرض بعد',type==='cart'?'Your cart is empty':'No products added yet')}</h3><p>{local(lang,'استكشف المنتجات والخدمات واختر ما يناسب احتياجك.','Explore our products and services to find what you need.')}</p><a className="button primary" href={'/'+lang+'/shop'}>{local(lang,'استعرض المنتجات','Explore products')}</a></div>;
 return <div className={'cart-lines '+(compact?'compact':'')+(selectable?' selectable':'')}>{rows.map(i=><div className={'cart-line'+(selectable?(i.selected===false?' is-unselected':' is-selected'):'')} key={i.id}>
  {selectable&&<label className="cart-item-select"><input type="checkbox" checked={i.selected!==false} onChange={e=>selectCartItem(i.id,e.target.checked)}/><span className="sr-only">{local(lang,'تحديد '+i.nameAr,'Select '+i.nameEn)}</span></label>}
  <a className="cart-thumb" href={'/'+lang+'/shop/'+i.slug}>{i.image?<img src={i.image} alt="" width="96" height="96" loading="lazy"/>:<ProductPhoto product={i} lang={lang}/>}</a>
  <div className="cart-item-content"><a className="line-name" href={'/'+lang+'/shop/'+i.slug}>{lang==='ar'?i.nameAr:i.nameEn}</a><small className="cart-item-price"><strong>{local(lang,'طلب عرض سعر','Request a quotation')}</strong>{type==='cart'&&i.previewOnly&&<span className="demo-price-label">{local(lang,'سعر تجريبي','Demo price')}</span>}</small><div className="cart-item-controls"><Quantity value={i.quantity} onChange={q=>onQuantity?onQuantity(i.id,q):quantity(i.id,q,type)}/></div></div>
  <button type="button" className="icon-button remove-button" aria-label={local(lang,'حذف المنتج','Remove item')} onClick={()=>onRemove?onRemove(i.id):remove(i.id,type)}><Trash2 size={18}/></button>
 </div>)}</div>;
}
export function Wishlist({products}:{products:Product[]}){const {lang,state}=useStore();const rows=products.filter(p=>state.wish.includes(p.id));return rows.length?<div className="product-grid">{rows.map(p=><div className="product-card" key={p.id}><a href={'/'+lang+'/shop/'+p.slug}>{p.image?<div className="product-art"><img src={p.image} alt={productName(p,lang)} loading="lazy"/></div>:<EquipmentPhoto category={p.category} lang={lang} caption/>}<h3>{productName(p,lang)}</h3></a><p>{p.price===null?local(lang,'التسعير حسب الطلب','Pricing on request'):money(p.price,lang)}</p><ProductActions product={p} small/></div>)}</div>:<div className="empty-state"><Heart size={36}/><h3>{local(lang,'احتفظ بالمنتجات التي تهمك هنا','Keep your favourite products here')}</h3><a href={'/'+lang+'/shop'} className="button primary">{local(lang,'تصفح المنتجات','Browse products')}</a></div>;}

