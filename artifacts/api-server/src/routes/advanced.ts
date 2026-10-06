import { Router, type Request, type Response } from "express";
import crypto from "node:crypto";
import { db, clientAccountsTable, staffAccountsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import {
  ADMIN_EMAIL,
  SESSION_COOKIE,
  getStaffAccess,
  hasPermission,
  hashPassword,
  requireAuth,
  requireClientAuth,
  signPayload,
  verifyPassword,
  verifyPayload,
} from "../middleware/auth";
import { ensureAdvancedStorage, getStaffSecurity } from "../lib/advanced-storage";

const router = Router();
const exec = (query: string) => db.execute(sql.raw(query));
type Row = Record<string, any>;
const rows = <T extends Row = Row>(result: any): T[] => Array.isArray(result) ? result : (result?.rows ?? []);
const text = (value: unknown, max = 5000) => String(value ?? "").trim().slice(0, max);

function clientId(req: Request) {
  const id = Number((req as any).clientSession?.id);
  return Number.isInteger(id) && id > 0 ? id : null;
}
async function staffCapability(req: Request, res: Response, permission: string) {
  const access = await getStaffAccess(req);
  if (!access) { res.status(401).json({ error: "Unauthorized." }); return null; }
  if (!hasPermission(access, permission)) { res.status(403).json({ error: "You do not have permission for this feature." }); return null; }
  return access;
}
function q(value: unknown) {
  if (value === null || value === undefined) return "NULL";
  return "'" + String(value).replace(/'/g, "''") + "'";
}
function qJson(value: unknown) {
  return q(JSON.stringify(value ?? {})) + "::jsonb";
}
async function aiText(instructions: string, input: string) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw Object.assign(new Error("AI is not configured yet. Add OPENAI_API_KEY to the Railway API service."), { statusCode: 503 });
  const model = process.env.OPENAI_MODEL || "gpt-5";
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { authorization: "Bearer " + key, "content-type": "application/json" },
    body: JSON.stringify({ model, instructions, input, max_output_tokens: 1400 }),
  });
  const data = await response.json() as any;
  if (!response.ok) throw Object.assign(new Error(data?.error?.message || "AI request failed."), { statusCode: response.status });
  return String(data?.output_text || "");
}
function parseJson(value: string) {
  return JSON.parse(value.trim());
}
function progressPercent(config: any, progress: any) {
  const p = progress && typeof progress === "object" ? progress : {};
  if (config?.kind === "checklist") {
    const items = Array.isArray(config.items) ? config.items : [];
    const done = items.filter((_: unknown, index: number) => p.items?.[String(index)] === true).length;
    return items.length ? Math.round(done / items.length * 100) : 0;
  }
  if (config?.kind === "reflection") return p.text?.trim() ? 100 : 0;
  if (config?.kind === "spreadsheet") return Math.min(100, Math.round((Array.isArray(p.rows) ? p.rows.length : 0) / Math.max(1, Number(config.requiredRows || 1)) * 100));
  if (config?.kind === "weekly") return Math.min(100, Math.round((Array.isArray(p.completedWeeks) ? p.completedWeeks.length : 0) / Math.max(1, Number(config.weeks || 1)) * 100));
  return p.completed ? 100 : p.started ? 25 : 0;
}
function safeOrigin(req: Request) {
  const origin = String(req.headers.origin || process.env.PUBLIC_APP_ORIGIN || "https://atsbookingportal.up.railway.app").replace(/\/$/, "");
  try { const u = new URL(origin); return u.protocol + "//" + u.host; } catch { return "https://atsbookingportal.up.railway.app"; }
}
function b64url(value: Buffer | Uint8Array | string) {
  return typeof value === "string" ? Buffer.from(value).toString("base64url") : Buffer.from(value).toString("base64url");
}
function fromB64url(value: string) { return Buffer.from(value, "base64url"); }
function signatureToDer(value: Buffer) {
  if (value[0] === 0x30) return value;
  if (value.length !== 64) throw new Error("Unsupported passkey signature.");
  const normalize = (chunk: Buffer) => {
    let out = Buffer.from(chunk);
    while (out.length > 1 && out[0] === 0) out = out.subarray(1);
    if (out[0] & 0x80) out = Buffer.concat([Buffer.from([0]), out]);
    return out;
  };
  const r = normalize(value.subarray(0,32));
  const s = normalize(value.subarray(32,64));
  const body = Buffer.concat([Buffer.from([0x02,r.length]),r,Buffer.from([0x02,s.length]),s]);
  return Buffer.concat([Buffer.from([0x30,body.length]),body]);
}
function issueStaffSession(res: Response, email: string, name: string) {
  res.cookie(SESSION_COOKIE, signPayload({ email, name }), { httpOnly:true, sameSite:"none", secure:process.env.NODE_ENV === "production", path:"/" });
}
async function verifyStaffPassword(email: string, password: string) {
  const key = email.toLowerCase().trim();
  if (key === ADMIN_EMAIL) return Boolean(process.env.AYDEN_ADMIN_PASSWORD && process.env.AYDEN_ADMIN_PASSWORD === password);
  const [staff] = await db.select({ name:staffAccountsTable.name, passwordHash:staffAccountsTable.passwordHash }).from(staffAccountsTable).where(eq(staffAccountsTable.email,key)).limit(1);
  return Boolean(staff && verifyPassword(password, staff.passwordHash));
}
async function staffName(email: string) {
  const key = email.toLowerCase().trim();
  if (key === ADMIN_EMAIL) return "Ayden";
  const [staff] = await db.select({ name:staffAccountsTable.name }).from(staffAccountsTable).where(eq(staffAccountsTable.email,key)).limit(1);
  return staff?.name ?? null;
}

