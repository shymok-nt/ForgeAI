import { Alert } from 'react-native';
import { create } from 'zustand';
import { defaultCoverColor } from '@/theme/covers';
import { folderRepository,type Folder } from '@/db/repositories/folderRepository';
import { notebookRepository,type NotebookRow,type NotebookInput } from '@/db/repositories/notebookRepository';
import { settingsRepository } from '@/db/repositories/settingsRepository';
import { coverPathFromUri,resolveCoverUri,coverFileExists } from '@/utils/files';
import type { FolderFilter,Notebook,NotebookDraft,SortBy,ViewMode,NotebookFolder } from '@/types/notebook';
const folderIds:Record<NotebookFolder,string>={Ders:'ders',İş:'is',Kişisel:'kisisel'};
const folderNames:Record<string,NotebookFolder>={ders:'Ders',is:'İş',kisisel:'Kişisel'};
const alert=(e:unknown)=>Alert.alert('İşlem tamamlanamadı',e instanceof Error?e.message:'Lütfen tekrar dene.');
const convert=(r:NotebookRow):Notebook=>({
 id:r.id,title:r.title,folderId:r.folder_id,folder:folderNames[r.folder_id??'']??'Kişisel',
 coverType:r.cover_type,coverColor:r.cover_color??defaultCoverColor,coverImagePath:r.cover_image_path,
 coverImageUri:coverFileExists(r.cover_image_path)?resolveCoverUri(r.cover_image_path):null,
 coverPresetId:r.cover_preset_id,showTitleOnCover:!!r.show_title_on_cover,template:r.template,
 paperColor:r.paper_color,pageCount:r.page_count,createdAt:r.created_at,updatedAt:r.updated_at,favorite:!!r.favorite
});
const toInput=(draft:NotebookDraft):NotebookInput=>({...draft,folderId:folderIds[draft.folder],coverImagePath:coverPathFromUri(draft.coverImageUri),coverPresetId:null});
type State={
 notebooks:Notebook[];folders:Folder[];selectedFolder:FolderFilter;sortBy:SortBy;viewMode:ViewMode;hydrated:boolean;
 hydrate:()=>Promise<void>;refresh:()=>Promise<void>;
 setSelectedFolder:(folder:FolderFilter)=>Promise<void>;setSortBy:(sort:SortBy)=>Promise<void>;setViewMode:(mode:ViewMode)=>Promise<void>;
 addNotebook:(draft:NotebookDraft)=>Promise<string|null>;updateNotebook:(id:string,draft:NotebookDraft)=>Promise<boolean>;
 deleteNotebook:(id:string)=>Promise<void>;duplicateNotebook:(id:string)=>Promise<string|null>;toggleFavorite:(id:string)=>Promise<void>;
};
export const useNotebookStore=create<State>((set,get)=>({
 notebooks:[],folders:[],selectedFolder:'Tümü',sortBy:'updated',viewMode:'grid',hydrated:false,
 hydrate:async()=>{const [folders,rows,sort,view,selected]=await Promise.all([folderRepository.getAll(),notebookRepository.getAll(),settingsRepository.get('sortBy'),settingsRepository.get('viewMode'),settingsRepository.get('selectedFolderId')]);
  set({folders,notebooks:rows.map(convert),sortBy:sort==='title'||sort==='created'?sort:'updated',viewMode:view==='list'?'list':'grid',selectedFolder:folderNames[selected??'']??'Tümü',hydrated:true});},
 refresh:async()=>{const rows=await notebookRepository.getAll();set({notebooks:rows.map(convert)})},
 setSelectedFolder:async folder=>{try{await settingsRepository.set('selectedFolderId',folder==='Tümü'?'':folderIds[folder]);set({selectedFolder:folder})}catch(e){alert(e)}},
 setSortBy:async sort=>{try{await settingsRepository.set('sortBy',sort);set({sortBy:sort})}catch(e){alert(e)}},
 setViewMode:async mode=>{try{await settingsRepository.set('viewMode',mode);set({viewMode:mode})}catch(e){alert(e)}},
 addNotebook:async draft=>{try{const id=await notebookRepository.create(toInput(draft));await get().refresh();return id}catch(e){alert(e);return null}},
 updateNotebook:async(id,draft)=>{try{await notebookRepository.update(id,toInput(draft));await get().refresh();return true}catch(e){alert(e);return false}},
 deleteNotebook:async id=>{try{await notebookRepository.remove(id);await get().refresh()}catch(e){alert(e)}},
 duplicateNotebook:async id=>{try{const key=await notebookRepository.duplicate(id);await get().refresh();return key}catch(e){alert(e);return null}},
 toggleFavorite:async id=>{try{await notebookRepository.toggleFavorite(id);await get().refresh()}catch(e){alert(e)}}
}));
export const defaultNotebookDraft:NotebookDraft={title:'Yeni defter',folder:'Kişisel',coverType:'color',coverColor:defaultCoverColor,coverImageUri:null,showTitleOnCover:true,template:'çizgili',paperColor:'beyaz'};
