import { getDatabase } from '@/db/database';
export type Folder={id:string;name:string;position:number;createdAt:string};
export const folderRepository={
 async getAll():Promise<Folder[]>{
  const db=await getDatabase();
  const rows=await db.getAllAsync<{id:string;name:string;position:number;created_at:string}>('SELECT * FROM folders ORDER BY position');
  return rows.map(r=>({id:r.id,name:r.name,position:r.position,createdAt:r.created_at}));
 }
};