router.get("/staff/care-overview", requireAuth, async (req,res) => {
  const access = await getStaffAccess(req);
  if (!access) { res.status(401).json({error:"Unauthorized."}); return; }
  await ensureAdvancedStorage();
  const today = new Date().toISOString().slice(0,10);
  const result:any = await exec("SELECT (SELECT count(*)::int FROM bookings WHERE preferred_date="+q(today)+" AND status <> 'cancelled') AS \"bookingsToday\",(SELECT count(*)::int FROM support_threads WHERE status='open') AS \"openMessages\",(SELECT count(*)::int FROM client_uploads WHERE created_at >= now()-interval '7 days') AS \"recentUploads\",(SELECT count(*)::int FROM wellness_assignments WHERE status <> 'completed') AS \"activeAssignments\",(SELECT count(*)::int FROM staff_tasks WHERE status <> 'done') AS \"openTasks\"");
  res.json({...((result?.rows||result||[])[0]||{}),role:access.role,name:access.name});
});

router.get("/staff/security-center", requireAuth, async (req,res) => {
  const access=await getStaffAccess(req);if(!access){res.status(401).json({error:"Unauthorized."});return;}
  const security=await getStaffSecurity(access.email);
  res.json({email:access.email,pinConfigured:Boolean(security?.pin_hash),passkeys:(security?.passkeys||[]).map((p:any)=>({id:p.id,transports:p.transports||[]}))});
});
router.post("/staff/pin/change", requireAuth, async (req,res) => {
  const access=await getStaffAccess(req);if(!access){res.status(401).json({error:"Unauthorized."});return;}
  const currentPin=text(req.body?.currentPin,6),newPin=text(req.body?.newPin,6);
  if(!/^\d{6}$/.test(currentPin)||!/^\d{6}$/.test(newPin)){res.status(400).json({error:"PINs must be exactly 6 digits."});return;}
  const security=await getStaffSecurity(access.email);
  if(!security?.pin_hash||!verifyPassword(currentPin,security.pin_hash)){res.status(401).json({error:"Current PIN is incorrect."});return;}
  await exec("UPDATE staff_security SET pin_hash="+q(hashPassword(newPin))+",last_pin_set_at=now(),updated_at=now() WHERE email="+q(access.email.toLowerCase()));
  res.json({success:true});
});
router.post("/staff/passkey/options", async (req,res) => {
  const email=text(req.body?.email,320).toLowerCase(),password=text(req.body?.password,500);
  if(!email||!password||!(await verifyStaffPassword(email,password))){res.status(401).json({error:"Invalid email or password."});return;}
  const security=await getStaffSecurity(email);
  if(!security?.pin_hash||!(security.passkeys||[]).length){res.status(404).json({error:"Set a PIN and register a passkey first."});return;}
  const challenge=b64url(crypto.randomBytes(32)),origin=safeOrigin(req),rpId=new URL(origin).hostname;
  await exec("INSERT INTO passkey_challenges(email,challenge,origin,rp_id,purpose,expires_at,created_at) VALUES ("+q(email)+","+q(challenge)+","+q(origin)+","+q(rpId)+",'authenticate',now()+interval '5 minutes',now())");
  res.json({challenge,rpId,timeout:120000,userVerification:"required",allowCredentials:(security.passkeys||[]).map((p:any)=>({type:"public-key",id:p.id,transports:p.transports||[]}))});
});
router.post("/staff/passkey/verify", async (req,res) => {
  try{
    const email=text(req.body?.email,320).toLowerCase(),id=text(req.body?.id,500),clientDataRaw=text(req.body?.clientDataJSON,20000),authDataRaw=text(req.body?.authenticatorData,20000),sigRaw=text(req.body?.signature,20000);
    const challenge=rows<{challenge:string;origin:string;rpId:string}>(await exec("SELECT challenge,origin,rp_id AS \"rpId\" FROM passkey_challenges WHERE email="+q(email)+" AND purpose='authenticate' AND expires_at>now() ORDER BY created_at DESC LIMIT 1"))[0];
    if(!challenge)throw new Error("Passkey request expired.");
    await exec("DELETE FROM passkey_challenges WHERE email="+q(email)+" AND purpose='authenticate'");
    const clientData=JSON.parse(fromB64url(clientDataRaw).toString("utf8"));
    if(clientData.type!=="webauthn.get"||clientData.challenge!==challenge.challenge||clientData.origin!==challenge.origin)throw new Error("Passkey verification failed.");
    const security=await getStaffSecurity(email),credential=(security?.passkeys||[]).find((p:any)=>p.id===id);if(!credential)throw new Error("Passkey not recognized.");
    const authData=fromB64url(authDataRaw);if(authData.length<37)throw new Error("Invalid authenticator data.");
    const rpHash=crypto.createHash("sha256").update(challenge.rpId).digest();if(!crypto.timingSafeEqual(rpHash,authData.subarray(0,32)))throw new Error("Passkey RP mismatch.");
    const flags=authData[32];if(!(flags&1)||!(flags&4))throw new Error("Fingerprint/Face ID verification was not completed.");
    const counter=authData.readUInt32BE(33);if(credential.signCount&&counter&&counter<=credential.signCount)throw new Error("Passkey counter verification failed.");
    const signed=Buffer.concat([authData,crypto.createHash("sha256").update(fromB64url(clientDataRaw)).digest()]);
    if(!crypto.verify("sha256",signed,{key:fromB64url(credential.publicKey),dsaEncoding:"der"},signatureToDer(fromB64url(sigRaw))))throw new Error("Passkey signature could not be verified.");
    const name=await staffName(email);if(!name)throw new Error("Staff account not found.");
    const next=(security?.passkeys||[]).map((p:any)=>p.id===id?{...p,signCount:counter}:p);
    await exec("UPDATE staff_security SET passkeys="+qJson(next)+",updated_at=now() WHERE email="+q(email));
    res.json({authenticated:true,pendingToken:signPayload({email,name,auth:"passkey",exp:String(Date.now()+300000)}),staffName:name});
  }catch(error:any){res.status(401).json({error:error?.message||"Passkey authentication failed."});}
});
router.post("/staff/passkey/complete", async (req,res) => {
  const pending=req.body?.pendingToken?verifyPayload(req.body.pendingToken):null,pin=text(req.body?.pin,6);
  if(!pending||pending.auth!=="passkey"||!pending.email||!pending.name||Number(pending.exp)<Date.now()){res.status(401).json({error:"Passkey sign-in expired."});return;}
  if(!/^\d{6}$/.test(pin)){res.status(400).json({error:"PIN must be exactly 6 digits."});return;}
  const security=await getStaffSecurity(pending.email);if(!security?.pin_hash||!verifyPassword(pin,security.pin_hash)){res.status(401).json({error:"Invalid PIN."});return;}
  issueStaffSession(res,pending.email,pending.name);res.json({success:true,staffName:pending.name});
});
router.post("/staff/passkey/register-options", requireAuth, async (req,res) => {
  const access=await getStaffAccess(req);if(!access){res.status(401).json({error:"Unauthorized."});return;}
  const security=await getStaffSecurity(access.email);if(!security?.pin_hash){res.status(409).json({error:"Set your 6-digit PIN before registering a passkey."});return;}
  const challenge=b64url(crypto.randomBytes(32)),origin=safeOrigin(req),rpId=new URL(origin).hostname;
  await exec("INSERT INTO passkey_challenges(email,challenge,origin,rp_id,purpose,expires_at,created_at) VALUES ("+q(access.email.toLowerCase())+","+q(challenge)+","+q(origin)+","+q(rpId)+",'register',now()+interval '5 minutes',now())");
  res.json({challenge,rp:{name:"Aydens Wellness Services",id:rpId},user:{id:b64url(crypto.createHash("sha256").update(access.email).digest().subarray(0,16)),name:access.email,displayName:access.name},pubKeyCredParams:[{type:"public-key",alg:-7}],authenticatorSelection:{authenticatorAttachment:"platform",residentKey:"preferred",userVerification:"required"},timeout:120000,attestation:"none"});
});
router.post("/staff/passkey/register", requireAuth, async (req,res) => {
  const access=await getStaffAccess(req);if(!access){res.status(401).json({error:"Unauthorized."});return;}
  try{
    const id=text(req.body?.id,500),publicKey=text(req.body?.publicKey,10000),clientDataRaw=text(req.body?.clientDataJSON,20000);
    const challenge=rows<{challenge:string;origin:string}>(await exec("SELECT challenge,origin FROM passkey_challenges WHERE email="+q(access.email.toLowerCase())+" AND purpose='register' AND expires_at>now() ORDER BY created_at DESC LIMIT 1"))[0];
    if(!challenge)throw new Error("Passkey registration expired.");
    await exec("DELETE FROM passkey_challenges WHERE email="+q(access.email.toLowerCase())+" AND purpose='register'");
    const clientData=JSON.parse(fromB64url(clientDataRaw).toString("utf8"));if(clientData.type!=="webauthn.create"||clientData.challenge!==challenge.challenge||clientData.origin!==challenge.origin)throw new Error("Passkey registration failed.");
    if(fromB64url(publicKey).length<40)throw new Error("Invalid public key.");
    const security=await getStaffSecurity(access.email),next=[...(security?.passkeys||[]).filter((p:any)=>p.id!==id),{id,publicKey,signCount:0,transports:Array.isArray(req.body?.transports)?req.body.transports:[]}];
    await exec("UPDATE staff_security SET passkeys="+qJson(next)+",updated_at=now() WHERE email="+q(access.email.toLowerCase()));
    res.json({success:true});
  }catch(error:any){res.status(400).json({error:error?.message||"Could not register passkey."});}
});
router.delete("/staff/passkey/:id",requireAuth,async(req,res)=>{const access=await getStaffAccess(req);if(!access){res.status(401).json({error:"Unauthorized."});return;}const security=await getStaffSecurity(access.email),next=(security?.passkeys||[]).filter((p:any)=>p.id!==String(req.params.id));await exec("UPDATE staff_security SET passkeys="+qJson(next)+",updated_at=now() WHERE email="+q(access.email.toLowerCase()));res.json({success:true});});

