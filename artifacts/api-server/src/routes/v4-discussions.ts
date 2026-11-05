import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { getStaffAccess, isCorporateExecutiveAccess, requireAuth } from "../middleware/auth";
import { recordAudit } from "../lib/audit";

const router=Router();
const sqlRows=(r:any):any[]=>Array.isArray(r)?r:(r?.rows||[]);
const run=(s:string)=>db.execute(sql.raw(s));
const q=(s:unknown)=>s===null||s===undefined?"NULL":"'"+String(s).replaceAll("'","''")+"'";
const clean=(s:unknown,n=2000)=>typeof s==="string"?s.trim().slice(0,n):"";
const id=(s:unknown)=>{const n=Number(s);return Number.isSafeInteger(n)&&n>0?n:null;};
const bad=(res:Response,n:number,reason:string)=>res.status(n).json({error:reason});
const safe=(fn:(req:Request,res:Response)=>Promise<void>)=>async(req:Request,res:Response)=>{try{await fn(req,res)}catch(e){req.log.error({err:e},"AWS4 discussion error");if(!res.headersSent)bad(res,500,"The discussion request could not be completed.");}};
let initPromise:Promise<void>|null=null;
async function init(){
 if(!initPromise)initPromise=(async()=>{
  await run("CREATE TABLE IF NOT EXISTS aws4_org_departments(id bigserial PRIMARY KEY,name text NOT NULL UNIQUE,description text NOT NULL DEFAULT '',leader_email text NOT NULL DEFAULT '',created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now())");
  await run("CREATE TABLE IF NOT EXISTS aws4_org_memberships(staff_email text PRIMARY KEY,department_id bigint REFERENCES aws4_org_departments(id) ON DELETE SET NULL,reports_to_email text NOT NULL DEFAULT '',updated_at timestamptz DEFAULT now())");
  await run("CREATE TABLE IF NOT EXISTS aws4_department_threads(id bigserial PRIMARY KEY,department_id bigint NOT NULL REFERENCES aws4_org_departments(id) ON DELETE CASCADE,title text NOT NULL,summary text NOT NULL DEFAULT '',locked boolean NOT NULL DEFAULT false,pinned boolean NOT NULL DEFAULT false,created_by text NOT NULL,created_name text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now())");
  await run("CREATE INDEX IF NOT EXISTS idx_aws4_department_threads ON aws4_department_threads(department_id,updated_at DESC)");
  await run("CREATE TABLE IF NOT EXISTS aws4_department_posts(id bigserial PRIMARY KEY,thread_id bigint NOT NULL REFERENCES aws4_department_threads(id) ON DELETE CASCADE,author_email text NOT NULL,author_name text NOT NULL,body text NOT NULL,created_at timestamptz NOT NULL DEFAULT now())");
 })().catch(e=>{initPromise=null;throw e});await initPromise;
}
async function actor(req:Request,res:Response){
 const a=await getStaffAccess(req);if(!a)bad(res,401,"Staff sign-in required.");return a;
}
async function departmentAccess(email:string,role:string,departmentId:number) {
 const department=sqlRows(await run("SELECT id,name,leader_email FROM aws4_org_departments WHERE id="+departmentId+" LIMIT 1"))[0];
 if(!department)return null;
 const membership=sqlRows(await run("SELECT department_id FROM aws4_org_memberships WHERE staff_email="+q(email)+" LIMIT 1"))[0];
 const executive=role==="founder"||role==="ash_executive";
 if(!executive&&Number(membership?.department_id)!==departmentId)return null;
 return {department,executive,moderator:executive||department.leader_email===email};
}
async function threadAccess(req:Request,res:Response) {
 const a=await actor(req,res);if(!a)return null;
 const threadId=id(req.params.id);if(!threadId){bad(res,400,"Invalid discussion.");return null;}
 await init();
 const thread=sqlRows(await run("SELECT id,department_id,title,locked,pinned FROM aws4_department_threads WHERE id="+threadId+" LIMIT 1"))[0];
 if(!thread){bad(res,404,"Discussion not found.");return null;}
 const access=await departmentAccess(a.email,a.role,Number(thread.department_id));
 if(!access){bad(res,403,"You are not a member of this department.");return null;}
 return {a,thread,access};
}
router.get("/departments",requireAuth,safe(async(req,res)=>{
 const a=await actor(req,res);if(!a)return;await init();
 const executive=isCorporateExecutiveAccess(a);
 res.json(sqlRows(await run('SELECT d.id,d.name,d.description,d.leader_email AS "leaderEmail" FROM aws4_org_departments d '+(executive?"":" JOIN aws4_org_memberships m ON m.department_id=d.id WHERE m.staff_email="+q(a.email))+" ORDER BY d.name")));
}));
router.get("/departments/:departmentId/threads",requireAuth,safe(async(req,res)=>{
 const a=await actor(req,res);if(!a)return;const departmentId=id(req.params.departmentId);if(!departmentId){bad(res,400,"Invalid department.");return;}
 await init();const access=await departmentAccess(a.email,a.role,departmentId);if(!access){bad(res,403,"Department membership required.");return;}
 res.setHeader("Cache-Control","private, no-store");
 res.json(sqlRows(await run('SELECT t.id,t.department_id AS "departmentId",t.title,t.summary,t.locked,t.pinned,t.created_by AS "createdBy",t.created_name AS "createdName",t.created_at AS "createdAt",t.updated_at AS "updatedAt",(SELECT count(*)::int FROM aws4_department_posts p WHERE p.thread_id=t.id) AS "replyCount" FROM aws4_department_threads t WHERE t.department_id='+departmentId+" ORDER BY t.pinned DESC,t.updated_at DESC LIMIT 250")));
}));
router.post("/departments/:departmentId/threads",requireAuth,safe(async(req,res)=>{
 const a=await actor(req,res);if(!a)return;const departmentId=id(req.params.departmentId),title=clean(req.body?.title,180),summary=clean(req.body?.summary,3000);
 if(!departmentId||title.length<3||summary.length<3){bad(res,400,"Choose a department and provide a title and topic.");return;}
 await init();if(!(await departmentAccess(a.email,a.role,departmentId))){bad(res,403,"Department membership required.");return;}
 const item=sqlRows(await run("INSERT INTO aws4_department_threads(department_id,title,summary,created_by,created_name) VALUES ("+departmentId+","+q(title)+","+q(summary)+","+q(a.email)+","+q(a.name)+") RETURNING id"))[0];
 await recordAudit(req,"created_department_topic","aws4_department_threads",String(item.id),"department="+departmentId);
 res.status(201).json({id:Number(item.id),title});
}));
router.get("/threads/:id/posts",requireAuth,safe(async(req,res)=>{
 const context=await threadAccess(req,res);if(!context)return;
 res.setHeader("Cache-Control","private, no-store");
 res.json(sqlRows(await run('SELECT id,author_email AS "authorEmail",author_name AS "authorName",body,created_at AS "createdAt" FROM aws4_department_posts WHERE thread_id='+Number(context.thread.id)+" ORDER BY created_at ASC LIMIT 500")));
}));
router.post("/threads/:id/posts",requireAuth,safe(async(req,res)=>{
 const context=await threadAccess(req,res);if(!context)return;
 const body=clean(req.body?.body,3000);
 if(!body){bad(res,400,"A reply is required.");return;}
 if(context.thread.locked&&!context.access.moderator){bad(res,423,"This discussion has been locked by department leadership.");return;}
 const item=sqlRows(await run("INSERT INTO aws4_department_posts(thread_id,author_email,author_name,body) VALUES ("+Number(context.thread.id)+","+q(context.a.email)+","+q(context.a.name)+","+q(body)+") RETURNING id"))[0];
 await run("UPDATE aws4_department_threads SET updated_at=now() WHERE id="+Number(context.thread.id));
 await recordAudit(req,"replied_department_topic","aws4_department_threads",String(context.thread.id));
 res.status(201).json({id:Number(item.id),body});
}));
router.patch("/threads/:id/moderate",requireAuth,safe(async(req,res)=>{
 const context=await threadAccess(req,res);if(!context)return;
 if(!context.access.moderator){bad(res,403,"Only department leadership may moderate a thread.");return;}
 const locked=typeof req.body?.locked==="boolean"?req.body.locked:context.thread.locked;
 const pinned=typeof req.body?.pinned==="boolean"?req.body.pinned:context.thread.pinned;
 const result=sqlRows(await run("UPDATE aws4_department_threads SET locked="+(locked?"true":"false")+",pinned="+(pinned?"true":"false")+",updated_at=now() WHERE id="+Number(context.thread.id)+' RETURNING id,locked,pinned'))[0];
 await recordAudit(req,"moderated_department_topic","aws4_department_threads",String(result.id),JSON.stringify({locked,pinned}));
 res.json(result);
}));
export default router;
