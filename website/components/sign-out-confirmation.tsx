'use client';

import {useCallback,useEffect,useId,useRef,useState,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {LogOut} from 'lucide-react';
import {local,type Lang} from '../lib/config';

type Props={
 lang:Lang;
 children:ReactNode;
 className?:string;
 disabled?:boolean;
 onConfirm:()=>Promise<void>|void;
 formatError?:(error:unknown)=>string;
};

/** Share the confirmation UI; each caller retains its own server logout and redirect. */
export function SignOutConfirmation({lang,children,className,disabled,onConfirm,formatError}:Props){
 const [open,setOpen]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const trigger=useRef<HTMLButtonElement>(null);
 const dialog=useRef<HTMLDialogElement>(null);
 const cancel=useRef<HTMLButtonElement>(null);
 const pending=useRef(false);
 const id=useId();
 const dismiss=useCallback(()=>{if(!pending.current)setOpen(false);},[]);

 useEffect(()=>{
  if(!open||!dialog.current)return;
  const modal=dialog.current;
  const root=document.documentElement;
  const alreadyLocked=root.classList.contains('sign-out-open');
  if(!modal.open)modal.showModal();
  root.classList.add('sign-out-open');
  cancel.current?.focus({preventScroll:true});
  // A nested confirmation must not also dismiss the mobile menu underneath it.
  const keyboard=(event:KeyboardEvent)=>{
   if(event.key==='Escape'){
    event.preventDefault();event.stopImmediatePropagation();dismiss();
   }else if(event.key==='Tab'){
    const controls=Array.from(modal.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
    const first=controls[0],last=controls.at(-1);
    if(!first){event.preventDefault();event.stopImmediatePropagation();}
    else if(event.shiftKey&&document.activeElement===first){event.preventDefault();event.stopImmediatePropagation();last?.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();event.stopImmediatePropagation();first.focus();}
   }
  };
  document.addEventListener('keydown',keyboard,true);
  return()=>{
   document.removeEventListener('keydown',keyboard,true);
   if(modal.open)modal.close();
   if(!alreadyLocked)root.classList.remove('sign-out-open');
   if(trigger.current?.isConnected)trigger.current.focus({preventScroll:true});
  };
 },[open,dismiss]);

 async function confirm(){
  if(pending.current)return;
  pending.current=true;setBusy(true);setError('');
  try{
   await onConfirm();
   setOpen(false);
  }catch(cause){
   setError(formatError?.(cause)||local(lang,'تعذّر تأكيد تسجيل الخروج. حاول مرة أخرى.','We couldn’t confirm sign-out. Please try again.'));
  }finally{
   pending.current=false;setBusy(false);
  }
 }

 return <>
  <button ref={trigger} type="button" className={'sign-out-trigger'+(className?' '+className:'')} disabled={disabled} aria-haspopup="dialog" onClick={()=>{setError('');setOpen(true);}}>{children}</button>
  {open&&createPortal(<dialog ref={dialog} className="sign-out-dialog" role="alertdialog" aria-modal="true" aria-labelledby={id+'-title'} aria-describedby={id+'-description'} dir={lang==='ar'?'rtl':'ltr'} onCancel={event=>{event.preventDefault();dismiss();}} onClick={event=>event.stopPropagation()}>
   <span className="sign-out-dialog-icon" aria-hidden="true"><LogOut size={24}/></span>
   <h2 id={id+'-title'}>{local(lang,'تسجيل الخروج؟','Sign out?')}</h2>
   <p id={id+'-description'}>{local(lang,'هل تريد تسجيل الخروج من حسابك؟ يمكنك تسجيل الدخول مجددًا في أي وقت.','Do you want to sign out of your account? You can sign in again at any time.')}</p>
   {error&&<p className="sign-out-dialog-error" role="alert">{error}</p>}
   <div className="sign-out-dialog-actions">
    <button ref={cancel} type="button" className="sign-out-dialog-cancel" disabled={busy} onClick={dismiss}>{local(lang,'إلغاء','Cancel')}</button>
    <button type="button" className="sign-out-dialog-confirm" disabled={busy} aria-busy={busy} onClick={()=>void confirm()}>{busy?local(lang,'جارٍ تسجيل الخروج…','Signing out…'):local(lang,'موافق','Sign out')}</button>
   </div>
   <span className="sign-out-dialog-status" role="status">{busy?local(lang,'جارٍ تسجيل الخروج، يرجى الانتظار.','Signing out, please wait.'):''}</span>
  </dialog>,document.body)}
 </>;
}