// Messaging
router.get("/client/messages",requireClientAuth,async(req,res)=>{const id=clientId(req);if(!id){res.status(401).json({error:"Client account required."});return;}const threads=rows(await exec("SELECT id,subject,status,created_at AS \"createdAt\",updated_at AS \"updatedAt\" FROM support_threads WHERE client_account_id="+id+" ORDER BY updated_at DESC"));const result:any[]=[];for(const thread of threads){const messages=rows(await exec("SELECT id,sender_type AS \"senderType\",sender_name AS \"senderName\",body,created_at AS \"createdAt\" FROM support_messages WHERE thread_id="+Number(thread.id)+" ORDER BY created_at ASC"));result.push({...thread,messages});}res.json(result);});
router.post("/client/messages",requireClientAuth,async(req,res)=>{const id=clientId(req);if(!id){res.status(401).json({error:"Client account required."});return;}const message=text(req.body?.message,4000);if(!message){res.status(400).json({error:"Message cannot be empty."});return;}let threadId=Number(req.body?.threadId);if(!Number.isInteger(threadId)||threadId<=0)threadId=Number(rows<{id:number}>(await exec("INSERT INTO support_threads(client_account_id,subject,status,created_at,updated_at) VALUES ("+id+","+q(text(req.body?.subject||"Message to Aydens Wellness Services",160))+",'open',now(),now()) RETURNING id"))[0]?.id);const owned=rows(await exec("SELECT id FROM support_threads WHERE id="+threadId+" AND client_account_id="+id+" LIMIT 1"))[0];if(!owned){res.status(404).json({error:"Conversation not found."});return;}const [client]=await db.select({name:clientAccountsTable.name}).from(clientAccountsTable).where(eq(clientAccountsTable.id,id)).limit(1);await exec("INSERT INTO support_messages(thread_id,sender_type,sender_name,body,created_at) VALUES ("+threadId+",'client',"+q(client?.name||"Client")+","+q(message)+",now())");await exec("UPDATE support_threads SET status='open',updated_at=now() WHERE id="+threadId);res.status(201).json({success:true,threadId});});
router.get("/staff/client-messages",requireAuth,async(req,res)=>{const access=await staffCapability(req,res,"viewClientMessages");if(!access)return;const threads=rows(await exec("SELECT t.id,t.subject,t.status,t.client_account_id AS \"clientAccountId\",c.name AS \"clientName\",c.email AS \"clientEmail\",t.created_at AS \"createdAt\",t.updated_at AS \"updatedAt\" FROM support_threads t JOIN client_accounts c ON c.id=t.client_account_id ORDER BY t.updated_at DESC"));const result:any[]=[];for(const thread of threads){const messages=rows(await exec("SELECT id,sender_type AS \"senderType\",sender_name AS \"senderName\",body,created_at AS \"createdAt\" FROM support_messages WHERE thread_id="+Number(thread.id)+" ORDER BY created_at ASC"));result.push({...thread,messages});}res.json(result);});
router.post("/staff/client-messages",requireAuth,async(req,res)=>{const access=await staffCapability(req,res,"viewClientMessages");if(!access)return;let threadId=Number(req.body?.threadId);if(!Number.isInteger(threadId)||threadId<=0){const target=Number(req.body?.clientId);if(!Number.isInteger(target)||target<=0){res.status(400).json({error:"Choose a client."});return;}threadId=Number(rows<{id:number}>(await exec("INSERT INTO support_threads(client_account_id,subject,status,created_at,updated_at) VALUES ("+target+","+q(text(req.body?.subject||"Message from Aydens Wellness Services",160))+",'open',now(),now()) RETURNING id"))[0]?.id);}const message=text(req.body?.message,4000);if(message)await exec("INSERT INTO support_messages(thread_id,sender_type,sender_name,body,created_at) VALUES ("+threadId+",'staff',"+q(access.name)+","+q(message)+",now())");await exec("UPDATE support_threads SET status='open',updated_at=now() WHERE id="+threadId);res.status(201).json({success:true,threadId});});
router.patch("/staff/client-messages/:id",requireAuth,async(req,res)=>{const access=await staffCapability(req,res,"viewClientMessages");if(!access)return;const status=text(req.body?.status,20);if(!["open","closed"].includes(status)){res.status(400).json({error:"Invalid status."});return;}await exec("UPDATE support_threads SET status="+q(status)+",updated_at=now() WHERE id="+Number(req.params.id));res.json({success:true});});

