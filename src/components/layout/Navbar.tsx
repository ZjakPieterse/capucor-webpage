"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { siteConfig } from "@/config/site";

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
      <nav className="max-w-7xl mx-auto px-6 flex items-center justify-between h-16">
        {/* Logo */}
        <Link
          href="/"
          onClick={() => handleHomeClick("/")}
          className="hover:opacity-80 transition-opacity flex items-center"
        >
          <Image
            src="/brand/logo-dark.png"
            alt="Capucor Business Solutions"
            height={40}
            width={200}
            priority
            sizes="200px"
            className="h-8 w-auto"
            style={{ width: "auto" }}
          />
        </Link>

        {/* Desktop nav */}
        <ul className="hidden md:flex items-center gap-8">
          {siteConfig.nav.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={() => handleHomeClick(item.href)}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>

        {/* Desktop actions */}
        <div className="hidden md:flex items-center gap-2">
          <Button
            nativeButton={false}
            render={<Link href="/portal" />}
            size="sm"
          >
            Client Portal
          </Button>
        </div>

        {/* Mobile */}
        <div className="flex md:hidden items-center gap-1">
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
                    className="flex min-h-11 items-center text-base font-medium text-foreground/90 hover:text-primary transition-colors"
                    onClick={() => {
                      setOpen(false);
                      handleHomeClick(item.href);
                    }}
                  >
                    {item.label}
                  </Link>
                ))}
                <div className="mt-4 pt-4 border-t border-white/10">
                  <Button
                    nativeButton={false}
                    render={<Link href="/portal" />}
                    className="w-full h-11"
                  >
                    Client Portal
                  </Button>
                </div>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </header>
  );
}
