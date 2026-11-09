import {useCallback,useEffect,useRef,useState} from 'react';
import {AppState} from 'react-native';
import {pageRepository} from '@/db/repositories/pageRepository';
import {serializeContent} from '@/features/canvas/engine/content';
import type {PageContent} from '@/features/canvas/types';

const queues=new Map<string,Promise<void>>();
export function useAutosave(pageId:string|null,content:PageContent){
 const [error,setError]=useState(false),[saving,setSaving]=useState(false);
 const latest=useRef({pageId,content});latest.current={pageId,content};
 const initialized=useRef(false),dirty=useRef(false),active=useRef(false);
 const version=useRef(0),savedVersion=useRef(0),firstDirty=useRef(0);
 const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const statusTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const mounted=useRef(true);
 const clear=()=>{if(timer.current)clearTimeout(timer.current);timer.current=null};
 const flush=useCallback(async()=>{
  clear();
  const {pageId:id,content:value}=latest.current;
  if(!id||!dirty.current||active.current)return queues.get(id??'')??Promise.resolve();
  const snapshot=version.current;
  if(snapshot===savedVersion.current)return queues.get(id)??Promise.resolve();
  dirty.current=false;
  const data=serializeContent(value);
  const previous=queues.get(id)??Promise.resolve();
  const task=previous.catch(()=>{}).then(async()=>{
   if(statusTimer.current)clearTimeout(statusTimer.current);
   statusTimer.current=setTimeout(()=>{if(mounted.current)setSaving(true)},400);
   try{
    await pageRepository.updateContent(id,data);
    savedVersion.current=Math.max(savedVersion.current,snapshot);
    if(mounted.current)setError(false);
   }catch(e){
    dirty.current=true;
    if(mounted.current)setError(true);
    throw e;
   }finally{
    if(statusTimer.current)clearTimeout(statusTimer.current);
    if(mounted.current)setSaving(false);
   }
  });
  queues.set(id,task);
  void task.finally(()=>{if(queues.get(id)===task)queues.delete(id)}).catch(()=>{});
  return task;
 },[]);
 const schedule=useCallback(()=>{
  clear();if(active.current)return;
  const elapsed=firstDirty.current?Date.now()-firstDirty.current:0;
  timer.current=setTimeout(()=>{void flush().catch(()=>{})},Math.max(0,Math.min(2500,15000-elapsed)));
 },[flush]);
 useEffect(()=>{
  if(!pageId)return;
  if(!initialized.current){initialized.current=true;return}
  version.current++;dirty.current=true;
  if(!firstDirty.current)firstDirty.current=Date.now();
  schedule();
 },[pageId,content,schedule]);
 const setDrawingActive=useCallback((value:boolean)=>{
  active.current=value;
  if(value)clear();else if(dirty.current)schedule();
 },[schedule]);
 useEffect(()=>{
  mounted.current=true;
  const sub=AppState.addEventListener('change',state=>{
   if(state!=='active'){active.current=false;void flush().catch(()=>{})}
  });
  return()=>{mounted.current=false;sub.remove();active.current=false;clear();if(statusTimer.current)clearTimeout(statusTimer.current);void flush().catch(()=>{})};
 },[flush]);
 const retry=useCallback(async()=>{active.current=false;await flush()},[flush]);
 return {flush,error,saving,retry,setDrawingActive};
}
