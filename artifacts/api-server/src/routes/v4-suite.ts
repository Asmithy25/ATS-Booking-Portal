import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { getStaffAccess, hasPermission, isCorporateExecutiveAccess, requireAuth, requireClientAuth, type RequestWithClientSession } from "../middleware/auth";
import { recordAudit } from "../lib/audit";
import { ensureV4Tables } from "./v4";

const router = Router();
type Actor = NonNullable<Awaited<ReturnType<typeof getStaffAccess>>>;
const rows = (v:any):any[] => Array.isArray(v)?v:(v?.rows??[]);
const exec = (v:string) => db.execute(sql.raw(v));
const clean=(v:unknown,max=3000)=>typeof v==="string"?v.trim().slice(0,max):"";
const q=(v:unknown)=>v===null||v===undefined?"NULL":"'"+String(v).replace(/'/g,"''")+"'";
const id=(v:unknown)=>{const n=Number(v);return Number.isSafeInteger(n)&&n>0?n:null;};
const fail=(res:Response,status:number,msg:string)=>res.status(status).json({error:msg});
const safe=(fn:(req:Request,res:Response)=>Promise<void>)=>async(req:Request,res:Response)=>{
 try{await fn(req,res);}catch(err){req.log.error({err},"AWS4 suite error");if(!res.headersSent)fail(res,500,"Operation could not be completed.");}
};
const actor=async(req:Request,res:Response,mode:"staff"|"manage"|"executive"="staff"):Promise<Actor|null>=>{
 const a=await getStaffAccess(req);
 if(!a){fail(res,401,"Sign in to the staff portal.");return null;}
 if(mode==="executive"&&!isCorporateExecutiveAccess(a)){fail(res,403,"Founder or ASH Corporate authorization required.");return null;}
 if(mode==="manage"&&!isCorporateExecutiveAccess(a)&&!hasPermission(a,"manageTasks")){fail(res,403,"Authorized manager access required.");return null;}
 return a;
};
let ready:Promise<void>|null=null;
const init=async()=>{
 if(!ready)ready=(async()=>{
  await ensureV4Tables();
  await exec("CREATE TABLE IF NOT EXISTS aws4_org_departments(id bigserial PRIMARY KEY,name text NOT NULL UNIQUE,description text NOT NULL DEFAULT '',leader_email text NOT NULL DEFAULT '',created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now())");
  await exec("CREATE TABLE IF NOT EXISTS aws4_org_memberships(staff_email text PRIMARY KEY,department_id bigint REFERENCES aws4_org_departments(id) ON DELETE SET NULL,reports_to_email text NOT NULL DEFAULT '',updated_at timestamptz DEFAULT now())");
  await exec("CREATE TABLE IF NOT EXISTS aws4_policies(id bigserial PRIMARY KEY,title text NOT NULL,body text NOT NULL,version integer NOT NULL DEFAULT 1,active boolean NOT NULL DEFAULT false,effective_at timestamptz,updated_by text NOT NULL,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now())");
  await exec("CREATE TABLE IF NOT EXISTS aws4_policy_acks(policy_id bigint NOT NULL REFERENCES aws4_policies(id) ON DELETE CASCADE,version integer NOT NULL,actor_email text NOT NULL,acknowledged_at timestamptz DEFAULT now(),PRIMARY KEY(policy_id,version,actor_email))");
  await exec("CREATE TABLE IF NOT EXISTS aws4_broadcasts(id bigserial PRIMARY KEY,title text NOT NULL,body text NOT NULL,scope text NOT NULL DEFAULT 'all',target text NOT NULL DEFAULT '',requires_ack boolean NOT NULL DEFAULT false,created_by text NOT NULL,created_at timestamptz DEFAULT now())");
  await exec("CREATE TABLE IF NOT EXISTS aws4_broadcast_acks(broadcast_id bigint REFERENCES aws4_broadcasts(id) ON DELETE CASCADE,actor_email text NOT NULL,acknowledged_at timestamptz DEFAULT now(),PRIMARY KEY(broadcast_id,actor_email))");
  await exec("CREATE TABLE IF NOT EXISTS aws4_training_courses(id bigserial PRIMARY KEY,title text NOT NULL,description text NOT NULL DEFAULT '',content text NOT NULL DEFAULT '',role_scope text NOT NULL DEFAULT 'all',active boolean NOT NULL DEFAULT true,created_by text NOT NULL,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now())");
  await exec("CREATE TABLE IF NOT EXISTS aws4_training_progress(course_id bigint REFERENCES aws4_training_courses(id) ON DELETE CASCADE,actor_email text NOT NULL,completed_at timestamptz DEFAULT now(),PRIMARY KEY(course_id,actor_email))");
  await exec("ALTER TABLE aws4_training_courses ADD COLUMN IF NOT EXISTS quiz_question text NOT NULL DEFAULT ''");
  await exec("ALTER TABLE aws4_training_courses ADD COLUMN IF NOT EXISTS quiz_choices jsonb NOT NULL DEFAULT '[]'::jsonb");
  await exec("ALTER TABLE aws4_training_courses ADD COLUMN IF NOT EXISTS correct_choice integer");
  await exec("CREATE TABLE IF NOT EXISTS aws4_staff_requests_v4(id bigserial PRIMARY KEY,kind text NOT NULL,actor_email text NOT NULL,actor_name text NOT NULL,title text NOT NULL,details text NOT NULL DEFAULT '',start_date text NOT NULL DEFAULT '',end_date text NOT NULL DEFAULT '',status text NOT NULL DEFAULT 'pending',reviewed_by text,reviewed_at timestamptz,created_at timestamptz DEFAULT now())");
  await exec("CREATE TABLE IF NOT EXISTS aws4_recognition(id bigserial PRIMARY KEY,actor_email text NOT NULL,awarded_by text NOT NULL,title text NOT NULL,description text NOT NULL DEFAULT '',created_at timestamptz DEFAULT now())");
  await exec("CREATE TABLE IF NOT EXISTS aws4_executive_delegations(id bigserial PRIMARY KEY,delegate_email text NOT NULL,scope text NOT NULL,reason text NOT NULL DEFAULT '',granted_by text NOT NULL,expires_at timestamptz NOT NULL,revoked_at timestamptz,created_at timestamptz NOT NULL DEFAULT now())");
  await exec("CREATE INDEX IF NOT EXISTS idx_aws4_delegation_active ON aws4_executive_delegations(delegate_email,scope,expires_at) WHERE revoked_at IS NULL");
  await exec("CREATE TABLE IF NOT EXISTS aws4_feature_flags(key text PRIMARY KEY,label text NOT NULL,enabled boolean NOT NULL DEFAULT false,target_roles jsonb NOT NULL DEFAULT '[]'::jsonb,updated_by text NOT NULL,updated_at timestamptz DEFAULT now())");
  await exec("CREATE TABLE IF NOT EXISTS aws4_release_guides(id bigserial PRIMARY KEY,title text NOT NULL,description text NOT NULL DEFAULT '',body text NOT NULL DEFAULT '',scope text NOT NULL DEFAULT 'all',published boolean NOT NULL DEFAULT false,created_by text NOT NULL,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now())");
  await exec("CREATE TABLE IF NOT EXISTS aws4_release_acks(guide_id bigint REFERENCES aws4_release_guides(id) ON DELETE CASCADE,actor_email text NOT NULL,acknowledged_at timestamptz DEFAULT now(),PRIMARY KEY(guide_id,actor_email))");
  await exec("CREATE TABLE IF NOT EXISTS aws4_resource_bookmarks(client_id bigint REFERENCES client_accounts(id) ON DELETE CASCADE,resource_id bigint REFERENCES wellness_resources(id) ON DELETE CASCADE,created_at timestamptz DEFAULT now(),PRIMARY KEY(client_id,resource_id))");
 })().catch(e=>{ready=null;throw e;});
 await ready;
};
const validDelegationScopes = ["review_staff_requests","manage_training"] as const;
async function hasDelegation(email:string,scope:string) {
 await init();
 return Boolean(rows(await exec("SELECT id FROM aws4_executive_delegations WHERE delegate_email="+q(email)+" AND scope="+q(scope)+" AND revoked_at IS NULL AND expires_at>now() LIMIT 1"))[0]);
}
router.get("/delegations",requireAuth,safe(async(req,res)=>{
 const a=await actor(req,res);if(!a)return;await init();
 const filter=isCorporateExecutiveAccess(a)?"":" WHERE delegate_email="+q(a.email);
 res.json(rows(await exec('SELECT id,delegate_email AS "delegateEmail",scope,reason,granted_by AS "grantedBy",expires_at AS "expiresAt",revoked_at AS "revokedAt",created_at AS "createdAt" FROM aws4_executive_delegations'+filter+" ORDER BY created_at DESC LIMIT 250")));
}));
router.post("/delegations",requireAuth,safe(async(req,res)=>{
 const a=await actor(req,res,"executive");if(!a)return;
 const email=clean(req.body?.delegateEmail,200).toLowerCase(),scope=clean(req.body?.scope,100),reason=clean(req.body?.reason,750);
 const expiresAt=new Date(String(req.body?.expiresAt||""));
 if(!validDelegationScopes.includes(scope as any)||!email||email===a.email||!Number.isFinite(expiresAt.getTime())||expiresAt.getTime()<=Date.now()||expiresAt.getTime()-Date.now()>30*24*3600000){fail(res,400,"Choose an authorized scope, another staff member and an expiry within 30 days.");return;}
 await init();
 const target=rows(await exec("SELECT email,role FROM staff_accounts WHERE email="+q(email)+" LIMIT 1"))[0];
 if(!target||target.role==="ash_executive"){fail(res,400,"Choose a non-executive staff member.");return;}
 const item=rows(await exec("INSERT INTO aws4_executive_delegations(delegate_email,scope,reason,granted_by,expires_at) VALUES ("+q(email)+","+q(scope)+","+q(reason)+","+q(a.email)+","+q(expiresAt.toISOString())+"::timestamptz) RETURNING id"))[0];
 await recordAudit(req,"granted_time_limited_delegation","aws4_executive_delegations",String(item.id),scope);
 res.status(201).json({id:Number(item.id),delegateEmail:email,scope,expiresAt:expiresAt.toISOString()});
}));
router.post("/delegations/:id/revoke",requireAuth,safe(async(req,res)=>{
 const a=await actor(req,res,"executive");if(!a)return;const n=id(req.params.id);if(!n){fail(res,400,"Invalid delegation.");return;}await init();
 const result=rows(await exec("UPDATE aws4_executive_delegations SET revoked_at=now() WHERE id="+n+" AND revoked_at IS NULL RETURNING id"))[0];
 if(!result){fail(res,404,"Active delegation not found.");return;}
 await recordAudit(req,"revoked_delegation","aws4_executive_delegations",String(n));res.json({revoked:true});
}));
const visibleScope=(a:Actor,scope:string,target:string)=>{
 if(scope==="all")return true;
 if(scope==="role")return target===a.role;
 return false;
};

router.get("/organization",requireAuth,safe(async(req,res)=>{
 const a=await actor(req,res);if(!a)return;await init();
 const staff=rows(await exec('SELECT s.name,s.email,s.role,s.bio,s.photo_url AS "photoUrl",m.department_id AS "departmentId",m.reports_to_email AS "reportsToEmail",d.name AS "department" FROM staff_accounts s LEFT JOIN aws4_org_memberships m ON m.staff_email=s.email LEFT JOIN aws4_org_departments d ON d.id=m.department_id WHERE s.is_visible=true ORDER BY s.name'));
 const departments=rows(await exec('SELECT id,name,description,leader_email AS "leaderEmail" FROM aws4_org_departments ORDER BY name'));
 res.json({staff:staff.map(x=>({...x,roleLabel:x.role==="therapist"?"Wellness Staff":x.role==="ash_executive"?"ASH Executive":x.role})),departments,founder:{name:"Ayden",roleLabel:"Founder & CEO"}});
}));
router.post("/organization/departments",requireAuth,safe(async(req,res)=>{
 const a=await actor(req,res,"executive");if(!a)return;const name=clean(req.body?.name,120),description=clean(req.body?.description,1000),leader=clean(req.body?.leaderEmail,200).toLowerCase();
 if(!name){fail(res,400,"Department name required.");return;}await init();
 const result=rows(await exec("INSERT INTO aws4_org_departments(name,description,leader_email) VALUES ("+q(name)+","+q(description)+","+q(leader)+") RETURNING id,name"))[0];
 await recordAudit(req,"created_department","aws4_org_departments",String(result.id));res.status(201).json(result);
}));
router.patch("/organization/membership",requireAuth,safe(async(req,res)=>{
 if(!await actor(req,res,"executive"))return;
 const email=clean(req.body?.email,200).toLowerCase(),reportsTo=clean(req.body?.reportsToEmail,200).toLowerCase(),department=id(req.body?.departmentId);
 await init();const member=rows(await exec("SELECT email FROM staff_accounts WHERE email="+q(email)+" LIMIT 1"))[0];
 if(!member){fail(res,404,"Staff member not found.");return;}
 if(reportsTo===email){fail(res,400,"Staff members cannot report to themselves.");return;}
 if(department&&!rows(await exec("SELECT id FROM aws4_org_departments WHERE id="+department))[0]){fail(res,404,"Department not found.");return;}
 await exec("INSERT INTO aws4_org_memberships(staff_email,department_id,reports_to_email) VALUES ("+q(email)+","+(department||"NULL")+","+q(reportsTo)+") ON CONFLICT(staff_email) DO UPDATE SET department_id=EXCLUDED.department_id,reports_to_email=EXCLUDED.reports_to_email,updated_at=now()");
 await recordAudit(req,"changed_organization_membership","staff",email);res.json({success:true});
}));
router.get("/operations/live",requireAuth,safe(async(req,res)=>{
 const a=await actor(req,res);if(!a)return;await init();
 const statusRows=rows(await exec("SELECT status,count(*)::int AS count FROM bookings GROUP BY status"));
 const staff=rows(await exec("SELECT role,count(*)::int AS count FROM staff_accounts GROUP BY role"));
 const today=rows(await exec("SELECT count(*)::int AS count FROM bookings WHERE preferred_date=CURRENT_DATE::text AND status NOT IN ('cancelled','waitlisted')"))[0];
 const pending=rows(await exec("SELECT count(*)::int AS count FROM aws4_staff_manual_logs WHERE created_at >= CURRENT_DATE"))[0];
 res.setHeader("Cache-Control","private, no-store");
 res.json({asOf:new Date().toISOString(),todayAppointments:Number(today?.count||0),manualLogsToday:Number(pending?.count||0),bookingsByStatus:statusRows,staffByRole:staff});
}));
router.get("/operations/reports",requireAuth,safe(async(req,res)=>{
 if(!await actor(req,res,"executive"))return;await init();
 const monthly=rows(await exec("SELECT to_char(created_at,'YYYY-MM') AS month,count(*)::int AS bookings,count(*) FILTER (WHERE status='completed')::int AS completed,count(*) FILTER (WHERE status='cancelled')::int AS cancelled FROM bookings WHERE created_at >= now()-interval '12 months' GROUP BY 1 ORDER BY 1"));
 const approvals=rows(await exec("SELECT status,count(*)::int AS count FROM aws4_career_applications GROUP BY status"));
 const logs=rows(await exec("SELECT to_char(created_at,'YYYY-MM') AS month,count(*)::int AS count FROM aws4_staff_manual_logs WHERE created_at>=now()-interval '12 months' GROUP BY 1 ORDER BY 1"));
 res.json({monthly,applicationsByStatus:approvals,staffLogsByMonth:logs,asOf:new Date().toISOString(),note:"Aggregate operational metrics only. No individual client health records."});
}));

// Role-targeted, acknowledgment-backed broadcasts.
router.get("/broadcasts",requireAuth,safe(async(req,res)=>{
 const a=await actor(req,res);if(!a)return;await init();
 const member=rows(await exec("SELECT d.name FROM aws4_org_memberships m JOIN aws4_org_departments d ON d.id=m.department_id WHERE m.staff_email="+q(a.email)))[0];
 const all=rows(await exec('SELECT b.id,b.title,b.body,b.scope,b.target,b.requires_ack AS "requiresAck",b.created_by AS "createdBy",b.created_at AS "createdAt",EXISTS(SELECT 1 FROM aws4_broadcast_acks x WHERE x.broadcast_id=b.id AND x.actor_email='+q(a.email)+') AS acknowledged FROM aws4_broadcasts b ORDER BY b.created_at DESC LIMIT 150'));
 res.json(all.filter(v=>isCorporateExecutiveAccess(a)||visibleScope(a,v.scope,v.target)||(v.scope==="department"&&v.target===member?.name)));
}));
router.post("/broadcasts",requireAuth,safe(async(req,res)=>{
 const a=await actor(req,res,"executive");if(!a)return;const title=clean(req.body?.title,160),body=clean(req.body?.body,3500),scope=clean(req.body?.scope,20),target=clean(req.body?.target,120),requiresAck=req.body?.requiresAck===true;
 if(!title||!body||!["all","role","department"].includes(scope)||((scope==="role"||scope==="department")&&!target)){fail(res,400,"A title, message and audience are required.");return;}
 await init();const item=rows(await exec("INSERT INTO aws4_broadcasts(title,body,scope,target,requires_ack,created_by) VALUES ("+q(title)+","+q(body)+","+q(scope)+","+q(target)+","+(requiresAck?"true":"false")+","+q(a.email)+") RETURNING id,title"))[0];await recordAudit(req,"sent_executive_broadcast","aws4_broadcasts",String(item.id));res.status(201).json(item);
}));
router.post("/broadcasts/:id/ack",requireAuth,safe(async(req,res)=>{
 const a=await actor(req,res);if(!a)return;const n=id(req.params.id);if(!n){fail(res,400,"Invalid ID.");return;}await init();
 const b=rows(await exec("SELECT scope,target,requires_ack FROM aws4_broadcasts WHERE id="+n))[0];
 const member=rows(await exec("SELECT d.name FROM aws4_org_memberships m JOIN aws4_org_departments d ON d.id=m.department_id WHERE m.staff_email="+q(a.email)))[0];
 if(!b||!(isCorporateExecutiveAccess(a)||visibleScope(a,b.scope,b.target)||(b.scope==="department"&&b.target===member?.name))){fail(res,404,"Broadcast not found.");return;}
 await exec("INSERT INTO aws4_broadcast_acks(broadcast_id,actor_email) VALUES ("+n+","+q(a.email)+") ON CONFLICT DO NOTHING");res.json({acknowledged:true});
}));

router.get("/policies",requireAuth,safe(async(req,res)=>{
 const a=await actor(req,res);if(!a)return;await init();
 const predicate=isCorporateExecutiveAccess(a)?"":" WHERE p.active=true";
 res.json(rows(await exec('SELECT p.id,p.title,p.body,p.version,p.active,p.effective_at AS "effectiveAt",p.updated_by AS "updatedBy",p.updated_at AS "updatedAt",EXISTS(SELECT 1 FROM aws4_policy_acks k WHERE k.policy_id=p.id AND k.version=p.version AND k.actor_email='+q(a.email)+') AS acknowledged FROM aws4_policies p'+predicate+" ORDER BY p.updated_at DESC LIMIT 200")));
}));
router.post("/policies",requireAuth,safe(async(req,res)=>{
 const a=await actor(req,res,"executive");if(!a)return;const title=clean(req.body?.title,180),body=clean(req.body?.body,10000);
 if(!title||!body){fail(res,400,"A title and policy document are required.");return;}await init();
 const item=rows(await exec("INSERT INTO aws4_policies(title,body,updated_by) VALUES ("+q(title)+","+q(body)+","+q(a.email)+") RETURNING id,title"))[0];
 await recordAudit(req,"created_policy_draft","aws4_policies",String(item.id));res.status(201).json(item);
}));
router.patch("/policies/:id",requireAuth,safe(async(req,res)=>{
 const a=await actor(req,res,"executive");if(!a)return;const n=id(req.params.id);if(!n){fail(res,400,"Invalid ID.");return;}await init();
 const prior=rows(await exec("SELECT title,body,version,active FROM aws4_policies WHERE id="+n))[0];if(!prior){fail(res,404,"Policy not found.");return;}
 const title=req.body?.title===undefined?prior.title:clean(req.body.title,180);
 const body=req.body?.body===undefined?prior.body:clean(req.body.body,10000);
 const active=req.body?.active===undefined?prior.active:req.body.active===true;
 if(!title||!body){fail(res,400,"Title and body required.");return;}
 const change=title!==prior.title||body!==prior.body;
 const version=Number(prior.version)+(change?1:0);
 await exec("UPDATE aws4_policies SET title="+q(title)+",body="+q(body)+",version="+version+",active="+(active?"true":"false")+",effective_at="+(active?"COALESCE(effective_at,now())":"NULL")+",updated_by="+q(a.email)+",updated_at=now() WHERE id="+n);
 await recordAudit(req,"updated_policy","aws4_policies",String(n),"version="+version+";published="+active);res.json({id:n,version,active});
}));
router.post("/policies/:id/ack",requireAuth,safe(async(req,res)=>{
 const a=await actor(req,res);if(!a)return;const n=id(req.params.id);if(!n){fail(res,400,"Invalid ID.");return;}await init();
 const policy=rows(await exec("SELECT version FROM aws4_policies WHERE id="+n+" AND active=true"))[0];if(!policy){fail(res,404,"Published policy not found.");return;}
 await exec("INSERT INTO aws4_policy_acks(policy_id,version,actor_email) VALUES ("+n+","+Number(policy.version)+","+q(a.email)+") ON CONFLICT DO NOTHING");res.json({acknowledged:true});
}));
router.get("/policies/:id/acknowledgments",requireAuth,safe(async(req,res)=>{
 if(!await actor(req,res,"executive"))return;const n=id(req.params.id);if(!n){fail(res,400,"Invalid ID.");return;}await init();
 res.json(rows(await exec('SELECT actor_email AS "email",version,acknowledged_at AS "at" FROM aws4_policy_acks WHERE policy_id='+n+" ORDER BY acknowledged_at DESC")));
}));

// Staff requests for leave and shift swaps: managers make decisions but cannot rewrite requests.
const kinds=new Set(["leave","shift_swap","coverage","availability"]);
router.get("/staff-requests",requireAuth,safe(async(req,res)=>{
 const a=await actor(req,res);if(!a)return;await init();
 const allowed=isCorporateExecutiveAccess(a)||hasPermission(a,"manageTasks");
 res.json(rows(await exec('SELECT id,kind,actor_email AS "actorEmail",actor_name AS "actorName",title,details,start_date AS "startDate",end_date AS "endDate",status,reviewed_by AS "reviewedBy",created_at AS "createdAt" FROM aws4_staff_requests_v4'+(allowed?"":" WHERE actor_email="+q(a.email))+" ORDER BY created_at DESC LIMIT 250")));
}));
router.post("/staff-requests",requireAuth,safe(async(req,res)=>{
 const a=await actor(req,res);if(!a)return;const kind=clean(req.body?.kind,30),title=clean(req.body?.title,160),details=clean(req.body?.details,1700),start=clean(req.body?.startDate,10),end=clean(req.body?.endDate,10);
 if(!kinds.has(kind)||!title||(start&&!/^\d{4}-\d{2}-\d{2}$/.test(start))||(end&&!/^\d{4}-\d{2}-\d{2}$/.test(end))||(start&&end&&end<start)){fail(res,400,"Invalid request or dates.");return;}await init();
 const row=rows(await exec("INSERT INTO aws4_staff_requests_v4(kind,actor_email,actor_name,title,details,start_date,end_date) VALUES ("+q(kind)+","+q(a.email)+","+q(a.name)+","+q(title)+","+q(details)+","+q(start)+","+q(end)+") RETURNING id,title,status"))[0];
 await recordAudit(req,"requested_"+kind,"aws4_staff_requests_v4",String(row.id));res.status(201).json(row);
}));
router.patch("/staff-requests/:id/decision",requireAuth,safe(async(req,res)=>{
 const a=await actor(req,res);if(!a)return; if(!isCorporateExecutiveAccess(a)&&!hasPermission(a,"manageTasks")&&!(await hasDelegation(a.email,"review_staff_requests"))){fail(res,403,"An authorized supervisor must review this request.");return;} const n=id(req.params.id),status=clean(req.body?.status,30);
 if(!n||!["approved","denied"].includes(status)){fail(res,400,"Choose approve or deny.");return;}await init();
 const record=rows(await exec("SELECT status,actor_email FROM aws4_staff_requests_v4 WHERE id="+n))[0];
 if(!record){fail(res,404,"Request not found.");return;}if(record.status!=="pending"){fail(res,409,"The request was already reviewed.");return;}
 if(record.actor_email===a.email){fail(res,403,"A request cannot be approved by its own author.");return;}
 await exec("UPDATE aws4_staff_requests_v4 SET status="+q(status)+",reviewed_by="+q(a.email)+",reviewed_at=now() WHERE id="+n);
 await recordAudit(req,"reviewed_staff_request","aws4_staff_requests_v4",String(n),status);res.json({id:n,status});
}));

router.get("/training",requireAuth,safe(async(req,res)=>{
 const a=await actor(req,res);if(!a)return;await init();
 const viewDrafts=isCorporateExecutiveAccess(a)||hasPermission(a,"manageTasks");
 const items=rows(await exec('SELECT c.id,c.title,c.description,c.content,c.role_scope AS "roleScope",c.quiz_question AS "quizQuestion",c.quiz_choices AS "quizChoices",c.active,EXISTS(SELECT 1 FROM aws4_training_progress p WHERE p.course_id=c.id AND p.actor_email='+q(a.email)+') AS completed FROM aws4_training_courses c '+(viewDrafts?"":"WHERE c.active=true")+" ORDER BY c.created_at DESC"));
 res.json(items.filter(x=>viewDrafts||x.roleScope==="all"||x.roleScope===a.role));
}));
router.post("/training",requireAuth,safe(async(req,res)=>{
 const a=await actor(req,res);if(!a)return; if(!isCorporateExecutiveAccess(a)&&!hasPermission(a,"manageTasks")&&!(await hasDelegation(a.email,"manage_training"))){fail(res,403,"Training authoring access is required.");return;}
 const title=clean(req.body?.title,160),description=clean(req.body?.description,1200),content=clean(req.body?.content,8500),roleScope=clean(req.body?.roleScope,80)||"all";
 if(!title||!content){fail(res,400,"Training title and lesson content required.");return;}await init();
  const quizQuestion=clean(req.body?.quizQuestion,550);
  const choices=quizQuestion && Array.isArray(req.body?.quizChoices) ? req.body.quizChoices.map((x:unknown)=>clean(x,160)).filter(Boolean).slice(0,6) : [];
  const correctChoice=Number(req.body?.correctChoice);
  if(quizQuestion && (choices.length<2||!Number.isInteger(correctChoice)||correctChoice<0||correctChoice>=choices.length)){fail(res,400,"Quiz needs two or more choices and a valid correct answer.");return;}
  const row=rows(await exec("INSERT INTO aws4_training_courses(title,description,content,role_scope,quiz_question,quiz_choices,correct_choice,created_by) VALUES ("+q(title)+","+q(description)+","+q(content)+","+q(roleScope)+","+q(quizQuestion)+","+q(JSON.stringify(choices))+"::jsonb,"+(quizQuestion?correctChoice:"NULL")+","+q(a.email)+") RETURNING id,title"))[0];
 await recordAudit(req,"created_training_course","aws4_training_courses",String(row.id));res.status(201).json(row);
}));
router.post("/training/:id/complete",requireAuth,safe(async(req,res)=>{
 const a=await actor(req,res);if(!a)return;const n=id(req.params.id);if(!n){fail(res,400,"Invalid course.");return;}await init();
 const c=rows(await exec("SELECT active,role_scope,quiz_question,correct_choice FROM aws4_training_courses WHERE id="+n))[0];if(!c||!c.active||(c.role_scope!=="all"&&c.role_scope!==a.role&&!isCorporateExecutiveAccess(a))){fail(res,404,"Available training not found.");return;}
  if(c.quiz_question&&(!Number.isInteger(Number(req.body?.answerIndex))||Number(req.body?.answerIndex)!==Number(c.correct_choice))){fail(res,400,"Answer the course quiz correctly before completing training.");return;}
 await exec("INSERT INTO aws4_training_progress(course_id,actor_email) VALUES ("+n+","+q(a.email)+") ON CONFLICT DO NOTHING");
 res.json({completed:true,certificateLabel:"AWS Internal Training Completion",courseId:n,completedBy:a.name});
}));

router.get("/recognition",requireAuth,safe(async(req,res)=>{
 if(!await actor(req,res))return;await init();
 res.json(rows(await exec('SELECT r.id,r.actor_email AS "actorEmail",s.name AS "recipientName",r.awarded_by AS "awardedBy",r.title,r.description,r.created_at AS "createdAt" FROM aws4_recognition r LEFT JOIN staff_accounts s ON s.email=r.actor_email ORDER BY r.created_at DESC LIMIT 200')));
}));
router.post("/recognition",requireAuth,safe(async(req,res)=>{
 const a=await actor(req,res,"manage");if(!a)return;const email=clean(req.body?.actorEmail,180).toLowerCase(),title=clean(req.body?.title,160),description=clean(req.body?.description,900);
 if(!email||!title){fail(res,400,"Staff recipient and recognition title required.");return;}await init();
 const member=rows(await exec("SELECT email FROM staff_accounts WHERE email="+q(email)))[0];
 if(!member){fail(res,404,"Staff recipient not found.");return;}
 const item=rows(await exec("INSERT INTO aws4_recognition(actor_email,awarded_by,title,description) VALUES ("+q(email)+","+q(a.name)+","+q(title)+","+q(description)+") RETURNING id,title"))[0];
 await recordAudit(req,"recognized_staff_member","aws4_recognition",String(item.id));res.status(201).json(item);
}));

router.get("/feature-lab",requireAuth,safe(async(req,res)=>{
 const a=await actor(req,res);if(!a)return;await init();
 const all=rows(await exec('SELECT key,label,enabled,target_roles AS "targetRoles",updated_at AS "updatedAt" FROM aws4_feature_flags ORDER BY label'));
 res.json({canManage:isCorporateExecutiveAccess(a),items:all.filter(x=>isCorporateExecutiveAccess(a)||(x.enabled&&(x.targetRoles.length===0||x.targetRoles.includes(a.role))))});
}));
router.put("/feature-lab/:key",requireAuth,safe(async(req,res)=>{
 const a=await actor(req,res,"executive");if(!a)return;const key=clean(req.params.key,80);
 if(!/^[a-z][a-z0-9_-]{2,60}$/.test(key)){fail(res,400,"Invalid feature key.");return;}
 const label=clean(req.body?.label,140),enabled=req.body?.enabled===true,roles=Array.isArray(req.body?.targetRoles)?req.body.targetRoles.filter((x:unknown)=>typeof x==="string"&&x.length<80).slice(0,20):[];
 if(!label){fail(res,400,"Feature label required.");return;}await init();
 await exec("INSERT INTO aws4_feature_flags(key,label,enabled,target_roles,updated_by) VALUES ("+q(key)+","+q(label)+","+(enabled?"true":"false")+","+q(JSON.stringify(roles))+"::jsonb,"+q(a.email)+") ON CONFLICT(key) DO UPDATE SET label=EXCLUDED.label,enabled=EXCLUDED.enabled,target_roles=EXCLUDED.target_roles,updated_by=EXCLUDED.updated_by,updated_at=now()");
 await recordAudit(req,"changed_feature_lab","aws4_feature_flags",key,"enabled="+enabled);res.json({key,label,enabled,targetRoles:roles});
}));

router.get("/whats-new",requireAuth,safe(async(req,res)=>{
 const a=await actor(req,res);if(!a)return;await init();const all=rows(await exec('SELECT g.id,g.title,g.description,g.body,g.scope,g.published,g.created_at AS "createdAt",EXISTS(SELECT 1 FROM aws4_release_acks k WHERE k.guide_id=g.id AND k.actor_email='+q(a.email)+') AS acknowledged FROM aws4_release_guides g ORDER BY g.created_at DESC'));
 res.json(all.filter(x=>isCorporateExecutiveAccess(a)||(x.published&&(x.scope==="all"||x.scope===a.role))));
}));
router.post("/whats-new",requireAuth,safe(async(req,res)=>{
 const a=await actor(req,res,"executive");if(!a)return;const title=clean(req.body?.title,180),description=clean(req.body?.description,500),body=clean(req.body?.body,9000),scope=clean(req.body?.scope,80)||"all",published=req.body?.published===true;
 if(!title||!body){fail(res,400,"Release guide title and content required.");return;}await init();
 const item=rows(await exec("INSERT INTO aws4_release_guides(title,description,body,scope,published,created_by) VALUES ("+q(title)+","+q(description)+","+q(body)+","+q(scope)+","+(published?"true":"false")+","+q(a.email)+") RETURNING id,title"))[0];
 await recordAudit(req,"published_whats_new","aws4_release_guides",String(item.id));res.status(201).json(item);
}));
router.post("/whats-new/:id/ack",requireAuth,safe(async(req,res)=>{
 const a=await actor(req,res);if(!a)return;const n=id(req.params.id);if(!n){fail(res,400,"Invalid guide.");return;}await init();
 const item=rows(await exec("SELECT scope,published FROM aws4_release_guides WHERE id="+n))[0];
 if(!item||!item.published||!(item.scope==="all"||item.scope===a.role||isCorporateExecutiveAccess(a))){fail(res,404,"Guide not found.");return;}
 await exec("INSERT INTO aws4_release_acks(guide_id,actor_email) VALUES ("+n+","+q(a.email)+") ON CONFLICT DO NOTHING");res.json({acknowledged:true});
}));

// Client bookmark store is private per client; never reveals other clients' bookmarks.
router.get("/client/bookmarks",requireClientAuth,safe(async(req,res)=>{
 const n=id((req as RequestWithClientSession).clientSession?.id);if(!n){fail(res,401,"Client account required.");return;}await init();
 res.json(rows(await exec('SELECT r.id,r.title,r.description,r.category,r.content,r.url,r.is_emergency AS "isEmergency",EXISTS(SELECT 1 FROM aws4_resource_bookmarks b WHERE b.client_id='+n+' AND b.resource_id=r.id) AS bookmarked FROM wellness_resources r WHERE r.published=true ORDER BY r.category,r.title')));
}));
router.post("/client/bookmarks/:id",requireClientAuth,safe(async(req,res)=>{
 const client=id((req as RequestWithClientSession).clientSession?.id),resource=id(req.params.id);
 if(!client||!resource){fail(res,400,"Invalid bookmark.");return;}await init();
 if(!rows(await exec("SELECT id FROM wellness_resources WHERE id="+resource+" AND published=true"))[0]){fail(res,404,"Resource unavailable.");return;}
 await exec("INSERT INTO aws4_resource_bookmarks(client_id,resource_id) VALUES ("+client+","+resource+") ON CONFLICT DO NOTHING");res.json({bookmarked:true});
}));
router.delete("/client/bookmarks/:id",requireClientAuth,safe(async(req,res)=>{
 const client=id((req as RequestWithClientSession).clientSession?.id),resource=id(req.params.id);
 if(!client||!resource){fail(res,400,"Invalid bookmark.");return;}await init();
 await exec("DELETE FROM aws4_resource_bookmarks WHERE client_id="+client+" AND resource_id="+resource);res.json({bookmarked:false});
}));
export default router;
