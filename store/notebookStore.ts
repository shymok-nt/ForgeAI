import { create } from 'zustand';
import { defaultCoverColor } from '@/theme/covers';
import { deleteCoverIfUnused } from '@/utils/coverFiles';
import type { FolderFilter, Notebook, NotebookDraft, SortBy, ViewMode } from '@/types/notebook';
type State={notebooks:Notebook[];selectedFolder:FolderFilter;sortBy:SortBy;viewMode:ViewMode;
 setSelectedFolder:(f:FolderFilter)=>void;setSortBy:(s:SortBy)=>void;setViewMode:(v:ViewMode)=>void;
 addNotebook:(draft:NotebookDraft)=>string;updateNotebook:(id:string,draft:NotebookDraft)=>void;deleteNotebook:(id:string)=>void;duplicateNotebook:(id:string)=>string|null;toggleFavorite:(id:string)=>void};
const id=()=>`${Date.now()}-${Math.random().toString(36).slice(2,10)}`;
export const useNotebookStore=create<State>((set,get)=>({
 notebooks:[],selectedFolder:'Tümü',sortBy:'updated',viewMode:'grid',
 setSelectedFolder:selectedFolder=>set({selectedFolder}),setSortBy:sortBy=>set({sortBy}),setViewMode:viewMode=>set({viewMode}),
 addNotebook:draft=>{const key=id(),now=new Date().toISOString();set(s=>({notebooks:[{...draft,id:key,pageCount:1,createdAt:now,updatedAt:now,favorite:false},...s.notebooks]}));return key;},
 updateNotebook:(key,draft)=>{const before=get().notebooks.find(n=>n.id===key);set(s=>({notebooks:s.notebooks.map(n=>n.id===key?{...n,...draft,updatedAt:new Date().toISOString()}:n)}));if(before?.coverImageUri!==draft.coverImageUri)deleteCoverIfUnused(before?.coverImageUri??null,get().notebooks.map(n=>n.coverImageUri));},
 deleteNotebook:key=>{const before=get().notebooks.find(n=>n.id===key);set(s=>({notebooks:s.notebooks.filter(n=>n.id!==key)}));deleteCoverIfUnused(before?.coverImageUri??null,get().notebooks.map(n=>n.coverImageUri));},
 duplicateNotebook:key=>{const original=get().notebooks.find(n=>n.id===key);if(!original)return null;const next=id(),now=new Date().toISOString();set(s=>({notebooks:[{...original,id:next,title:`${original.title} (Kopya)`,createdAt:now,updatedAt:now,favorite:false},...s.notebooks]}));return next;},
 toggleFavorite:key=>set(s=>({notebooks:s.notebooks.map(n=>n.id===key?{...n,favorite:!n.favorite}:n)}))
}));
export const defaultNotebookDraft:NotebookDraft={title:'Yeni defter',folder:'Kişisel',coverType:'color',coverColor:defaultCoverColor,coverImageUri:null,showTitleOnCover:true,template:'çizgili',paperColor:'beyaz'};
