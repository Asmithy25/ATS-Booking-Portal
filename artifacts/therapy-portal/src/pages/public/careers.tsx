import { useEffect, useState, type FormEvent } from "react";
import { Link } from "wouter";
import { customFetch } from "@workspace/api-client-react";
import { PublicNavbar } from "@/components/layout/PublicNavbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BriefcaseBusiness, ArrowLeft, ArrowRight, CheckCircle2, ShieldCheck } from "lucide-react";

type Opening = { id:number; title:string; department:string; description:string; requirements:string };
const api = <T,>(path:string, init?:RequestInit):Promise<T> => customFetch<T>(path,{ ...init, responseType:"json" });

export default function Careers() {
  const [openings,setOpenings] = useState<Opening[]>([]);
  const [selected,setSelected] = useState<Opening|null>(null);
  const [loading,setLoading] = useState(true);
  const [submitting,setSubmitting] = useState(false);
  const [error,setError] = useState("");
  const [reference,setReference] = useState("");
  const [firstName,setFirstName] = useState("");
  const [lastName,setLastName] = useState("");
  const [phone,setPhone] = useState("");
  const [email,setEmail] = useState("");
  const [consent,setConsent] = useState(false);
  useEffect(() => {
    api<Opening[]>("/api/v4/careers/openings").then(setOpenings).catch(() => setError("Career opportunities are temporarily unavailable.")).finally(() => setLoading(false));
  }, []);
  const submit = async (event:FormEvent) => {
    event.preventDefault();
    if (!selected || !consent) return;
    setSubmitting(true);setError("");
    try {
      const response = await api<{reference:string}>("/api/v4/careers/apply", {method:"POST",body:JSON.stringify({openingId:selected.id,firstName,lastName,phone,email,consent,website:""})});
      setReference(response.reference);
    } catch (err) { setError(err instanceof Error ? err.message : "We couldn't submit your application."); }
    finally { setSubmitting(false); }
  };
  return <div className="min-h-screen bg-background text-foreground">
    <PublicNavbar />
    <main className="mx-auto max-w-5xl px-4 py-12 sm:py-20">
      <Link href="/" className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"><ArrowLeft className="h-4 w-4"/>Back to AWS</Link>
      <div className="mb-10 max-w-3xl space-y-4">
        <Badge variant="outline" className="border-primary/30 text-primary">AWS 4.0 · Careers</Badge>
        <h1 className="font-serif text-4xl font-semibold tracking-tight sm:text-6xl">Build the next chapter of wellness.</h1>
        <p className="text-lg text-muted-foreground">Explore opportunities to support Aydens Wellness Services, an Ayden Smith Holdings company. Every position lists its responsibilities and qualifications.</p>
      </div>
      {error && <div role="alert" className="mb-6 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{error}</div>}
      {reference ? <Card className="max-w-xl rounded-2xl"><CardHeader><CheckCircle2 className="h-10 w-10 text-primary"/><CardTitle>Application received</CardTitle><CardDescription>Thank you for your interest. Keep this reference for your records.</CardDescription></CardHeader><CardContent><p className="rounded-lg bg-muted p-4 font-mono text-xl font-semibold">{reference}</p><p className="mt-4 text-sm text-muted-foreground">An application is not an offer of employment. Our team will review it when recruitment is active.</p></CardContent></Card> :
      selected ? <div className="grid gap-8 lg:grid-cols-[.85fr_1.15fr]">
        <div className="space-y-4"><Button variant="outline" onClick={() => {setSelected(null);setError("");}}><ArrowLeft className="mr-2 h-4 w-4"/>All openings</Button><h2 className="text-3xl font-serif">{selected.title}</h2><p className="text-sm uppercase tracking-widest text-primary">{selected.department || "AWS"}</p><p className="whitespace-pre-wrap text-sm text-muted-foreground">{selected.description}</p>{selected.requirements && <><h3 className="font-semibold">Requirements</h3><p className="whitespace-pre-wrap text-sm text-muted-foreground">{selected.requirements}</p></>}</div>
        <Card className="rounded-2xl"><CardHeader><CardTitle>Apply for {selected.title}</CardTitle><CardDescription>Complete all required fields. Your application is visible only to authorized Founder and Corporate reviewers.</CardDescription></CardHeader><CardContent><form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><label className="space-y-2 text-sm font-medium">First name <Input required autoComplete="given-name" value={firstName} onChange={e=>setFirstName(e.target.value)} maxLength={80}/></label><label className="space-y-2 text-sm font-medium">Last name <Input required autoComplete="family-name" value={lastName} onChange={e=>setLastName(e.target.value)} maxLength={80}/></label></div>
          <label className="block space-y-2 text-sm font-medium">Phone number <Input required type="tel" autoComplete="tel" value={phone} onChange={e=>setPhone(e.target.value)} maxLength={45}/></label>
          <label className="block space-y-2 text-sm font-medium">Email address <Input required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} maxLength={200}/></label>
          <label className="block space-y-2 text-sm font-medium">Position <Input value={selected.title} disabled/></label>
          <div className="hidden" aria-hidden="true"><label>Website <Input tabIndex={-1} name="website" autoComplete="off"/></label></div>
          <label className="flex items-start gap-3 rounded-xl bg-muted p-4 text-xs leading-relaxed"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} required className="mt-1"/><span>I understand AWS will use my contact details to review my application and communicate about recruitment. I will not include health or other sensitive personal details in my application.</span></label>
          <Button type="submit" disabled={submitting || !consent} className="w-full">{submitting?"Submitting...":"Submit application"}<ArrowRight className="ml-2 h-4 w-4"/></Button>
        </form></CardContent></Card>
      </div> :
      loading ? <p className="text-muted-foreground">Loading opportunities...</p> :
      openings.length === 0 ? <Card className="rounded-2xl"><CardContent className="py-12 text-center"><BriefcaseBusiness className="mx-auto mb-4 h-10 w-10 text-primary"/><h2 className="text-xl font-semibold">No openings currently accepting applications</h2><p className="mt-2 text-sm text-muted-foreground">Check back for future opportunities with AWS.</p></CardContent></Card> :
      <div className="grid gap-4 md:grid-cols-2">{openings.map(opening=><Card key={opening.id} className="rounded-2xl"><CardHeader><Badge className="w-fit" variant="secondary">{opening.department || "AWS"}</Badge><CardTitle>{opening.title}</CardTitle><CardDescription className="line-clamp-3 whitespace-pre-wrap">{opening.description}</CardDescription></CardHeader><CardContent><Button onClick={() => {setSelected(opening);setError("");window.scrollTo({top:0,behavior:"smooth"});}}>View role & apply<ArrowRight className="ml-2 h-4 w-4"/></Button></CardContent></Card>)}</div>}
      <p className="mt-14 flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4"/>Applicant data is restricted to recruitment reviewers. Please do not submit medical or confidential information.</p>
    </main>
  </div>;
}
