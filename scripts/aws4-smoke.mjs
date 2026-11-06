import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { setTimeout as pause } from "node:timers/promises";

const host=process.env.AWS4_SMOKE_URL||"http://localhost:3000";
const secret=process.env.SESSION_SECRET;
if(!secret)throw Error("SESSION_SECRET is required for the smoke test");
function session(email,name){
 const body=Buffer.from(JSON.stringify({email,name})).toString("base64url");
 return body+"."+createHmac("sha256",secret).update(body).digest("hex");
}
const founder=session("ayden@aydenstherapyservices.com","Ayden");
const employee=session("wellness.staff@aws-smoke.example","Test Wellness Staff");
async function request(path,method="GET",body,auth){
 const res=await fetch(host+path,{method,headers:{"content-type":"application/json",...(auth?{Cookie:"ats_session="+auth}:{})},body:body?JSON.stringify(body):undefined});
 const data=await res.json().catch(()=>({}));
 return {status:res.status,data};
}
async function assertStatus(path,method,body,token,expected,label){
 const result=await request(path,method,body,token);
 assert.equal(result.status,expected,label+" "+JSON.stringify(result.data));
 return result.data;
}
for(let tries=0;tries<30;tries++){
 try{const res=await request("/api/health");if(res.status<500)break;}catch{}
 await pause(300);
}
await assertStatus("/api/v4/careers/openings","GET",undefined,undefined,200,"public openings");
await assertStatus("/api/v4/careers/admin/openings","GET",undefined,undefined,401,"anonymous cannot see corporate openings");
await assertStatus("/api/v4/careers/admin/applications","GET",undefined,employee,403,"wellness staff cannot read applicants");
const opening=await assertStatus("/api/v4/careers/admin/openings","POST",{title:"Client Support Smoke Test",department:"Client Services",description:"Temporary smoke test role. Please do not apply.",requirements:"For internal testing."},founder,201,"founder can publish");
assert.ok(opening.id,"opening id");
const application=await assertStatus("/api/v4/careers/apply","POST",{openingId:opening.id,firstName:"Test",lastName:"Candidate",phone:"9545550123",email:"candidate.aws-smoke@example.com",consent:true,website:""},undefined,201,"anonymous candidate applies");
assert.match(application.reference,/^AWS-[0-9A-F]{12}$/);
await assertStatus("/api/v4/careers/status","POST",{reference:application.reference,email:"wrong@example.com"},undefined,404,"application status denies wrong email");
const status=await assertStatus("/api/v4/careers/status","POST",{reference:application.reference,email:"candidate.aws-smoke@example.com"},undefined,200,"private application status");
assert.equal(status.status,"submitted");
await assertStatus("/api/v4/careers/admin/applications","GET",undefined,employee,403,"staff application denial");
const allApps=await assertStatus("/api/v4/careers/admin/applications","GET",undefined,founder,200,"founder sees applicants");
const applicant=allApps.find(x=>x.reference===application.reference);
assert.ok(applicant,"application appears in management");

assert.deepEqual(await assertStatus("/api/v4/staff-logs/pending","GET",undefined,founder,200,"founder queue"),[]);
await assertStatus("/api/v4/careers/admin/applications/"+applicant.id,"PATCH",{status:"approved",internalNotes:"smoke-approved"},founder,200,"founder can continue without logging");
const entry=await assertStatus("/api/v4/staff-logs","POST",{category:"Recruitment",actionTaken:"Created a new career opening",summary:"Published a smoke test vacancy.",reference:"AWS4-SMOKE"},founder,201,"founder may log voluntarily");
assert.ok(entry.id,"voluntary log has id");
const approved=await assertStatus("/api/v4/careers/status","POST",{reference:application.reference,email:"candidate.aws-smoke@example.com"},undefined,200,"status reflects approval");
assert.equal(approved.status,"approved","application approved in public status checker");
console.log("AWS 4.0 smoke passed: corporate roles, recruitment lifecycle, status privacy, manual action gating.");