// Aubrey
router.get("/client/assistant/history",requireClientAuth,async(req,res)=>{const id=clientId(req);if(!id){res.status(401).json({error:"Client account required."});return;}await ensureAdvancedStorage();res.json(rows(await exec("SELECT id,role,body,created_at AS \"createdAt\" FROM assistant_messages WHERE client_account_id="+id+" ORDER BY created_at ASC LIMIT 80")));});
router.post("/client/assistant",requireClientAuth,async(req,res)=>{const id=clientId(req);if(!id){res.status(401).json({error:"Client account required."});return;}const message=text(req.body?.message,4000);if(!message){res.status(400).json({error:"Message cannot be empty."});return;}await ensureAdvancedStorage();await exec("INSERT INTO assistant_messages(client_account_id,role,body,created_at) VALUES ("+id+",'user',"+q(message)+",now())");const history=rows<{role:string;body:string}>(await exec("SELECT role,body FROM assistant_messages WHERE client_account_id="+id+" ORDER BY created_at DESC LIMIT 20")).reverse();const instructions=["You are Aubrey, the Aydens Wellness Assistant.","The client-facing name is Aydens Wellness Assistant.","You are an AI wellness support tool, not a human therapist or clinician.","Provide general wellness information, planning help, reflection prompts, and encouragement.","Do not diagnose, prescribe, or make clinical determinations.","Do not present yourself as emergency response or as a replacement for professional care.","If the person describes immediate danger or an emergency, encourage local emergency services or a trusted person who can help immediately.","Avoid unnecessary requests for highly sensitive personal information.","Keep responses warm, calm, practical, and concise."].join("\n");try{const reply=await aiText(instructions,history.map((m)=>m.role+": "+m.body).join("\n"));await exec("INSERT INTO assistant_messages(client_account_id,role,body,created_at) VALUES ("+id+",'assistant',"+q(reply)+",now())");res.json({reply,name:"Aydens Wellness Assistant"});}catch(error:any){res.status(error?.statusCode===503?503:502).json({error:error?.message||"Aydens Wellness Assistant is unavailable right now."});}});

