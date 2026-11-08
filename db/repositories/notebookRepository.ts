import * as Crypto from 'expo-crypto';
import { getDatabase } from '@/db/database';
import { copyCoverFile,deleteCoverFile,resolveCoverUri } from '@/utils/files';
import type { NotebookDraft,PageTemplate,PaperColor } from '@/types/notebook';
export type NotebookRow={
 id:string;title:string;folder_id:string|null;cover_type:'color'|'image'|'preset';cover_color:string|null;
 cover_image_path:string|null;cover_preset_id:string|null;show_title_on_cover:number;
 template:PageTemplate;paper_color:PaperColor;favorite:number;created_at:string;updated_at:string;page_count:number;
};
export type NotebookInput=NotebookDraft & {folderId:string|null;coverImagePath:string|null;coverPresetId?:string|null};
const select=`SELECT n.*,COUNT(p.id) AS page_count FROM notebooks n LEFT JOIN pages p ON p.notebook_id=n.id WHERE n.deleted_at IS NULL`;
const now=()=>new Date().toISOString();
const rowParams=(input:NotebookInput)=>[input.title,input.folderId,input.coverType,input.coverColor,input.coverImagePath,input.coverPresetId??null,input.showTitleOnCover?1:0,input.template,input.paperColor] as const;
export const notebookRepository={
 async getAll(){const db=await getDatabase();return db.getAllAsync<NotebookRow>(`${select} GROUP BY n.id ORDER BY n.updated_at DESC`);},
 async getById(id:string){const db=await getDatabase();return db.getFirstAsync<NotebookRow>(`${select} AND n.id=? GROUP BY n.id`,id);},
 async create(input:NotebookInput){
  const db=await getDatabase(),id=Crypto.randomUUID(),date=now(),pageId=Crypto.randomUUID();
  await db.withExclusiveTransactionAsync(async tx=>{
   await tx.runAsync(`INSERT INTO notebooks(id,title,folder_id,cover_type,cover_color,cover_image_path,cover_preset_id,show_title_on_cover,template,paper_color,favorite,created_at,updated_at,deleted_at) VALUES(?,?,?,?,?,?,?,?,?,?,0,?,?,NULL)`,id,...rowParams(input),date,date);
   await tx.runAsync('INSERT INTO pages(id,notebook_id,position,template,paper_color,created_at,updated_at) VALUES(?,?,0,?,?,?,?)',pageId,id,input.template,input.paperColor,date,date);
  });return id;
 },
 async update(id:string,patch:Partial<NotebookInput>){
  const db=await getDatabase();const before=await this.getById(id);if(!before)throw new Error('Defter bulunamadı');
  const fields:Record<string,unknown>={};
  const map:Record<string,string>={title:'title',folderId:'folder_id',coverType:'cover_type',coverColor:'cover_color',coverImagePath:'cover_image_path',coverPresetId:'cover_preset_id',showTitleOnCover:'show_title_on_cover',template:'template',paperColor:'paper_color'};
  for(const key of Object.keys(map) as (keyof NotebookInput)[]){if(key in patch)fields[map[key]]=key==='showTitleOnCover'?(patch.showTitleOnCover?1:0):patch[key]??null;}
  fields.updated_at=now();
  const keys=Object.keys(fields);await db.runAsync(`UPDATE notebooks SET ${keys.map(k=>k+'=?').join(',')} WHERE id=?`,...keys.map(k=>fields[k] as string|number|null),id);
  if(before.cover_image_path!==patch.coverImagePath&&patch.coverImagePath!==undefined&&before.cover_image_path){
   const used=await db.getFirstAsync<{n:number}>('SELECT COUNT(*) AS n FROM notebooks WHERE cover_image_path=?',before.cover_image_path);
   if(!used?.n)deleteCoverFile(before.cover_image_path);
  }
 },
 async remove(id:string){
  const db=await getDatabase();const row=await this.getById(id);if(!row)return;
  await db.withExclusiveTransactionAsync(async tx=>{await tx.runAsync('DELETE FROM notebooks WHERE id=?',id)});
  if(row.cover_image_path){const used=await db.getFirstAsync<{n:number}>('SELECT COUNT(*) AS n FROM notebooks WHERE cover_image_path=?',row.cover_image_path);if(!used?.n)deleteCoverFile(row.cover_image_path);}
 },
 async duplicate(id:string){
  const db=await getDatabase(),original=await this.getById(id);if(!original)throw new Error('Defter bulunamadı');
  const newId=Crypto.randomUUID(),date=now();
  const newPath=original.cover_image_path?await copyCoverFile(resolveCoverUri(original.cover_image_path)!):null;
  try{
   await db.withExclusiveTransactionAsync(async tx=>{
    await tx.runAsync(`INSERT INTO notebooks(id,title,folder_id,cover_type,cover_color,cover_image_path,cover_preset_id,show_title_on_cover,template,paper_color,favorite,created_at,updated_at,deleted_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,NULL)`,newId,original.title+' kopyası',original.folder_id,original.cover_type,original.cover_color,newPath,original.cover_preset_id,original.show_title_on_cover,original.template,original.paper_color,original.favorite,date,date);
    const pages=await tx.getAllAsync<{position:number;template:string;paper_color:string;content:string;thumbnail_path:string|null}>('SELECT position,template,paper_color,content,thumbnail_path FROM pages WHERE notebook_id=? ORDER BY position',id);
    for(const page of pages)await tx.runAsync('INSERT INTO pages(id,notebook_id,position,template,paper_color,content,thumbnail_path,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)',Crypto.randomUUID(),newId,page.position,page.template,page.paper_color,page.content,null,date,date);
   });return newId;
  }catch(e){deleteCoverFile(newPath);throw e}
 },
 async moveToFolder(id:string,folderId:string|null){const db=await getDatabase();await db.runAsync('UPDATE notebooks SET folder_id=? WHERE id=?',folderId,id)},
 async toggleFavorite(id:string){const db=await getDatabase();await db.runAsync('UPDATE notebooks SET favorite=CASE favorite WHEN 1 THEN 0 ELSE 1 END,updated_at=? WHERE id=?',now(),id);}
};
