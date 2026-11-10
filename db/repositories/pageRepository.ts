import * as Crypto from 'expo-crypto';
import { getDatabase,withSafeTransaction } from '@/db/database';
import type { Page } from '@/types/page';
import type { PageTemplate,PaperColor } from '@/types/notebook';
type PageRow={id:string;notebook_id:string;position:number;template:PageTemplate;paper_color:PaperColor;content:string;thumbnail_path:string|null;created_at:string;updated_at:string};
const convert=(r:PageRow):Page=>({id:r.id,notebookId:r.notebook_id,position:r.position,template:r.template,paperColor:r.paper_color,content:r.content,thumbnailPath:r.thumbnail_path,createdAt:r.created_at,updatedAt:r.updated_at});
const now=()=>new Date().toISOString();
export const pageRepository={
 async getByNotebook(notebookId:string){const db=await getDatabase();const rows=await db.getAllAsync<PageRow>('SELECT * FROM pages WHERE notebook_id=? AND EXISTS(SELECT 1 FROM notebooks WHERE id=? AND deleted_at IS NULL) ORDER BY position',notebookId,notebookId);return rows.map(convert);},
 async add(notebookId:string,afterPosition?:number){
  const db=await getDatabase(),id=Crypto.randomUUID(),date=now();
  await withSafeTransaction(db,async tx=>{
   const notebook=await tx.getFirstAsync<{template:PageTemplate;paper_color:PaperColor}>('SELECT template,paper_color FROM notebooks WHERE id=? AND deleted_at IS NULL',notebookId);
   if(!notebook)throw new Error('Defter bulunamadı');
   const count=await tx.getFirstAsync<{n:number}>('SELECT COUNT(*) AS n FROM pages WHERE notebook_id=?',notebookId);
   const position=afterPosition===undefined?count!.n:Math.max(0,Math.min(count!.n,afterPosition+1));
   await tx.runAsync('UPDATE pages SET position=position+1 WHERE notebook_id=? AND position>=?',notebookId,position);
   await tx.runAsync('INSERT INTO pages(id,notebook_id,position,template,paper_color,created_at,updated_at) VALUES(?,?,?,?,?,?,?)',id,notebookId,position,notebook.template,notebook.paper_color,date,date);
   await tx.runAsync('UPDATE notebooks SET updated_at=? WHERE id=?',date,notebookId);
  });return id;
 },
 async remove(pageId:string){
  const db=await getDatabase();await withSafeTransaction(db,async tx=>{
   const row=await tx.getFirstAsync<{notebook_id:string}>('SELECT notebook_id FROM pages WHERE id=?',pageId);if(!row)throw new Error('Sayfa bulunamadı');
   const count=await tx.getFirstAsync<{n:number}>('SELECT COUNT(*) AS n FROM pages WHERE notebook_id=?',row.notebook_id);
   if((count?.n??0)<=1)throw new Error('Defterin son sayfası silinemez');
   await tx.runAsync('DELETE FROM pages WHERE id=?',pageId);
   const remaining=await tx.getAllAsync<{id:string}>('SELECT id FROM pages WHERE notebook_id=? ORDER BY position',row.notebook_id);
   for(let i=0;i<remaining.length;i++)await tx.runAsync('UPDATE pages SET position=? WHERE id=?',i,remaining[i].id);
   await tx.runAsync('UPDATE notebooks SET updated_at=? WHERE id=?',now(),row.notebook_id);
  });
 },
 async move(pageId:string,newPosition:number){
  const db=await getDatabase();await withSafeTransaction(db,async tx=>{
   const row=await tx.getFirstAsync<{notebook_id:string}>('SELECT notebook_id FROM pages WHERE id=?',pageId);if(!row)throw new Error('Sayfa bulunamadı');
   const pages=await tx.getAllAsync<{id:string}>('SELECT id FROM pages WHERE notebook_id=? ORDER BY position',row.notebook_id);
   const from=pages.findIndex(p=>p.id===pageId);if(from<0)return;
   const [item]=pages.splice(from,1);pages.splice(Math.max(0,Math.min(pages.length,newPosition)),0,item);
   for(let i=0;i<pages.length;i++)await tx.runAsync('UPDATE pages SET position=? WHERE id=?',i,pages[i].id);
   await tx.runAsync('UPDATE notebooks SET updated_at=? WHERE id=?',now(),row.notebook_id);
  });
 },
 async updateContent(pageId:string,content:string){const db=await getDatabase(),date=now();await withSafeTransaction(db,async tx=>{await tx.runAsync('UPDATE pages SET content=?,updated_at=? WHERE id=? AND EXISTS(SELECT 1 FROM notebooks WHERE notebooks.id=pages.notebook_id AND notebooks.deleted_at IS NULL)',content,date,pageId);await tx.runAsync('UPDATE notebooks SET updated_at=? WHERE id=(SELECT notebook_id FROM pages WHERE id=?)',date,pageId)})},
 async updateTemplate(pageId:string,template:PageTemplate,paperColor:PaperColor){
  const db=await getDatabase(),date=now();await withSafeTransaction(db,async tx=>{
   await tx.runAsync('UPDATE pages SET template=?,paper_color=?,updated_at=? WHERE id=?',template,paperColor,date,pageId);
   await tx.runAsync('UPDATE notebooks SET updated_at=? WHERE id=(SELECT notebook_id FROM pages WHERE id=?)',date,pageId);
  });
 }
};
