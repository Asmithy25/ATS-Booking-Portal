import PhoneWorkspace from "@/components/PhoneWorkspace";
import { PhoneCall } from "lucide-react";

export default function PhoneCenter() {
  return <div className="space-y-6">
    <header>
      <p className="text-xs font-bold uppercase tracking-[.2em] text-primary">AWS Operations · Staff reference</p>
      <h1 className="mt-2 flex items-center gap-3 font-serif text-4xl"><PhoneCall className="h-8 w-8 text-primary" />Phone Center</h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Look up a division or teammate's extension, and use approved call-handling scripts. Ayden and ASH Corporate manage these entries under Website Settings.</p>
    </header>
    <PhoneWorkspace />
  </div>;
}
