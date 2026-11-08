import * as SQLite from 'expo-sqlite';
import { migrations } from '@/db/migrations';
let instance:Promise<SQLite.SQLiteDatabase>|null=null;
async function openAndMigrate(){
 const db=await SQLite.openDatabaseAsync('notex.db');
 await db.execAsync('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
 const result=await db.getFirstAsync<{user_version:number}>('PRAGMA user_version');
 const current=result?.user_version??0;
 for(const migration of migrations.filter(m=>m.version>current).sort((a,b)=>a.version-b.version)){
  await db.withExclusiveTransactionAsync(async tx=>{
   await migration.run(tx as SQLite.SQLiteDatabase);
   await tx.execAsync(`PRAGMA user_version = ${migration.version}`);
  });
 }
 return db;
}
export function getDatabase(){if(!instance)instance=openAndMigrate().catch(error=>{instance=null;throw error});return instance;}
export async function retryDatabase(){instance=null;return getDatabase();}
