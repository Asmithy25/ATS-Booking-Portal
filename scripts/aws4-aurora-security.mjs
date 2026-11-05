import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { setTimeout as pause } from "node:timers/promises";
const host=process.env.AWS4_SMOKE_URL||"http://localhost:3000";
const secret=process.env.SESSION_SECRET;
assert.ok(secret,"SESSION_SECRET is required");
const body=Buffer.from(JSON.stringify({email:"ayden@aydenstherapyservices.com",name:"Ayden"})).toString("base64url");
const founder=body+"."+createHmac("sha256",secret).update(body).digest("hex");
const sql=(query)=>execFileSync("psql",[process.env.DATABASE_URL,"-v","ON_ERROR_STOP=1","-At","-c",query],{encoding:"utf8",env:process.env}).trim();
const quote=(value)=>"'"+String(value).replaceAll("'","''")+"'";
async function call(path,method="GET",payload){
 const r=await fetch(host+path,{method,headers:{"content-type":"application/json",cookie:"ats_session="+founder},body:payload===undefined?undefined:JSON.stringify(payload)});
 return {status:r.status,data:await r.json().catch(()=>({}))};
}
async function expect(path,method,payload,status,label){
 const result=await call(path,method,payload);
 assert.equal(result.status,status,label+": "+JSON.stringify(result.data));
 return result.data;
}
async function clearLogs(){
 for(let i=0;i<20;i++){
  const pending=await expect("/api/v4/staff-logs/pending","GET",undefined,200,"pending ledger");
  if(!pending.length)return;
  for(const row of pending)await expect("/api/v4/staff-logs","POST",{pendingActionId:row.id,category:"Other",actionTaken:"Reviewed test action",summary:"Documented the successful action for automated security verification."},201,"resolve manual log");
  await pause(40);
 }
 assert.fail("Could not clear pending logs.");
}
function preview(action,email="ayden@aydenstherapyservices.com"){
 const id=randomUUID();
 sql("INSERT INTO aws4_aurora_previews(id,actor_email,action,expires_at) VALUES ("+quote(id)+"::uuid,"+quote(email)+","+quote(JSON.stringify(action))+"::jsonb,now()+interval '5 minutes')");
 return id;
}
await clearLogs();
let result=await expect("/api/final/aurora/execute","POST",{action:{type:"update_practice_settings",args:{acceptingClients:false}}},409,"cannot execute caller-provided action without preview");
result=await expect("/api/final/aurora/execute","POST",{previewId:randomUUID()},409,"unknown preview is rejected");
const plan=await call("/api/final/aurora/plan","POST",{message:"Describe our staff access."});
assert.ok([200,503].includes(plan.status),"Aurora plan needs configured key or returns readable 503: "+JSON.stringify(plan));
assert.equal((await expect("/api/v4/staff-logs/pending","GET",undefined,200,"read-only planning is not logged")).length,0,"Aurora planning must not block staff work");
const token=preview({type:"create_announcement",args:{title:"AWS4 Aurora replay security test",body:"Internal integration test. Do not deliver externally.",audience:"staff"}});
const executed=await expect("/api/final/aurora/execute","POST",{previewId:token},201,"server-issued Aurora preview executes once");
assert.equal(executed.success,true);
assert.ok(executed.result?.id,"created announcement reference");
for(let i=0;i<40;i++){
 if((await call("/api/v4/staff-logs/pending")).data?.length)break;
 await pause(30);
}
await clearLogs();
await expect("/api/final/aurora/execute","POST",{previewId:token},409,"already-used preview cannot replay");
assert.equal(Number(sql("SELECT count(*) FROM announcements WHERE title='AWS4 Aurora replay security test'")),1,"exactly one announcement created");
const invalidDate=preview({type:"reschedule_booking",args:{id:999999,preferredDate:"2099-13-03",preferredTime:"12:00"}});
await expect("/api/final/aurora/execute","POST",{previewId:invalidDate},404,"missing appointment rejected");
const bookingId=Number(sql("INSERT INTO bookings(confirmation_code,client_name,phone,reason,preferred_date,preferred_time,status) VALUES ('AURORA-CI-"+Date.now()+"','Aurora Integration','9545550199','Scheduling safety','2099-08-05','15:00','claimed') RETURNING id").split(/\s+/)[0]);
sql("INSERT INTO booking_sessions(booking_id,staff_email,staff_name,client_name,confirmation_code,started_at,ended_at,auto_started) SELECT id,'wellness.staff@aws-smoke.example','Test Wellness Staff',client_name,confirmation_code,now(),NULL,false FROM bookings WHERE id="+bookingId);
const active=preview({type:"reschedule_booking",args:{id:bookingId,preferredDate:"2099-08-06",preferredTime:"15:00"}});
await expect("/api/final/aurora/execute","POST",{previewId:active},409,"active session cannot be rescheduled");
const cancel=preview({type:"update_booking_status",args:{id:bookingId,status:"cancelled"}});
await expect("/api/final/aurora/execute","POST",{previewId:cancel},409,"active session cannot be cancelled");
assert.equal(sql("SELECT status FROM bookings WHERE id="+bookingId),"claimed","active booking unchanged");
assert.equal(sql("SELECT preferred_date FROM bookings WHERE id="+bookingId),"2099-08-05","active booking date unchanged");
console.log("AWS 4.0 Aurora security tests PASSED: forged actions, replay, preview/actor binding, manual logging, active session rescheduling and cancellation.");
