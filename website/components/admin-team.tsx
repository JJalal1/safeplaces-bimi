'use client';
import {useEffect,useState,type FormEvent} from 'react';
import {ShieldCheck,Users,Save,UserRoundX,UserRoundCheck,Plus,LoaderCircle,RefreshCw} from 'lucide-react';
import {api,errorText} from './store';
import {local,type Lang} from '../lib/config';
import {ADMIN_PERMISSIONS,type AdminPermission} from '../lib/admin-permissions';

type Member={id:string;email:string;permissions:AdminPermission[];linked:boolean;active:boolean;createdAt:string};
const labels:Record<AdminPermission,[string,string]>={
 dashboard:['نظرة عامة','Overview'],orders:['طلبات الشراء','Orders'],quotes:['عروض الأسعار','Quotes'],
 contacts:['رسائل التواصل','Messages'],products:['المنتجات','Products'],category:['الأقسام','Categories'],
 brand:['العلامات التجارية','Brands'],customers:['العملاء','Customers'],coupons:['الكوبونات','Coupons'],
 homepage:['الرئيسية ومن نحن','Home & about'],service:['الخدمات','Services'],project:['المشاريع','Projects'],
 client:['العملاء السابقون','Previous clients'],certificate:['الشهادات','Certificates'],
 activity:['سجل التغييرات','Activity log'],settings:['إعدادات المؤسسة','Store settings']
};
const starter:AdminPermission[]=['orders','quotes'];

function PermissionPicker({lang,value,disabled,onChange}:{lang:Lang;value:AdminPermission[];disabled:boolean;onChange:(value:AdminPermission[])=>void}){
 return <div className="form-grid">{ADMIN_PERMISSIONS.map(permission=>
  <label className="consent" key={permission}><input type="checkbox" checked={value.includes(permission)} disabled={disabled}
   onChange={event=>onChange(event.target.checked?[...value,permission]:value.filter(item=>item!==permission))}/>
   {local(lang,...labels[permission])}</label>)}</div>;
}

