'use client';
import {useEffect,useRef} from 'react';
export function useDialog(active:boolean,selector:string,close:()=>void){
 const closeRef=useRef(close);closeRef.current=close;
 useEffect(()=>{
  if(!active)return;
  const dialog=document.querySelector<HTMLElement>(selector);if(!dialog)return;
  const previous=document.activeElement as HTMLElement|null;const overflow=document.body.style.overflow;document.body.style.overflow='hidden';
  const focusable=()=>Array.from(dialog.querySelectorAll<HTMLElement>('a[href],button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]'));
  focusable()[0]?.focus();
  const keyboard=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();closeRef.current();}if(event.key==='Tab'){const elements=focusable();const first=elements[0];const last=elements.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}};
  document.addEventListener('keydown',keyboard);return()=>{document.body.style.overflow=overflow;document.removeEventListener('keydown',keyboard);previous?.focus();};
 },[active,selector]);
}
