"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { siteConfig } from "@/config/site";

// The header's one filled button is the funnel's next step, /pricing (funnel
// review F01, 2026-10-08). The Client Portal link stays until os-sunset (see
// docs/domain-seam.md) but as a plain secondary text link, so the most visible
// action on every page no longer leads out of the funnel.
const PORTAL_HREF = `${siteConfig.appUrl}/portal`;

export function Navbar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const handleHomeClick = (href: string) => {
    if (href === "/" && pathname === "/") {
      window.scrollTo({ top: 0, behavior: "auto" });
    }
  };

  return (
    <header className="no-print sticky top-0 z-50 w-full border-b border-white/10 bg-background/70 shadow-[0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-xl">
      <nav className="max-w-7xl mx-auto px-5 sm:px-6 flex items-center justify-between gap-4 h-16">
        {/* Logo */}
        <Link
          href="/"
          onClick={() => handleHomeClick("/")}
          className="hover:opacity-80 transition-opacity flex shrink-0 items-center"
        >
          <Image
            src="/brand/capucor-logo-on-dark.png"
            alt="Capucor Business Solutions"
            height={40}
            width={200}
            priority
            sizes="200px"
            className="h-8 w-auto"
            style={{ width: "auto" }}
          />
        </Link>

        {/* Desktop nav (lg+: six links and two actions need the width) */}
        <ul className="hidden lg:flex items-center gap-6">
          {siteConfig.nav.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={() => handleHomeClick(item.href)}
                aria-current={pathname === item.href ? "page" : undefined}
                className="quiet-hover text-sm text-muted-foreground"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>

        {/* Desktop actions */}
        <div className="hidden lg:flex items-center gap-5">
          <a href={PORTAL_HREF} className="quiet-hover text-sm text-muted-foreground">
            Client Portal
          </a>
          <Button
            nativeButton={false}
            render={<Link href="/pricing" />}
            size="sm"
            className="gradient-cta gap-1.5"
          >
            <span className="relative z-[2] inline-flex items-center gap-1.5">
              Build your subscription <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </Button>
        </div>

        {/* Mobile and tablet */}
        <div className="flex lg:hidden items-center gap-1">
          <Button
            nativeButton={false}
            render={<Link href="/pricing" />}
            size="sm"
            className="gradient-cta hidden min-[400px]:inline-flex"
          >
            <span className="relative z-[2]">Build your subscription</span>
          </Button>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Open menu"
                  className="!size-11 [&_svg:not([class*='size-'])]:size-5"
                />
              }
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetHeader>
                <SheetTitle className="text-left">Menu</SheetTitle>
              </SheetHeader>
              <nav className="mt-8 flex flex-col gap-1">
                {siteConfig.nav.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={pathname === item.href ? "page" : undefined}
                    className="flex min-h-11 items-center text-base font-medium text-foreground/90 hover:text-primary transition-colors"
                    onClick={() => {
                      setOpen(false);
                      handleHomeClick(item.href);
                    }}
                  >
                    {item.label}
                  </Link>
                ))}
                <div className="mt-4 flex flex-col gap-2 border-t border-white/10 pt-4">
                  <Button
                    nativeButton={false}
                    render={<Link href="/pricing" />}
                    className="gradient-cta w-full h-11"
                    onClick={() => setOpen(false)}
                  >
                    <span className="relative z-[2]">Build your subscription</span>
                  </Button>
                  <a
                    href={PORTAL_HREF}
                    className="quiet-hover flex min-h-11 items-center text-sm text-muted-foreground"
                  >
                    Client Portal
                  </a>
                </div>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </header>
  );
}
