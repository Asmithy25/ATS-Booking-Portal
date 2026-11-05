import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { getStaffAccess, isCorporateExecutiveAccess, requireAuth } from "../middleware/auth";
import { recordAudit } from "../lib/audit";

const router=Router();
const exec=(query:string)=>db.execute(sql.raw(query));
const rows=(r:any):any[]=>Array.isArray(r)?r:(r?.rows||[]);
const q=(v:unknown)=>v===null||v===undefined?"NULL":"'"+String(v).replaceAll("'","''")+"'";
const clean=(v:unknown,max=2000)=>typeof v==="string"?v.trim().slice(0,max):"";
const num=(v:unknown)=>{const n=Number(v);return Number.isSafeInteger(n)&&n>0?n:null;};
const fail=(res:Response,status:number,message:string)=>res.status(status).json({error:message});
const safe=(fn:(req:Request,res:Response)=>Promise<void>)=>async(req:Request,res:Response)=>{try{await fn(req,res);}catch(e){req.log.error({err:e},"AWS 4.0 profile request failed");if(!res.headersSent)fail(res,500,"Staff profile couldn't be loaded or updated.");}};
let tables:Promise<void>|null=null;
async function ensure(){
 if(!tables)tables=(async()=>{
  await exec("CREATE TABLE IF NOT EXISTS aws4_staff_profiles(staff_email text PRIMARY KEY,public_title text NOT NULL DEFAULT '',bio text NOT NULL DEFAULT '',availability_note text NOT NULL DEFAULT '',updated_by text NOT NULL DEFAULT '',updated_at timestamptz NOT NULL DEFAULT now())");
  await exec("CREATE TABLE IF NOT EXISTS aws4_profile_requests(id bigserial PRIMARY KEY,actor_email text NOT NULL,actor_name text NOT NULL,public_title text NOT NULL DEFAULT '',bio text NOT NULL DEFAULT '',availability_note text NOT NULL DEFAULT '',status text NOT NULL DEFAULT 'pending',review_note text NOT NULL DEFAULT '',reviewed_by text,reviewed_at timestamptz,created_at timestamptz NOT NULL DEFAULT now())");
  await exec("CREATE INDEX IF NOT EXISTS idx_aws4_profile_pending ON aws4_profile_requests(status,created_at DESC)");
 })().catch(e=>{tables=null;throw e;});await tables;
}
async function getActor(req:Request,res:Response,executive=false){
 const a=await getStaffAccess(req);
 if(!a){fail(res,401,"Staff sign-in required.");return null;}
 if(executive&&!isCorporateExecutiveAccess(a)){fail(res,403,"Founder or ASH Corporate access required.");return null;}
 return a;
}
router.get("/me",requireAuth,safe(async(req,res)=>{
 const a=await getActor(req,res);if(!a)return;await ensure();
 const base=rows(await exec("SELECT name,role,bio,photo_url FROM staff_accounts WHERE email="+q(a.email)+" LIMIT 1"))[0];
 const approved=rows(await exec("SELECT public_title,bio,availability_note,updated_at FROM aws4_staff_profiles WHERE staff_email="+q(a.email)+" LIMIT 1"))[0];
 const myRequests=rows(await exec('SELECT id,public_title AS "publicTitle",bio,availability_note AS "availabilityNote",status,review_note AS "reviewNote",reviewed_by AS "reviewedBy",created_at AS "createdAt" FROM aws4_profile_requests WHERE actor_email='+q(a.email)+" ORDER BY created_at DESC LIMIT 30"));
 res.setHeader("Cache-Control","private, no-store");
 res.json({name:base?.name||a.name,email:a.email,roleLabel:a.role==="therapist"?"Wellness Staff":a.role==="ash_executive"?"ASH Executive":a.role,publicTitle:approved?.public_title||"",bio:approved?.bio||base?.bio||"",availabilityNote:approved?.availability_note||"",photoUrl:base?.photo_url||"",requests:myRequests});
}));
router.post("/me/requests",requireAuth,safe(async(req,res)=>{
 const a=await getActor(req,res);if(!a)return;
 const title=clean(req.body?.publicTitle,140),bio=clean(req.body?.bio,1200),availability=clean(req.body?.availabilityNote,500);
 if(!title&&!bio&&!availability){fail(res,400,"Choose at least one profile field to update.");return;}
 if(title&&title.length<3){fail(res,400,"Enter a descriptive position title.");return;}
 await ensure();
 const count=Number(rows(await exec("SELECT count(*)::int AS count FROM aws4_profile_requests WHERE actor_email="+q(a.email)+" AND status='pending'"))[0]?.count||0);
 if(count){fail(res,409,"Your earlier profile change request is still awaiting review.");return;}
 const record=rows(await exec("INSERT INTO aws4_profile_requests(actor_email,actor_name,public_title,bio,availability_note) VALUES ("+q(a.email)+","+q(a.name)+","+q(title)+","+q(bio)+","+q(availability)+") RETURNING id,status"))[0];
 await recordAudit(req,"requested_staff_profile_update","aws4_profile_requests",String(record.id));
 res.status(201).json({id:Number(record.id),status:record.status});
}));
router.get("/admin/requests",requireAuth,safe(async(req,res)=>{
 if(!await getActor(req,res,true))return;await ensure();
 res.setHeader("Cache-Control","private, no-store");
 res.json(rows(await exec('SELECT id,actor_email AS "actorEmail",actor_name AS "actorName",public_title AS "publicTitle",bio,availability_note AS "availabilityNote",status,review_note AS "reviewNote",reviewed_by AS "reviewedBy",reviewed_at AS "reviewedAt",created_at AS "createdAt" FROM aws4_profile_requests ORDER BY CASE status WHEN \'pending\' THEN 0 ELSE 1 END,created_at DESC LIMIT 250')));
}));
router.patch("/admin/requests/:id",requireAuth,safe(async(req,res)=>{
 const a=await getActor(req,res,true);if(!a)return;
 const id=num(req.params.id),status=clean(req.body?.status,20),reviewNote=clean(req.body?.reviewNote,1000);
 if(!id||!["approved","denied"].includes(status)){fail(res,400,"Choose a valid review decision.");return;}
 await ensure();
 const record=rows(await exec("SELECT * FROM aws4_profile_requests WHERE id="+id+" LIMIT 1"))[0];
 if(!record){fail(res,404,"Request not found.");return;}
 if(record.status!=="pending"){fail(res,409,"This profile request has already been decided.");return;}
 if(record.actor_email===a.email){fail(res,403,"An executive cannot approve their own profile changes.");return;}
 const applied=await db.transaction(async(tx)=>{
  const reviewed=rows(await tx.execute(sql.raw("UPDATE aws4_profile_requests SET status="+q(status)+",review_note="+q(reviewNote)+",reviewed_by="+q(a.email)+",reviewed_at=now() WHERE id="+id+" AND status='pending' RETURNING id")))[0];
  if(!reviewed)return false;
  if(status==="approved"){
   await tx.execute(sql.raw("INSERT INTO aws4_staff_profiles(staff_email,public_title,bio,availability_note,updated_by) VALUES ("+q(record.actor_email)+","+q(record.public_title)+","+q(record.bio)+","+q(record.availability_note)+","+q(a.email)+") ON CONFLICT(staff_email) DO UPDATE SET public_title=EXCLUDED.public_title,bio=EXCLUDED.bio,availability_note=EXCLUDED.availability_note,updated_by=EXCLUDED.updated_by,updated_at=now()"));
   await tx.execute(sql.raw("UPDATE staff_accounts SET bio="+q(record.bio)+" WHERE email="+q(record.actor_email)));
  }
  return true;
 });
 if(!applied){fail(res,409,"This profile request was already reviewed.");return;}
 await recordAudit(req,"reviewed_staff_profile","aws4_profile_requests",String(id),status);
 res.json({id,status});
}));
export default router;
