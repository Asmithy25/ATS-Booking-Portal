import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { getStaffAccess, hasPermission, isCorporateExecutiveAccess, requireAuth, requireClientAuth, type RequestWithClientSession } from "../middleware/auth";
import { recordAudit } from "../lib/audit";

const router=Router();
const rows=(v:any):any[]=>Array.isArray(v)?v:(v?.rows||[]);
const exec=(v:string)=>db.execute(sql.raw(v));
const clean=(v:unknown,max=2000)=>typeof v==="string"?v.trim().slice(0,max):"";
const q=(v:unknown)=>v===null||v===undefined?"NULL":"'"+String(v).replaceAll("'","''")+"'";
const numeric=(v:unknown)=>{const n=Number(v);return Number.isSafeInteger(n)&&n>0?n:null;};
const error=(res:Response,status:number,message:string)=>res.status(status).json({error:message});
const safe=(fn:(req:Request,res:Response)=>Promise<void>)=>async(req:Request,res:Response)=>{
 try{await fn(req,res)}catch(e){req.log.error({err:e},"AWS4 experience endpoint failed");if(!res.headersSent)error(res,500,"This request could not be completed.");}
};
const feedbackCategories=new Set(["suggestion","complaint","service_experience","accessibility","other"]);
const feedbackStatuses=new Set(["new","in_review","resolved","closed"]);
const incidentSeverity=new Set(["low","medium","high","critical"]);
const incidentStatuses=new Set(["reported","investigating","mitigated","resolved","closed"]);
let prepared:Promise<void>|null=null;
async function ensureExperience(){
 if(!prepared)prepared=(async()=>{
  await exec("CREATE TABLE IF NOT EXISTS aws4_client_feedback(id bigserial PRIMARY KEY,client_id integer NOT NULL REFERENCES client_accounts(id) ON DELETE CASCADE,category text NOT NULL,title text NOT NULL,details text NOT NULL,status text NOT NULL DEFAULT 'new',private_response text NOT NULL DEFAULT '',reviewed_by text,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now())");
  await exec("CREATE INDEX IF NOT EXISTS idx_aws4_feedback_client ON aws4_client_feedback(client_id,created_at DESC)");
  await exec("CREATE TABLE IF NOT EXISTS aws4_incident_reports(id bigserial PRIMARY KEY,reporter_email text NOT NULL,reporter_name text NOT NULL,category text NOT NULL,title text NOT NULL,description text NOT NULL,severity text NOT NULL DEFAULT 'medium',status text NOT NULL DEFAULT 'reported',owner_email text NOT NULL DEFAULT '',resolution text NOT NULL DEFAULT '',created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now())");
  await exec("CREATE INDEX IF NOT EXISTS idx_aws4_incidents_created ON aws4_incident_reports(created_at DESC)");
  await exec("CREATE TABLE IF NOT EXISTS aws4_incident_updates(id bigserial PRIMARY KEY,incident_id bigint NOT NULL REFERENCES aws4_incident_reports(id) ON DELETE CASCADE,actor_email text NOT NULL,actor_name text NOT NULL,action text NOT NULL,details text NOT NULL DEFAULT '',created_at timestamptz NOT NULL DEFAULT now())");
 })().catch(e=>{prepared=null;throw e});await prepared;
}
async function staff(req:Request,res:Response){
 const a=await getStaffAccess(req);if(!a){error(res,401,"Staff authentication required.");return null;}return a;
}
const reviewer=(a:{role:string;permissions:Record<string,boolean>})=>isCorporateExecutiveAccess(a)||hasPermission(a,"viewClientMessages");
const incidentManager=(a:{role:string;permissions:Record<string,boolean>})=>isCorporateExecutiveAccess(a)||hasPermission(a,"manageTasks");
function clientId(req:Request,res:Response){
 const id=numeric((req as RequestWithClientSession).clientSession?.id);
 if(!id)error(res,401,"Client sign-in required.");
 return id;
}

