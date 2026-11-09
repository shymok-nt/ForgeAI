import {useEffect,useRef,useState} from 'react';
import {AppState} from 'react-native';
import {pageRepository} from '@/db/repositories/pageRepository';
import {serializeContent} from '@/features/canvas/engine/content';
import type {PageContent} from '@/features/canvas/types';
export function useAutosave(pageId:string|null,content:PageContent){
 const [error,setError]=useState(false),[saving,setSaving]=useState(false);
 const latest=useRef({pageId,content});latest.current={pageId,content};
 const pending=useRef(new Map<string,string>()),chain=useRef(Promise.resolve()),timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const flush=()=>{const {pageId:id,content:value}=latest.current;if(!id||!dirty.current)return chain.current;dirty.current=false;
  const json=serializeContent(value);pending.current.set(id,json);
  chain.current=chain.current.then(async()=>{const data=pending.current.get(id);if(!data)return;pending.current.delete(id);setSaving(true);try{await pageRepository.updateContent(id,data);setError(false)}catch{pending.current.set(id,data);dirty.current=true;setError(true)}finally{setSaving(false)}});return chain.current;
 };
 useEffect(()=>{if(!pageId)return;if(!initialized.current){initialized.current=true;return}dirty.current=true;timer.current=setTimeout(()=>{void flush()},800);return()=>{if(timer.current)clearTimeout(timer.current)}},[pageId,content]);
 useEffect(()=>{const sub=AppState.addEventListener('change',state=>{if(state!=='active')void flush()});return()=>{sub.remove();void flush()}},[]);
 return {flush,error,saving,retry:flush};
}