// Assignments
router.get("/client/interactive-assignments",requireClientAuth,async(req,res)=>{const id=clientId(req);if(!id){res.status(401).json({error:"Client account required."});return;}await ensureAdvancedStorage();const items=rows(await exec("SELECT id,type,title,content,due_date AS \"dueDate\",status,config,progress,frequency,created_at AS \"createdAt\",updated_at AS \"updatedAt\" FROM wellness_assignments WHERE client_account_id="+id+" ORDER BY created_at DESC"));res.json(items.map((i)=>({...i,percent:progressPercent(i.config,i.progress)})));});
router.patch("/client/interactive-assignments/:id",requireClientAuth,async(req,res)=>{const id=clientId(req),assignmentId=Number(req.params.id);if(!id||!Number.isInteger(assignmentId)){res.status(400).json({error:"Invalid assignment."});return;}await ensureAdvancedStorage();const assignment=rows(await exec("SELECT id,config,status FROM wellness_assignments WHERE id="+assignmentId+" AND client_account_id="+id+" LIMIT 1"))[0];if(!assignment){res.status(404).json({error:"Assignment not found."});return;}const progress=req.body?.progress&&typeof req.body.progress==="object"?req.body.progress:{};const percent=progressPercent(assignment.config,progress),status=percent>=100?"completed":percent>0?"in_progress":assignment.status;await exec("UPDATE wellness_assignments SET progress="+qJson(progress)+",status="+q(status)+",updated_at=now() WHERE id="+assignmentId+" AND client_account_id="+id);res.json({success:true,percent,status});});
router.get("/staff/assignments",requireAuth,async(req,res)=>{const access=await staffCapability(req,res,"manageAssignments");if(!access)return;await ensureAdvancedStorage();const result=rows(await exec("SELECT a.id,a.client_account_id AS \"clientAccountId\",c.name AS \"clientName\",a.type,a.title,a.content,a.due_date AS \"dueDate\",a.status,a.config,a.progress,a.frequency,a.created_by AS \"createdBy\",a.created_at AS \"createdAt\",a.updated_at AS \"updatedAt\" FROM wellness_assignments a LEFT JOIN client_accounts c ON c.id=a.client_account_id ORDER BY a.updated_at DESC"));res.json(result.map((i)=>({...i,percent:progressPercent(i.config,i.progress)})));});
router.get("/staff/assignments/:id/progress",requireAuth,async(req,res)=>{const access=await staffCapability(req,res,"manageAssignments");if(!access)return;await ensureAdvancedStorage();const item=rows(await exec("SELECT id,client_account_id AS \"clientAccountId\",config,progress,status,updated_at AS \"updatedAt\" FROM wellness_assignments WHERE id="+Number(req.params.id)+" LIMIT 1"))[0];if(!item){res.status(404).json({error:"Assignment not found."});return;}res.json({...item,percent:progressPercent(item.config,item.progress)});});
router.post("/staff/assignment-preview",requireAuth,async(req,res)=>{const access=await staffCapability(req,res,"manageAssignments");if(!access)return;const prompt=text(req.body?.prompt,4000);if(!prompt){res.status(400).json({error:"Describe the assignment you want the AI to create."});return;}const instructions=["Create a practical, non-diagnostic wellness assignment for a client.","Return JSON only with: title, summary, instructions, type, frequency, dueDays, config.","type must be checklist, reflection, spreadsheet, or weekly.","checklist config={kind:'checklist',items:[string]}","reflection config={kind:'reflection',prompt:string,minWords:number}","spreadsheet config={kind:'spreadsheet',columns:[string],requiredRows:number,rowLabel:string}","weekly config={kind:'weekly',weeks:number,weeklyPrompt:string}","Keep it simple enough for a phone browser. Do not add medical claims."].join("\n");try{const draft=parseJson(await aiText(instructions,prompt));if(!draft?.title||!draft?.instructions||!draft?.config||!["checklist","reflection","spreadsheet","weekly"].includes(draft.type))throw new Error("AI returned an incomplete assignment.");res.json({...draft,previewOnly:true});}catch(error:any){res.status(error?.statusCode===503?503:502).json({error:error?.message||"Could not generate an assignment preview."});}});
router.post("/staff/assignment-summarize",requireAuth,async(req,res)=>{const access=await staffCapability(req,res,"manageAssignments");if(!access)return;const content=text(req.body?.content,10000);if(!content){res.status(400).json({error:"Assignment content is required."});return;}try{res.json({summary:await aiText("Summarize this wellness assignment in 2–3 plain-language sentences without adding clinical claims.",content)});}catch(error:any){res.status(error?.statusCode===503?503:502).json({error:error?.message||"Could not summarize the assignment."});}});
router.post("/staff/assignments/send",requireAuth,async(req,res)=>{const access=await staffCapability(req,res,"manageAssignments");if(!access)return;await ensureAdvancedStorage();const body=req.body as any,client=Number(body.clientId),type=text(body.type,30);if(!Number.isInteger(client)||client<=0||!text(body.title,200)||!text(body.instructions,12000)||!body.config||!["checklist","reflection","spreadsheet","weekly"].includes(type)){res.status(400).json({error:"Client, title, instructions, type, and configuration are required."});return;}const [exists]=await db.select({id:clientAccountsTable.id}).from(clientAccountsTable).where(eq(clientAccountsTable.id,client)).limit(1);if(!exists){res.status(404).json({error:"Client account not found."});return;}const result=rows<{id:number}>(await exec("INSERT INTO wellness_assignments(client_account_id,type,title,content,due_date,status,created_by,created_at,updated_at,config,progress,frequency) VALUES ("+client+","+q(type)+","+q(text(body.title,200))+","+q(text(body.instructions,12000))+","+(body.dueDate?q(text(body.dueDate,10)):"NULL")+",'assigned',"+q(access.name)+",now(),now(),"+qJson(body.config)+",'{}'::jsonb,"+q(text(body.frequency||"one_time",80)+") RETURNING id"))[0];const summary=text(body.summary,1000);if(summary)await exec("INSERT INTO client_notifications(client_account_id,title,body,pushed_by,read,created_at) VALUES ("+client+",'New Wellness Journey assignment',"+q(summary)+","+q(access.name)+",false,now())");res.status(201).json({success:true,id:result?.id||null});});

// Uploads
const allowedMimes=new Set(["application/pdf","image/png","image/jpeg","image/webp","image/heic","image/heif","text/plain","text/csv","application/rtf","application/msword","application/vnd.openxmlformats-officedocument.wordprocessingml.document","application/vnd.ms-excel","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"]);
function allowedUpload(mime:string,name:string){return allowedMimes.has(mime)||/\.(pdf|png|jpe?g|webp|heic|heif|txt|csv|rtf|docx?|xlsx?)$/i.test(name);}
router.post("/staff/upload-requests",requireAuth,async(req,res)=>{const access=await staffCapability(req,res,"manageUploads");if(!access)return;await ensureAdvancedStorage();const client=Number(req.body?.clientId),label=text(req.body?.label||"Documents",160),days=Math.min(90,Math.max(1,Number(req.body?.expiresInDays||7)));if(!Number.isInteger(client)||client<=0||!label){res.status(400).json({error:"Choose a client and give the request a label."});return;}const [clientRow]=await db.select({id:clientAccountsTable.id,name:clientAccountsTable.name}).from(clientAccountsTable).where(eq(clientAccountsTable.id,client)).limit(1);if(!clientRow){res.status(404).json({error:"Client not found."});return;}const token=crypto.randomBytes(32).toString("base64url");const result=rows<{id:number;token:string;expiresAt:string}>(await exec("INSERT INTO upload_requests(token,client_account_id,label,created_by,expires_at,created_at) VALUES ("+q(token)+","+client+","+q(label)+","+q(access.name)+",now()+("+days+"||' days')::interval,now()) RETURNING id,token,expires_at AS \"expiresAt\""))[0];res.status(201).json({...result,clientName:clientRow.name,url:safeOrigin(req)+"/upload/"+token});});
router.get("/staff/upload-requests",requireAuth,async(req,res)=>{const access=await staffCapability(req,res,"manageUploads");if(!access)return;await ensureAdvancedStorage();res.json(rows(await exec("SELECT r.id,r.token,r.label,r.created_by AS \"createdBy\",r.created_at AS \"createdAt\",r.expires_at AS \"expiresAt\",r.client_account_id AS \"clientAccountId\",c.name AS \"clientName\",(SELECT count(*)::int FROM client_uploads u WHERE u.request_id=r.id) AS \"fileCount\" FROM upload_requests r LEFT JOIN client_accounts c ON c.id=r.client_account_id ORDER BY r.created_at DESC")));});
router.get("/staff/uploads",requireAuth,async(req,res)=>{const access=await staffCapability(req,res,"manageUploads");if(!access)return;await ensureAdvancedStorage();res.json(rows(await exec("SELECT u.id,u.request_id AS \"requestId\",r.label,u.client_account_id AS \"clientAccountId\",c.name AS \"clientName\",u.file_name AS \"fileName\",u.mime_type AS \"mimeType\",u.size_bytes AS \"sizeBytes\",u.created_at AS \"createdAt\" FROM client_uploads u JOIN upload_requests r ON r.id=u.request_id LEFT JOIN client_accounts c ON c.id=u.client_account_id ORDER BY u.created_at DESC")));});
router.get("/staff/uploads/:id/download",requireAuth,async(req,res)=>{const access=await staffCapability(req,res,"manageUploads");if(!access)return;await ensureAdvancedStorage();const file=rows<{fileName:string;mimeType:string;data:Buffer}>(await exec("SELECT file_name AS \"fileName\",mime_type AS \"mimeType\",data FROM client_uploads WHERE id="+Number(req.params.id)+" LIMIT 1"))[0];if(!file){res.status(404).json({error:"File not found."});return;}res.setHeader("Content-Type",file.mimeType);res.setHeader("Content-Disposition","attachment; filename*=UTF-8''"+encodeURIComponent(file.fileName));res.send(file.data);});
router.get("/uploads/public/:token",async(req,res)=>{await ensureAdvancedStorage();const item=rows(await exec("SELECT label,COALESCE((SELECT name FROM client_accounts WHERE id=client_account_id),'Client') AS \"clientName\",expires_at AS \"expiresAt\" FROM upload_requests WHERE token="+q(text(req.params.token,200))+" LIMIT 1"))[0];if(!item||new Date(item.expiresAt).getTime()<Date.now()){res.status(404).json({error:"This upload link is expired or unavailable."});return;}res.json(item);});
router.post("/uploads/public/:token",async(req,res)=>{await ensureAdvancedStorage();const request=rows<{id:number;clientAccountId:number|null;expiresAt:string}>(await exec("SELECT id,client_account_id AS \"clientAccountId\",expires_at AS \"expiresAt\" FROM upload_requests WHERE token="+q(text(req.params.token,200))+" LIMIT 1"))[0];if(!request||new Date(request.expiresAt).getTime()<Date.now()){res.status(404).json({error:"This upload link is expired or unavailable."});return;}const name=text(req.body?.fileName,255),mime=text(req.body?.mimeType||"application/octet-stream",150).toLowerCase(),encoded=text(req.body?.data,14000000);if(!name||!encoded||!allowedUpload(mime,name)){res.status(400).json({error:"Choose a supported document or image."});return;}const data=Buffer.from(encoded,"base64");if(!data.length||data.length>10*1024*1024){res.status(413).json({error:"Uploads must be 10 MB or smaller."});return;}await exec("INSERT INTO client_uploads(request_id,client_account_id,file_name,mime_type,size_bytes,data,created_at) VALUES ("+request.id+","+(request.clientAccountId||"NULL")+","+q(name)+","+q(mime)+","+data.length+",decode("+q(data.toString("base64"))+",'base64'),now())");res.status(201).json({success:true});});
router.get("/client/uploads",requireClientAuth,async(req,res)=>{const id=clientId(req);if(!id){res.status(401).json({error:"Client account required."});return;}await ensureAdvancedStorage();res.json(rows(await exec("SELECT u.id,u.file_name AS \"fileName\",u.mime_type AS \"mimeType\",u.size_bytes AS \"sizeBytes\",u.created_at AS \"createdAt\",r.label FROM client_uploads u JOIN upload_requests r ON r.id=u.request_id WHERE u.client_account_id="+id+" ORDER BY u.created_at DESC")));});

// Goals, journal, check-ins
router.get("/client/goals",requireClientAuth,async(req,res)=>{const id=clientId(req);if(!id){res.status(401).json({error:"Client account required."});return;}await ensureAdvancedStorage();res.json(rows(await exec("SELECT id,title,description,status,progress,created_at AS \"createdAt\",updated_at AS \"updatedAt\" FROM client_goals WHERE client_account_id="+id+" ORDER BY created_at DESC")));});
router.post("/client/goals",requireClientAuth,async(req,res)=>{const id=clientId(req);if(!id){res.status(401).json({error:"Client account required."});return;}const title=text(req.body?.title,160);if(!title){res.status(400).json({error:"Goal title is required."});return;}await ensureAdvancedStorage();res.status(201).json(rows(await exec("INSERT INTO client_goals(client_account_id,title,description,status,progress,created_at,updated_at) VALUES ("+id+","+q(title)+","+q(text(req.body?.description,1000))+",'active',0,now(),now()) RETURNING id,title,description,status,progress,created_at AS \"createdAt\",updated_at AS \"updatedAt\""))[0]);});
router.patch("/client/goals/:id",requireClientAuth,async(req,res)=>{const client=clientId(req),id=Number(req.params.id);if(!client||!Number.isInteger(id)){res.status(400).json({error:"Invalid goal."});return;}await ensureAdvancedStorage();const progress=Math.max(0,Math.min(100,Number(req.body?.progress??0))),status=progress>=100||req.body?.status==="completed"?"completed":"active";const row=rows(await exec("UPDATE client_goals SET title=COALESCE("+q(req.body?.title?text(req.body.title,160):null)+",title),description=COALESCE("+q(req.body?.description!==undefined?text(req.body.description,1000):null)+",description),progress="+progress+",status="+q(status)+",updated_at=now() WHERE id="+id+" AND client_account_id="+client+" RETURNING id,title,description,status,progress,created_at AS \"createdAt\",updated_at AS \"updatedAt\""))[0];if(!row){res.status(404).json({error:"Goal not found."});return;}res.json(row);});
router.get("/client/journal",requireClientAuth,async(req,res)=>{const id=clientId(req);if(!id){res.status(401).json({error:"Client account required."});return;}await ensureAdvancedStorage();res.json(rows(await exec("SELECT id,prompt,body,created_at AS \"createdAt\",updated_at AS \"updatedAt\" FROM client_journal_entries WHERE client_account_id="+id+" ORDER BY created_at DESC LIMIT 100")));});
router.post("/client/journal",requireClientAuth,async(req,res)=>{const id=clientId(req);if(!id){res.status(401).json({error:"Client account required."});return;}const value=text(req.body?.text,12000);if(!value){res.status(400).json({error:"Journal entry cannot be empty."});return;}await ensureAdvancedStorage();res.status(201).json(rows(await exec("INSERT INTO client_journal_entries(client_account_id,prompt,body,created_at,updated_at) VALUES ("+id+","+q(text(req.body?.prompt,1000))+","+q(value)+",now(),now()) RETURNING id,prompt,body,created_at AS \"createdAt\",updated_at AS \"updatedAt\""))[0]);});
router.get("/client/checkins",requireClientAuth,async(req,res)=>{const id=clientId(req);if(!id){res.status(401).json({error:"Client account required."});return;}await ensureAdvancedStorage();res.json(rows(await exec("SELECT id,mood,stress,energy,sleep,notes,created_at AS \"createdAt\" FROM client_checkins WHERE client_account_id="+id+" ORDER BY created_at DESC LIMIT 60")));});
router.post("/client/checkins",requireClientAuth,async(req,res)=>{const id=clientId(req);if(!id){res.status(401).json({error:"Client account required."});return;}for(const key of ["mood","stress","energy","sleep"]){if(req.body?.[key]!==undefined&&(!Number.isInteger(req.body[key])||Number(req.body[key])<1||Number(req.body[key])>5)){res.status(400).json({error:"Check-in ratings must be 1–5."});return;}}await ensureAdvancedStorage();res.status(201).json(rows(await exec("INSERT INTO client_checkins(client_account_id,mood,stress,energy,sleep,notes,created_at) VALUES ("+id+","+(req.body?.mood??"NULL")+","+(req.body?.stress??"NULL")+","+(req.body?.energy??"NULL")+","+(req.body?.sleep??"NULL")+","+q(text(req.body?.notes,2000))+",now()) RETURNING id,mood,stress,energy,sleep,notes,created_at AS \"createdAt\""))[0]);});

const permissions=[["viewClients","View clients"],["editAppointments","Manage appointments"],["sendEmails","Send client communication"],["manageSettings","Manage practice settings"],["postAnnouncements","Post announcements"],["viewAnalytics","View analytics"],["viewAuditLogs","View activity history"],["manageUploads","Request and manage uploads"],["manageAssignments","Create and manage wellness assignments"],["viewClientMessages","View and reply to client messages"],["manageTasks","Manage staff tasks"],["manageResources","Manage wellness resources"],["viewSystemHealth","View system health"]] as const;
async function seedRoles(){await ensureAdvancedStorage();const defaults:[string,string,string[]][]=[["manager","Manager",permissions.map(p=>p[0])],["therapist","Therapist",["viewClients","editAppointments","viewAnalytics","manageAssignments","viewClientMessages"]],["customer_service_representative","Customer Service Representative",["viewClients","editAppointments","sendEmails","viewClientMessages","manageUploads"]],["receptionist","Receptionist",["viewClients","editAppointments","sendEmails","viewClientMessages","manageUploads","manageTasks"]]];for(const [slug,name,list] of defaults){await exec("INSERT INTO custom_roles(slug,name,built_in,permissions,created_at,updated_at) VALUES ("+q(slug)+","+q(name)+",true,"+qJson(Object.fromEntries(list.map(p=>[p,true])))+",now(),now()) ON CONFLICT(slug) DO UPDATE SET name=EXCLUDED.name,built_in=true");}}
router.get("/staff/roles",requireAuth,async(req,res)=>{const access=await getStaffAccess(req);if(!access||access.role!=="founder"){res.status(403).json({error:"Founder access required."});return;}await seedRoles();res.json({permissions,roles:rows(await exec("SELECT id,slug,name,built_in AS \"builtIn\",permissions,created_at AS \"createdAt\",updated_at AS \"updatedAt\" FROM custom_roles ORDER BY built_in DESC,name ASC"))});});
router.post("/staff/roles",requireAuth,async(req,res)=>{const access=await getStaffAccess(req);if(!access||access.role!=="founder"){res.status(403).json({error:"Founder access required."});return;}await ensureAdvancedStorage();const name=text(req.body?.name,80),slug=name.toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"").slice(0,60);if(!name||!slug){res.status(400).json({error:"Role name is required."});return;}const perms=Object.fromEntries(permissions.map(([key])=>[key,req.body?.permissions?.[key]===true]));try{res.status(201).json(rows(await exec("INSERT INTO custom_roles(slug,name,built_in,permissions,created_at,updated_at) VALUES ("+q(slug)+","+q(name)+",false,"+qJson(perms)+",now(),now()) RETURNING id,slug,name,built_in AS \"builtIn\",permissions"))[0]);}catch{res.status(409).json({error:"A role with that name already exists."});}});
router.patch("/staff/roles/:id",requireAuth,async(req,res)=>{const access=await getStaffAccess(req);if(!access||access.role!=="founder"){res.status(403).json({error:"Founder access required."});return;}await ensureAdvancedStorage();const id=Number(req.params.id),existing=rows<{slug:string}>(await exec("SELECT slug FROM custom_roles WHERE id="+id+" LIMIT 1"))[0];if(!existing){res.status(404).json({error:"Role not found."});return;}const name=req.body?.name===undefined?null:text(req.body.name,80),perms=Object.fromEntries(permissions.map(([key])=>[key,req.body?.permissions?.[key]===true]));await exec("UPDATE custom_roles SET name=COALESCE("+q(name)+",name),permissions="+qJson(perms)+",updated_at=now() WHERE id="+id);await exec("UPDATE staff_accounts SET permissions="+qJson(perms)+" WHERE role="+q(existing.slug));res.json({success:true});});
router.delete("/staff/roles/:id",requireAuth,async(req,res)=>{const access=await getStaffAccess(req);if(!access||access.role!=="founder"){res.status(403).json({error:"Founder access required."});return;}await ensureAdvancedStorage();const id=Number(req.params.id),role=rows<{slug:string;builtIn:boolean}>(await exec("SELECT slug,built_in AS \"builtIn\" FROM custom_roles WHERE id="+id+" LIMIT 1"))[0];if(!role){res.status(404).json({error:"Role not found."});return;}if(role.builtIn){res.status(400).json({error:"Built-in roles cannot be deleted."});return;}if(rows(await exec("SELECT id FROM staff_accounts WHERE role="+q(role.slug)+" LIMIT 1")).length){res.status(409).json({error:"Move staff out of this role before deleting it."});return;}await exec("DELETE FROM custom_roles WHERE id="+id);res.json({success:true});});
router.patch("/staff/roles/assign/:id",requireAuth,async(req,res)=>{const access=await getStaffAccess(req);if(!access||access.role!=="founder"){res.status(403).json({error:"Founder access required."});return;}await ensureAdvancedStorage();const id=Number(req.params.id),slug=text(req.body?.role,80),role=rows<{permissions:Record<string,boolean>}>(await exec("SELECT permissions FROM custom_roles WHERE slug="+q(slug)+" LIMIT 1"))[0];if(!role){res.status(404).json({error:"Role not found."});return;}await exec("UPDATE staff_accounts SET role="+q(slug)+",permissions="+qJson(role.permissions)+" WHERE id="+id);res.json({success:true});});

export default router;