// Feedback is account-scoped. No anonymous lookup or public status identifiers.
router.get("/client/feedback",requireClientAuth,safe(async(req,res)=>{
 const id=clientId(req,res);if(!id)return;await ensureExperience();
 res.setHeader("Cache-Control","private, no-store");
 res.json(rows(await exec('SELECT id,category,title,details,status,private_response AS "privateResponse",created_at AS "createdAt",updated_at AS "updatedAt" FROM aws4_client_feedback WHERE client_id='+id+" ORDER BY created_at DESC LIMIT 100")));
}));
router.post("/client/feedback",requireClientAuth,safe(async(req,res)=>{
 const id=clientId(req,res);if(!id)return;
 const category=clean(req.body?.category,30),title=clean(req.body?.title,140),details=clean(req.body?.details,3000);
 if(!feedbackCategories.has(category)||title.length<3||details.length<10){error(res,400,"Choose a valid category and include a short title and detailed feedback.");return;}
 await ensureExperience();
 const count=Number(rows(await exec("SELECT count(*)::int AS count FROM aws4_client_feedback WHERE client_id="+id+" AND created_at>now()-interval '24 hours'"))[0]?.count||0);
 if(count>=5){error(res,429,"You have reached the daily feedback limit. Please contact staff if something is urgent.");return;}
 const item=rows(await exec("INSERT INTO aws4_client_feedback(client_id,category,title,details) VALUES ("+id+","+q(category)+","+q(title)+","+q(details)+") RETURNING id,status,created_at"))[0];
 res.status(201).json({id:Number(item.id),status:item.status,createdAt:item.created_at});
}));
router.get("/staff/feedback",requireAuth,safe(async(req,res)=>{
 const a=await staff(req,res);if(!a)return;
 if(!reviewer(a)){error(res,403,"Feedback reviewer access required.");return;}
 await ensureExperience();res.setHeader("Cache-Control","private, no-store");
 res.json(rows(await exec('SELECT f.id,f.client_id AS "clientId",f.category,f.title,f.details,f.status,f.private_response AS "privateResponse",f.reviewed_by AS "reviewedBy",f.created_at AS "createdAt",f.updated_at AS "updatedAt" FROM aws4_client_feedback f ORDER BY CASE f.status WHEN \'new\' THEN 0 WHEN \'in_review\' THEN 1 ELSE 2 END,f.created_at DESC LIMIT 250')));
}));
router.patch("/staff/feedback/:id",requireAuth,safe(async(req,res)=>{
 const a=await staff(req,res);if(!a)return;
 if(!reviewer(a)){error(res,403,"Feedback reviewer access required.");return;}
 const id=numeric(req.params.id),status=clean(req.body?.status,30),reply=clean(req.body?.privateResponse,3000);
 if(!id||!feedbackStatuses.has(status)){error(res,400,"Select a valid feedback status.");return;}
 await ensureExperience();
 const old=rows(await exec("SELECT id,status,private_response FROM aws4_client_feedback WHERE id="+id))[0];
 if(!old){error(res,404,"Feedback record not found.");return;}
 const item=rows(await exec("UPDATE aws4_client_feedback SET status="+q(status)+",private_response="+q(reply)+",reviewed_by="+q(a.email)+",updated_at=now() WHERE id="+id+' RETURNING id,status,private_response AS "privateResponse"'))[0];
 await recordAudit(req,"reviewed_client_feedback","aws4_client_feedback",String(id),JSON.stringify({from:old.status,to:status,replied:reply.length>0}));
 res.json(item);
}));

