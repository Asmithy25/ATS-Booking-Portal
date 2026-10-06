import { Router, type Request, type Response } from "express";
import crypto from "node:crypto";
import { db, auditLogsTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import { getStaffAccess, hasPermission, requireAuth } from "../middleware/auth";
import { ensureAdvancedStorage, getStaffPinPolicy, isAllowedPinLength, setStaffPinPolicy } from "../lib/advanced-storage";

const router = Router();
const exec = (query:string) => db.execute(sql.raw(query));
type Row = Record<string, any>;
const rows = <T extends Row = Row>(result:any):T[] => Array.isArray(result) ? result : (result?.rows ?? []);
const text = (value:unknown,max=5000) => String(value ?? "").trim().slice(0,max);
const q = (value:unknown) => value === null || value === undefined ? "NULL" : "'" + String(value).replace(/'/g,"''") + "'";

async function ensureNotifications(){
  await ensureAdvancedStorage();
  await exec("CREATE TABLE IF NOT EXISTS staff_notifications (id serial PRIMARY KEY,staff_email text NOT NULL,title text NOT NULL,body text NOT NULL,read boolean NOT NULL DEFAULT false,created_at timestamp NOT NULL DEFAULT now())");
}
async function notifyStaff(title:string,body:string){
  await ensureNotifications();
  const staff=rows<{email:string}>(await exec("SELECT email FROM staff_accounts"));
  const emails=staff.map(x=>x.email).filter((e,i,a)=>e&&a.indexOf(e)===i);
  for(const email of emails) await exec("INSERT INTO staff_notifications(staff_email,title,body,read,created_at) VALUES ("+q(email)+","+q(text(title,160))+","+q(text(body,500))+",false,now())");
}
async function capability(req:Request,res:Response,permission:string){
  const access=await getStaffAccess(req);
  if(!access){res.status(401).json({error:"Unauthorized."});return null;}
  if(!hasPermission(access,permission)){res.status(403).json({error:"You do not have permission for this feature."});return null;}
  return access;
}

router.get("/security/policy",requireAuth,async(req,res)=>{
  const access=await getStaffAccess(req);
  if(!access||access.role!=="founder"){res.status(403).json({error:"Founder access required."});return;}
  res.json({pinLength:await getStaffPinPolicy(),allowedLengths:[4,6,8]});
});
router.put("/security/policy",requireAuth,async(req,res)=>{
  const access=await getStaffAccess(req);
  if(!access||access.role!=="founder"){res.status(403).json({error:"Founder access required."});return;}
  const value=Number(req.body?.pinLength);
  if(!isAllowedPinLength(value)){res.status(400).json({error:"PIN length must be 4, 6, or 8."});return;}
  await setStaffPinPolicy(value);
  await db.insert(auditLogsTable).values({actorEmail:access.email,actorName:access.name,action:"updated_staff_pin_policy",entityType:"security_policy",entityId:"1",details:"Staff PIN policy set to "+value+" digits."});
  res.json({pinLength:value,allowedLengths:[4,6,8]});
});

router.get("/requests/people",requireAuth,async(req,res)=>{
  const access=await capability(req,res,"manageStaffRequests");if(!access)return;
  const people=rows(await exec("SELECT id,name,email,role FROM staff_accounts ORDER BY name"));
  if(access.role==="founder"&&!people.some(p=>p.email===access.email)) people.unshift({id:0,name:access.name,email:access.email,role:"founder"});
  res.json(people);
});
router.get("/requests",requireAuth,async(req,res)=>{
  const access=await capability(req,res,"manageStaffRequests");if(!access)return;
  await ensureAdvancedStorage();
  const list=rows<any>(await exec("SELECT r.id,r.requester_email AS \"requesterEmail\",r.assignee_email AS \"assigneeEmail\",r.title,r.description,r.priority,r.status,r.due_date AS \"dueDate\",r.created_at AS \"createdAt\",r.updated_at AS \"updatedAt\",rq.name AS \"requesterName\",aq.name AS \"assigneeName\" FROM staff_requests r LEFT JOIN staff_accounts rq ON rq.email=r.requester_email LEFT JOIN staff_accounts aq ON aq.email=r.assignee_email ORDER BY r.updated_at DESC"));
  const visible=access.role==="founder"?list:list.filter(item=>item.requesterEmail===access.email||item.assigneeEmail===access.email);
  for(const item of visible) item.comments=rows(await exec("SELECT id,author_email AS \"authorEmail\",author_name AS \"authorName\",body,created_at AS \"createdAt\" FROM staff_request_comments WHERE request_id="+Number(item.id)+" ORDER BY created_at ASC"));
  res.json(visible);
});
router.post("/requests",requireAuth,async(req,res)=>{
  const access=await capability(req,res,"manageStaffRequests");if(!access)return;
  const assignee=text(req.body?.assigneeEmail,320).toLowerCase(),title=text(req.body?.title,200),description=text(req.body?.description,4000),priority=text(req.body?.priority,20),dueDate=req.body?.dueDate?text(req.body.dueDate,10):null;
  if(!assignee||!title||!["low","normal","high","urgent"].includes(priority)){res.status(400).json({error:"Assignee, title, and valid priority are required."});return;}
  const target=rows<{email:string}>(await exec("SELECT email FROM staff_accounts WHERE lower(email)="+q(assignee)+" LIMIT 1"))[0];
  if(!target&&!(access.role==="founder"&&assignee===access.email)){res.status(404).json({error:"Staff member not found."});return;}
  const created=rows<{id:number}>(await exec("INSERT INTO staff_requests(requester_email,assignee_email,title,description,priority,status,due_date,created_at,updated_at) VALUES ("+q(access.email)+","+q(assignee)+","+q(title)+","+q(description)+","+q(priority)+",'open',"+q(dueDate)+",now(),now()) RETURNING id"))[0];
  await notifyStaff("New staff request",access.name+" sent you a request: "+title);
  res.status(201).json({success:true,id:created?.id});
});
router.patch("/requests/:id",requireAuth,async(req,res)=>{
  const access=await capability(req,res,"manageStaffRequests");if(!access)return;
  const id=Number(req.params.id);
  const item=rows<any>(await exec("SELECT * FROM staff_requests WHERE id="+id+" LIMIT 1"))[0];
  if(!item){res.status(404).json({error:"Request not found."});return;}
  if(access.role!=="founder"&&item.requester_email!==access.email&&item.assignee_email!==access.email){res.status(403).json({error:"You do not have access to this request."});return;}
  const status=req.body?.status!==undefined?text(req.body.status,20):null;
  if(status&&!["open","in_progress","completed","incomplete"].includes(status)){res.status(400).json({error:"Invalid request status."});return;}
  await exec("UPDATE staff_requests SET status=COALESCE("+q(status)+",status),updated_at=now() WHERE id="+id);
  if(status) await notifyStaff("Staff request updated",access.name+" updated \""+text(item.title,120)+"\" to "+status);
  res.json({success:true});
});
router.post("/requests/:id/comments",requireAuth,async(req,res)=>{
  const access=await capability(req,res,"manageStaffRequests");if(!access)return;
  const id=Number(req.params.id);
  const item=rows<any>(await exec("SELECT * FROM staff_requests WHERE id="+id+" LIMIT 1"))[0];
  if(!item){res.status(404).json({error:"Request not found."});return;}
  if(access.role!=="founder"&&item.requester_email!==access.email&&item.assignee_email!==access.email){res.status(403).json({error:"You do not have access to this request."});return;}
  const body=text(req.body?.body,3000);if(!body){res.status(400).json({error:"Comment cannot be empty."});return;}
  await exec("INSERT INTO staff_request_comments(request_id,author_email,author_name,body,created_at) VALUES ("+id+","+q(access.email)+","+q(access.name)+","+q(body)+",now())");
  await exec("UPDATE staff_requests SET updated_at=now() WHERE id="+id);
  await notifyStaff("New staff request comment",access.name+" commented on \""+text(item.title,120)+"\"");
  res.status(201).json({success:true});
});

router.post("/public-support",async(req,res)=>{
  await ensureAdvancedStorage();
  const name=text(req.body?.name,120),email=text(req.body?.email,320).toLowerCase(),phone=text(req.body?.phone,40),subject=text(req.body?.subject||"Support request",160),message=text(req.body?.message,4000);
  if(name.length<2||!email.includes("@")||!message){res.status(400).json({error:"Name, valid email, and message are required."});return;}
  const matched=rows<{id:number}>(await exec("SELECT id FROM client_accounts WHERE lower(email)="+q(email)+" OR phone="+q(phone)+" LIMIT 1"))[0];
  const token=crypto.randomBytes(32).toString("base64url");
  const created=rows<{id:number}>(await exec("INSERT INTO public_support_threads(token,name,email,phone,subject,status,client_account_id,created_at,updated_at) VALUES ("+q(token)+","+q(name)+","+q(email)+","+q(phone)+","+q(subject)+",'open',"+(matched?.id?String(matched.id):"NULL")+",now(),now()) RETURNING id"))[0];
  if(!created?.id){res.status(500).json({error:"Could not start the conversation."});return;}
  await exec("INSERT INTO public_support_messages(thread_id,sender_type,sender_name,body,read_by_staff,read_by_visitor,created_at) VALUES ("+created.id+",'visitor',"+q(name)+","+q(message)+",false,true,now())");
  await notifyStaff("New public support request",name+" started a support conversation: "+subject);
  const origin=String(req.headers.origin||process.env.PUBLIC_APP_ORIGIN||"https://atsbookingportal.up.railway.app").replace(/\/$/,"");
  res.status(201).json({success:true,token,url:origin+"/support/"+token});
});
router.get("/public-support/:token",async(req,res)=>{
  await ensureAdvancedStorage();
  const token=text(req.params.token,200);
  const thread=rows<any>(await exec("SELECT id,name,email,phone,subject,status,created_at AS \"createdAt\",updated_at AS \"updatedAt\" FROM public_support_threads WHERE token="+q(token)+" LIMIT 1"))[0];
  if(!thread){res.status(404).json({error:"Conversation not found."});return;}
  const messages=rows(await exec("SELECT id,sender_type AS \"senderType\",sender_name AS \"senderName\",body,created_at AS \"createdAt\" FROM public_support_messages WHERE thread_id="+Number(thread.id)+" ORDER BY created_at ASC"));
  await exec("UPDATE public_support_messages SET read_by_visitor=true WHERE thread_id="+Number(thread.id));
  res.json({...thread,messages});
});
router.post("/public-support/:token",async(req,res)=>{
  await ensureAdvancedStorage();
  const token=text(req.params.token,200),message=text(req.body?.message,4000);
  if(!message){res.status(400).json({error:"Message cannot be empty."});return;}
  const thread=rows<any>(await exec("SELECT id FROM public_support_threads WHERE token="+q(token)+" LIMIT 1"))[0];
  if(!thread){res.status(404).json({error:"Conversation not found."});return;}
  await exec("INSERT INTO public_support_messages(thread_id,sender_type,sender_name,body,read_by_staff,read_by_visitor,created_at) VALUES ("+Number(thread.id)+",'visitor','Visitor',"+q(message)+",false,true,now())");
  await exec("UPDATE public_support_threads SET status='open',updated_at=now() WHERE id="+Number(thread.id));
  await notifyStaff("New public support message","A visitor sent a new public support message.");
  res.status(201).json({success:true});
});
router.get("/staff-public-support",requireAuth,async(req,res)=>{
  const access=await capability(req,res,"viewClientMessages");if(!access)return;
  await ensureAdvancedStorage();
  const threads=rows<any>(await exec("SELECT id,name,email,phone,subject,status,client_account_id AS \"clientAccountId\",created_at AS \"createdAt\",updated_at AS \"updatedAt\" FROM public_support_threads ORDER BY updated_at DESC LIMIT 200"));
  for(const thread of threads) thread.messages=rows(await exec("SELECT id,sender_type AS \"senderType\",sender_name AS \"senderName\",body,read_by_staff AS \"readByStaff\",created_at AS \"createdAt\" FROM public_support_messages WHERE thread_id="+Number(thread.id)+" ORDER BY created_at ASC"));
  res.json(threads);
});
router.post("/staff-public-support/:id/reply",requireAuth,async(req,res)=>{
  const access=await capability(req,res,"viewClientMessages");if(!access)return;
  await ensureAdvancedStorage();
  const id=Number(req.params.id),message=text(req.body?.message,4000);
  if(!Number.isInteger(id)||!message){res.status(400).json({error:"Conversation and reply are required."});return;}
  const thread=rows<any>(await exec("SELECT id FROM public_support_threads WHERE id="+id+" LIMIT 1"))[0];if(!thread){res.status(404).json({error:"Conversation not found."});return;}
  await exec("INSERT INTO public_support_messages(thread_id,sender_type,sender_name,body,read_by_staff,read_by_visitor,created_at) VALUES ("+id+",'staff',"+q(access.name)+","+q(message)+",true,false,now())");
  await exec("UPDATE public_support_threads SET status='open',updated_at=now() WHERE id="+id);
  res.status(201).json({success:true});
});
router.patch("/staff-public-support/:id",requireAuth,async(req,res)=>{
  const access=await capability(req,res,"viewClientMessages");if(!access)return;
  const id=Number(req.params.id),status=text(req.body?.status,20);
  if(!Number.isInteger(id)||!["open","closed"].includes(status)){res.status(400).json({error:"Invalid conversation update."});return;}
  await exec("UPDATE public_support_threads SET status="+q(status)+",updated_at=now() WHERE id="+id);
  res.json({success:true});
});

export default router;