import Link from "next/link";
import { ArrowRight, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";

// The homepage hero's button pair (primary: calculator; secondary: fit call),
// reused on the service pages so visitors not ready to price have a next step.
// The line under it says what the fit call is (F25).
export function ServiceCtaPair({ centered = false }: { centered?: boolean }) {
  return (
    <div className={cn("flex flex-col gap-3", centered && "items-center text-center")}>
      <div className={cn("flex w-full flex-col sm:flex-row gap-3", centered && "justify-center")}>
        <Button
          nativeButton={false}
          render={<Link href="/pricing" />}
          size="lg"
          className="gradient-cta gap-2 w-full sm:w-auto"
        >
          <span className="relative z-[2] inline-flex items-center gap-2">
            Build your subscription <ArrowRight className="h-4 w-4" />
          </span>
        </Button>
        <Button
          nativeButton={false}
          render={
            <a
              href={siteConfig.links.booking}
              target="_blank"
              rel="noopener noreferrer"
            />
          }
          variant="outline"
          size="lg"
          className="gap-2 w-full sm:w-auto"
        >
          <Calendar className="h-4 w-4" /> Book a fit call
        </Button>
      </div>
    </div>
  );
}
