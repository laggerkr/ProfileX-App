import { spawnSync } from "node:child_process";
import { Client } from "pg";
import fs from "node:fs";
import path from "node:path";
import "dotenv/config";
const databaseUrl=process.env.DATABASE_URL ?? "postgresql://profilex:profilex-dev-password@127.0.0.1:5432/profilex";
async function ping(){const c=new Client({connectionString:databaseUrl}); try{await c.connect(); await c.query("select 1"); return true;}catch{return false;}finally{await c.end().catch(()=>undefined)}}
if(!(await ping())){console.log("PostgreSQL unavailable; starting Docker Compose postgres..."); const up=spawnSync("docker",["compose","up","-d","postgres"],{stdio:"inherit"}); if(up.status!==0) throw new Error("Could not start PostgreSQL. Install Docker or provide DATABASE_URL."); for(let i=0;i<30;i++){if(await ping()) break; await new Promise(r=>setTimeout(r,2000)); if(i===29) throw new Error("PostgreSQL did not become ready in time.");}}
const migration=fs.readFileSync(path.join("apps","backend","migrations","001_init_postgres.sql"),"utf8"); const c=new Client({connectionString:databaseUrl}); await c.connect(); await c.query(migration); await c.end(); console.log("Dev database ready and migrations applied.");