/** Owner-only interface; all mutations are independently owner-checked by the API. */
export function AdminTeam({lang}:{lang:Lang}){
 const [members,setMembers]=useState<Member[]>([]);
 const [drafts,setDrafts]=useState<Record<string,AdminPermission[]>>({});
 const [email,setEmail]=useState(''),[permissions,setPermissions]=useState<AdminPermission[]>(starter);
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState('');
 async function refresh(){
  setLoading(true);
  try{
   const result=await api<{members:Member[]}>('admin/team');
   setMembers(result.members);
   setDrafts(Object.fromEntries(result.members.map(member=>[member.id,member.permissions])));
   setError('');
  }catch(err){setError(errorText(err,lang));}finally{setLoading(false);}
 }
 useEffect(()=>{void refresh();},[]);
 async function invite(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(busy||!permissions.length)return;setBusy(true);setError('');setNotice('');
  try{
   await api('admin/team',{email:email.trim(),permissions});
   setEmail('');setPermissions(starter);
   setNotice(local(lang,'تم اعتماد البريد. يجب أن يسجل الشخص دخولًا بحساب Google المطابق.','Email approved. The person must sign in with the matching Google account.'));
   await refresh();
  }catch(err){setError(errorText(err,lang));}finally{setBusy(false);}
 }
 async function update(id:string){
  const selected=drafts[id]||[];if(busy||!selected.length)return;
  setBusy(true);setError('');setNotice('');
  try{
   await api('admin/team/update',{id,permissions:selected});
   setNotice(local(lang,'تم تعديل الصلاحيات. يسجل الموظف الدخول مجددًا لاستخدام الصلاحيات المحدّثة.','Permissions updated. The staff member signs in again to use the updated permissions.'));
   await refresh();
  }catch(err){setError(errorText(err,lang));}finally{setBusy(false);}
 }
 async function restore(member:Member){
  const selected=drafts[member.id]||[];
  if(busy||!selected.length)return;
  setBusy(true);setError('');setNotice('');
  try{
   await api('admin/team/restore',{id:member.id,permissions:selected});
   setNotice(local(lang,'تمت إعادة اعتماد الموظف بالصلاحيات المحددة. يمكنه تسجيل الدخول بحسابه المعتمد.','Staff access restored with the selected permissions. They can sign in with the approved account.'));
   await refresh();
  }catch(err){setError(errorText(err,lang));}finally{setBusy(false);}
 }
 async function revoke(member:Member){
  if(busy||!window.confirm(local(lang,'هل تريد إلغاء صلاحيات هذا الشخص فورًا؟','Revoke this person’s access immediately?')))return;
  setBusy(true);setError('');setNotice('');
  try{
   await api('admin/team/revoke',{id:member.id});
   setNotice(local(lang,'تم إلغاء الوصول الإداري وإنهاء جلسات الحساب. حُفظ سجل الاعتماد للمراجعة.','Administrative access and account sessions revoked. The approval record is retained for review.'));
   await refresh();
  }catch(err){setError(errorText(err,lang));}finally{setBusy(false);}
 }
 return <div className="console-settings-form">
  <section className="management-card">
   <h3><ShieldCheck size={20}/>{local(lang,'مالك واحد، فريق بصلاحيات محددة','One owner, restricted staff accounts')}</h3>
   <p>{local(lang,'حسابك هو المالك الرئيسي الوحيد. يعتمد الموظف هنا بصلاحيات محددة، ثم يسجل الدخول بحساب Google الخاص به.','You are the sole primary owner. Approve each staff member with specific permissions, then they sign in with their own Google account.')}</p>
   <p>{local(lang,'يرتبط الاعتماد بهوية الحساب عند أول دخول. يمكنك إيقاف الوصول وإعادته للحساب نفسه من قائمة الفريق.','Approval is bound to the account identity at first sign-in. You can revoke and restore access for that same account below.')}</p>
   <p>{local(lang,'أثناء وضع اختبار Google، يجب إضافة بريد الموظف كذلك إلى المستخدمين التجريبيين في Google Cloud.','While Google OAuth remains in Testing, add each staff email to Google Cloud test users too.')}</p>
  </section>
  {error&&<p className="form-error" role="alert">{error}</p>}
  {notice&&<p className="notice" role="status">{notice}</p>}
  <section className="management-card">
   <h3><Plus size={19}/>{local(lang,'إضافة شخص إلى فريق الإدارة','Approve a staff member')}</h3>
   <form onSubmit={invite}>
    <label className="field"><span>{local(lang,'بريد حساب Google للشخص','Staff Google email')}</span>
     <input dir="ltr" type="email" autoComplete="off" required maxLength={200} value={email} onChange={event=>setEmail(event.target.value)} placeholder="employee@example.com" disabled={busy}/>
    </label>
    <p>{local(lang,'حدد فقط الأقسام التي سيسمح لهذا الشخص بعرضها وإدارتها:','Select only the sections this person may access and manage:')}</p>
    <PermissionPicker lang={lang} value={permissions} disabled={busy} onChange={setPermissions}/>
    <button type="submit" className="button primary" disabled={busy||permissions.length===0||!email.trim()}>{busy?<LoaderCircle className="spin" size={17}/>:<Plus size={17}/>}
     {local(lang,'اعتماد هذا الشخص','Approve staff member')}</button>
   </form>
  </section>
  <section className="management-card">
   <h3><Users size={19}/>{local(lang,'فريق الإدارة وسجل الوصول','Management team & access history')}</h3>
   {!loading&&<p>{local(lang,'حسابات فعّالة: ','Active accounts: ')}{members.filter(member=>member.active).length} · {local(lang,'حسابات موقوفة: ','Revoked accounts: ')}{members.filter(member=>!member.active).length}</p>}
   <button type="button" className="button light small-button" disabled={loading||busy} onClick={()=>void refresh()}><RefreshCw size={15}/>{local(lang,'تحديث','Refresh')}</button>
   {loading?<p>{local(lang,'جارٍ تحميل الأعضاء…','Loading team…')}</p>:members.length===0?<p>{local(lang,'لا يوجد موظفون معتمدون حاليًا.','No staff approved yet.')}</p>:members.map(member=>
    <section key={member.id} className="management-card">
     <h4 dir="ltr">{member.email}</h4>
     <p><span className={'badge status-'+(member.active?'confirmed':'cancelled')}>{member.active?local(lang,'الوصول فعّال','Access active'):local(lang,'الوصول موقوف','Access revoked')}</span></p>
     <p>{!member.active?local(lang,'توقفت صلاحيات الإدارة. راجع الصلاحيات أدناه قبل إعادة اعتماد الحساب.','Administration access is revoked. Review the permissions below before restoring this account.'):member.linked?local(lang,'دخل بواسطة Google وتم ربط هويته.','Google identity verified and linked.'):local(lang,'بانتظار أول تسجيل دخول بحساب Google المعتمد.','Awaiting first login with the approved Google account.')}</p>
     <PermissionPicker lang={lang} value={drafts[member.id]||[]} disabled={busy} onChange={value=>setDrafts(previous=>({...previous,[member.id]:value}))}/>
     <div className="editor-savebar">
      {member.active?<><button type="button" className="button primary" disabled={busy||!(drafts[member.id]||[]).length||JSON.stringify([...(drafts[member.id]||[])].sort())===JSON.stringify([...member.permissions].sort())} onClick={()=>void update(member.id)}><Save size={16}/>{local(lang,'حفظ الصلاحيات','Save permissions')}</button>
      <button type="button" className="button light" disabled={busy} onClick={()=>void revoke(member)}><UserRoundX size={16}/>{local(lang,'إيقاف الوصول','Revoke access')}</button></>:<button type="button" className="button primary" disabled={busy||!(drafts[member.id]||[]).length} onClick={()=>void restore(member)}><UserRoundCheck size={16}/>{local(lang,'إعادة الاعتماد بهذه الصلاحيات','Restore with these permissions')}</button>}
     </div>
    </section>)}
  </section>
 </div>;
}
