"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

// A slim sticky "Build your subscription" bar for phones on marketing pages
// (funnel review F03, 2026-10-08). On the homepage the next pricing button
// after the hero sat about 6,400 px further down.
//
// - Phones only (`md:hidden`), and not on /pricing, which has its own
//   MobileTotalBar. /proposal/* has no site chrome, so it never renders there.
// - It appears once the visitor has scrolled past the first screen, so it does
//   not duplicate the hero's own button.
// - It never covers content: the in-flow spacer below reserves its height at
//   the foot of the page, safe-area inset included.
const HIDDEN_ON = ["/pricing"];
const BAR_HEIGHT = "4.25rem";

export function MobileCtaBar() {
  const pathname = usePathname();
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const onScroll = () => setShown(window.scrollY > window.innerHeight * 0.6);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (HIDDEN_ON.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;

  return (
    <>
      <div
        aria-hidden
        className="no-print md:hidden"
        style={{ height: `calc(${BAR_HEIGHT} + env(safe-area-inset-bottom))` }}
      />
      <div
        className="mobile-cta-bar no-print fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/85 backdrop-blur-xl md:hidden"
        data-shown={shown ? "true" : "false"}
        inert={!shown}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex items-center px-4 py-3" style={{ minHeight: BAR_HEIGHT }}>
          <Button
            nativeButton={false}
            render={<Link href="/pricing" />}
            className="gradient-cta h-11 w-full"
          >
            <span className="relative z-[2] inline-flex items-center gap-1.5">
              Build your subscription <ArrowRight className="h-4 w-4" />
            </span>
          </Button>
        </div>
      </div>
    </>
  );
}
