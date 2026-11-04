import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { setTimeout as pause } from "node:timers/promises";

const host=process.env.AWS4_SMOKE_URL||"http://localhost:3000";
const secret=process.env.SESSION_SECRET;
if(!secret)throw Error("SESSION_SECRET is required");
function signed(data){
 const encoded=Buffer.from(JSON.stringify(data)).toString("base64url");
 return encoded+"."+createHmac("sha256",secret).update(encoded).digest("hex");
}
const founder=signed({email:"ayden@aydenstherapyservices.com",name:"Ayden"});
const wellness=signed({email:"wellness.staff@aws-smoke.example",name:"Test Wellness Staff"});
const executive=signed({email:"executive.aws-smoke@example.com",name:"Test Executive"});
const clientOne=signed({id:"1",email:"client.one.aws-smoke@example.com",name:"Client One"});
const clientTwo=signed({id:"2",email:"client.two.aws-smoke@example.com",name:"Client Two"});
async function request(path,method="GET",body,identity=null,client=false){
 const response=await fetch(host+path,{method,headers:{"content-type":"application/json",...(identity?client?{Authorization:"Bearer "+identity}:{Cookie:"ats_session="+identity}:{})},body:body===undefined?undefined:JSON.stringify(body)});
 const data=await response.json().catch(()=>null);
 return {status:response.status,data};
}
async function expect(path,method,body,token,code,label,client=false){
 const response=await request(path,method,body,token,client);
 assert.equal(response.status,code,label+" => "+JSON.stringify(response.data));
 return response.data;
}
async function drain(token){
 for(let count=0;count<12;count++){
  const pending=await expect("/api/v4/staff-logs/pending","GET",undefined,token,200,"read pending staff logs");
  if(!pending.length)return;
  for(const item of pending){
   await expect("/api/v4/staff-logs","POST",{pendingActionId:item.id,category:"Other",actionTaken:"Verified AWS 4.0 integration",summary:"Automatically documented an API operation as part of the isolated pre-release integration tests."},token,201,"write the mandatory manual log");
  }
  await pause(10);
 }
 assert.fail("Could not clear staff manual logging queue.");
}
async function mutation(path,method,body,token,code,label){
 await drain(token);
 const result=await expect(path,method,body,token,code,label);
 if(code>=200&&code<300){
  let seen=false;
  for(let n=0;n<40;n++){
   const pending=await request("/api/v4/staff-logs/pending","GET",undefined,token);
   if(pending.status===200&&pending.data?.length){seen=true;break;}
   await pause(25);
  }
  assert.ok(seen,label+" must be automatically queued for staff manual logging");
  await drain(token);
 }
 return result;
}
await drain(founder);
await drain(wellness);
await expect("/api/v4/suite/organization","GET",undefined,undefined,401,"org chart requires staff authentication");
await expect("/api/v4/suite/organization","GET",undefined,wellness,200,"wellness staff can read org chart");
await expect("/api/v4/suite/operations/live","GET",undefined,wellness,200,"staff see aggregate operations");
await expect("/api/v4/suite/operations/reports","GET",undefined,wellness,403,"performance reports corporate only");
await expect("/api/v4/suite/operations/reports","GET",undefined,founder,200,"founder sees reports");
await expect("/api/v4/suite/organization/departments","POST",{name:"Forbidden",description:"Should be rejected"},wellness,403,"normal staff cannot create departments");
const dept=await mutation("/api/v4/suite/organization/departments","POST",{name:"Client Services (CI)",description:"Automated integration",leaderEmail:"executive.aws-smoke@example.com"},founder,201,"create corporate department");
assert.ok(dept.id);
await mutation("/api/v4/suite/organization/membership","PATCH",{email:"wellness.staff@aws-smoke.example",departmentId:dept.id,reportsToEmail:"executive.aws-smoke@example.com"},founder,200,"assign organizational reporting line");
const broadcast=await mutation("/api/v4/suite/broadcasts","POST",{title:"AWS 4.0 Operational Briefing",body:"This is a test staff broadcast.",scope:"all",target:"",requiresAck:true},executive,201,"executive targeted broadcast");
assert.ok(broadcast.id);
const broadcasts=await expect("/api/v4/suite/broadcasts","GET",undefined,wellness,200,"staff receives targeted broadcasts");
assert.ok(broadcasts.some(item=>item.id===broadcast.id&&item.requiresAck));
await mutation("/api/v4/suite/broadcasts/"+broadcast.id+"/ack","POST",{},wellness,200,"staff acknowledges broadcast");
const policy=await mutation("/api/v4/suite/policies","POST",{title:"AWS Integration Confidentiality",body:"Use role-based access for sensitive details."},founder,201,"create policy");
assert.ok(policy.id);
await mutation("/api/v4/suite/policies/"+policy.id,"PATCH",{active:true},founder,200,"publish policy");
const visiblePolicies=await expect("/api/v4/suite/policies","GET",undefined,wellness,200,"staff sees published policies");
assert.ok(visiblePolicies.some(item=>item.id===policy.id));
await mutation("/api/v4/suite/policies/"+policy.id+"/ack","POST",{},wellness,200,"staff acknowledges published policy");
const history=await expect("/api/v4/suite/policies/"+policy.id+"/history","GET",undefined,founder,200,"founder views policy history");
assert.ok(history.some(v=>v.version===1));
await expect("/api/v4/suite/policies/"+policy.id+"/history","GET",undefined,wellness,403,"policy history corporate only");
const leave=await mutation("/api/v4/suite/staff-requests","POST",{kind:"leave",title:"Test leave request",details:"Staff leave integration."},wellness,201,"staff leave request");
assert.ok(leave.id);
await expect("/api/v4/suite/staff-requests/"+leave.id+"/decision","PATCH",{status:"approved"},wellness,403,"staff cannot approve leave");
await mutation("/api/v4/suite/staff-requests/"+leave.id+"/decision","PATCH",{status:"approved"},executive,200,"corporate approves staff leave");
const training=await mutation("/api/v4/suite/training","POST",{title:"AWS Privacy Basics",description:"Role-based data access",content:"Use least-privilege controls for all client information.",roleScope:"therapist",quizQuestion:"Which principle is required?",quizChoices:["Least privilege","Public access"],correctChoice:0},founder,201,"publish assessed training");
assert.ok(training.id);
await expect("/api/v4/suite/training/"+training.id+"/complete","POST",{answerIndex:1},wellness,400,"incorrect quiz response rejected");
await mutation("/api/v4/suite/training/"+training.id+"/complete","POST",{answerIndex:0},wellness,200,"correct training answer accepted");
const recognition=await mutation("/api/v4/suite/recognition","POST",{actorEmail:"wellness.staff@aws-smoke.example",title:"Service Excellence",description:"Completed authorized onboarding."},founder,201,"recognize staff member");
assert.ok(recognition.id);
const flag=await mutation("/api/v4/suite/feature-lab/v4-knowledge","PUT",{label:"Knowledge Hub Experiment",enabled:false,targetRoles:["therapist"]},founder,200,"disable experimental knowledge module");
await expect("/api/v4/workspaces/knowledge","GET",undefined,wellness,404,"feature lab disables targeted workspace");
await expect("/api/v4/workspaces/knowledge","GET",undefined,founder,200,"founder retains feature recovery");
await mutation("/api/v4/suite/feature-lab/v4-knowledge","PUT",{label:"Knowledge Hub Experiment",enabled:true,targetRoles:["therapist"]},founder,200,"enable experiment for wellness staff");
await expect("/api/v4/workspaces/knowledge","GET",undefined,wellness,200,"targeted role regains workspace access");
const task=await mutation("/api/v4/workspaces/tasks","POST",{title:"Follow up test client request",body:"A generic administrative task without client information."},wellness,201,"create task");
assert.ok(task.id);
await mutation("/api/v4/workspaces/tasks/"+task.id+"/comments","POST",{body:"Working through the operations checklist."},wellness,201,"add task discussion");
const comments=await expect("/api/v4/workspaces/tasks/"+task.id+"/comments","GET",undefined,wellness,200,"read internal discussion");
assert.ok(comments.some(c=>c.body.includes("operations checklist")));
const workday=await expect("/api/v4/suite/my-workday","GET",undefined,wellness,200,"staff My Workday");
assert.ok(workday.openTasks>=1);
const guide=await mutation("/api/v4/suite/whats-new","POST",{title:"Client Launch Notes",description:"Test release guide",body:"Step 1: Open your portal.\n\nStep 2: Review your appointments.",scope:"client",published:true},founder,201,"publish client release guide");
assert.ok(guide.id);
await expect("/api/v4/suite/client/bookmarks","GET",undefined,undefined,401,"resource library requires client login");
const pref=await expect("/api/v4/client/preferences","PUT",{preferredStaff:"Test Wellness Staff",preferredTimeWindow:"afternoon",remindersEnabled:true,onboardingCompleted:true,largeText:true,reducedMotion:true,highContrast:true,simplifiedNavigation:true},clientOne,200,"client updates private preferences",true);
assert.equal(pref.largeText,true);
const otherPrefs=await expect("/api/v4/client/preferences","GET",undefined,clientTwo,200,"other client has independent preferences",true);
assert.equal(otherPrefs.largeText,false);
const resources=await expect("/api/v4/suite/client/bookmarks","GET",undefined,clientOne,200,"client sees public wellness resources",true);
assert.ok(resources.length,"CI seeded published resource");
const resourceId=resources[0].id;
await expect("/api/v4/suite/client/bookmarks/"+resourceId,"POST",{},clientOne,200,"client bookmarks resource",true);
const otherResources=await expect("/api/v4/suite/client/bookmarks","GET",undefined,clientTwo,200,"other client sees separate bookmarks",true);
assert.equal(otherResources.find(x=>x.id===resourceId)?.bookmarked,false);
const guides=await expect("/api/v4/suite/whats-new/client","GET",undefined,clientOne,200,"client can see published guide",true);
assert.ok(guides.some(g=>g.id===guide.id));
await expect("/api/v4/suite/whats-new/client/"+guide.id+"/ack","POST",{},clientOne,200,"client acknowledges release guide",true);
await expect("/api/v4/suite/whats-new/client","GET",undefined,undefined,401,"client release guide blocks anonymous");
const last=await expect("/api/v4/staff-logs","GET",undefined,wellness,200,"staff views own manual ledger");
assert.ok(last.length>2);
await expect("/api/v4/staff-logs","GET",undefined,undefined,401,"manual logs hidden from anonymous users");
console.log("AWS 4.0 extended integration passed: roles, org, broadcasts, policy, staff scheduling, training, recognition, experiments, workspaces, client preferences, bookmarks and release tours.");