// Separate, auditable incident-management workflow. Staff see only their own reports
// and assigned reports; managers see department-wide operational incidents.
router.get("/staff/incidents",requireAuth,safe(async(req,res)=>{
 const a=await staff(req,res);if(!a)return;await ensureExperience();
 const filter=incidentManager(a)?"":" WHERE reporter_email="+q(a.email)+" OR owner_email="+q(a.email);
 res.setHeader("Cache-Control","private, no-store");
 res.json(rows(await exec('SELECT id,reporter_email AS "reporterEmail",reporter_name AS "reporterName",category,title,description,severity,status,owner_email AS "ownerEmail",resolution,created_at AS "createdAt",updated_at AS "updatedAt" FROM aws4_incident_reports'+filter+" ORDER BY created_at DESC LIMIT 300")));
}));
router.post("/staff/incidents",requireAuth,safe(async(req,res)=>{
 const a=await staff(req,res);if(!a)return;
 const category=clean(req.body?.category,80),title=clean(req.body?.title,180),description=clean(req.body?.description,4000),severity=clean(req.body?.severity,30)||"medium";
 if(!category||title.length<3||description.length<10||!incidentSeverity.has(severity)){error(res,400,"Incident category, title, details and a valid severity are required.");return;}
 await ensureExperience();
 const item=rows(await exec("INSERT INTO aws4_incident_reports(reporter_email,reporter_name,category,title,description,severity) VALUES ("+q(a.email)+","+q(a.name)+","+q(category)+","+q(title)+","+q(description)+","+q(severity)+") RETURNING id,status"))[0];
 await exec("INSERT INTO aws4_incident_updates(incident_id,actor_email,actor_name,action,details) VALUES ("+Number(item.id)+","+q(a.email)+","+q(a.name)+",'reported','New incident')");
 await recordAudit(req,"reported_incident","aws4_incident_reports",String(item.id),severity);
 res.status(201).json(item);
}));
router.patch("/staff/incidents/:id",requireAuth,safe(async(req,res)=>{
 const a=await staff(req,res);if(!a)return;
 if(!incidentManager(a)){error(res,403,"Incident management permission required.");return;}
 const id=numeric(req.params.id),status=clean(req.body?.status,30),owner=clean(req.body?.ownerEmail,200).toLowerCase(),resolution=clean(req.body?.resolution,3000);
 if(!id||!incidentStatuses.has(status)){error(res,400,"Choose a supported incident status.");return;}
 await ensureExperience();
 const old=rows(await exec("SELECT status,owner_email FROM aws4_incident_reports WHERE id="+id))[0];
 if(!old){error(res,404,"Incident not found.");return;}
 if(owner&&!rows(await exec("SELECT email FROM staff_accounts WHERE email="+q(owner)+" LIMIT 1"))[0]){error(res,404,"Assigned staff account not found.");return;}
 if(["resolved","closed"].includes(status)&&resolution.length<10){error(res,400,"Document the resolution before closing an incident.");return;}
 const item=rows(await exec("UPDATE aws4_incident_reports SET status="+q(status)+",owner_email="+q(owner)+",resolution="+q(resolution)+",updated_at=now() WHERE id="+id+' RETURNING id,status,owner_email AS "ownerEmail",resolution'))[0];
 await exec("INSERT INTO aws4_incident_updates(incident_id,actor_email,actor_name,action,details) VALUES ("+id+","+q(a.email)+","+q(a.name)+","+q(status)+","+q(owner?"Assigned to "+owner:"Status changed")+")");
 await recordAudit(req,"updated_incident","aws4_incident_reports",String(id),JSON.stringify({before:old.status,after:status,assigned:owner.length>0}));
 res.json(item);
}));
router.get("/staff/incidents/:id/history",requireAuth,safe(async(req,res)=>{
 const a=await staff(req,res);if(!a)return;const id=numeric(req.params.id);if(!id){error(res,400,"Invalid incident.");return;}
 await ensureExperience();
 const incident=rows(await exec("SELECT reporter_email,owner_email FROM aws4_incident_reports WHERE id="+id))[0];
 if(!incident){error(res,404,"Incident not found.");return;}
 if(!incidentManager(a)&&incident.reporter_email!==a.email&&incident.owner_email!==a.email){error(res,403,"Incident access denied.");return;}
 res.json(rows(await exec('SELECT id,actor_name AS "actorName",action,details,created_at AS "createdAt" FROM aws4_incident_updates WHERE incident_id='+id+" ORDER BY created_at ASC LIMIT 400")));
}));
export default router;
