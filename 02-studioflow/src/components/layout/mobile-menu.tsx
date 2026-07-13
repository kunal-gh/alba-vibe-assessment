"use client";

import Link from "next/link";
import { Instagram, Twitter, Facebook, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useSettings } from "@/lib/data-provider";

const navLinks = [
  { href: "/#home", label: "Home" },
  { href: "/#portfolio", label: "Portfolio" },
  { href: "/#testimonials", label: "Testimonials" },
  { href: "/#contact", label: "Contact" },
];

interface MobileMenuOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  activeLink: string;
  onLinkClick: (e: React.MouseEvent<HTMLAnchorElement>, href: string) => void;
}

export function MobileMenuOverlay({
  isOpen,
  onClose,
  activeLink,
  onLinkClick,
}: MobileMenuOverlayProps) {
  const { data: settings } = useSettings();

  if (!isOpen) return null;

  return (
    <div
      style={{
        backgroundColor: "#f4f1ec",
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 h-14 w-full shrink-0">
        <a
          href="/#contact"
          onClick={(e) => onLinkClick(e, "/#contact")}
          className="flex items-center gap-2 font-body font-bold text-xs tracking-widest uppercase transition-opacity hover:opacity-70"
        >
          TOUCH <span className="text-base leading-none">&rarr;</span> GET IN
        </a>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="hover:bg-transparent"
        >
          <X className="h-7 w-7" strokeWidth={1.5} />
          <span className="sr-only">Close Menu</span>
        </Button>
      </div>

      {/* Navigation — right-aligned, massive */}
      <nav className="flex flex-col items-end justify-center flex-1 px-6">
        {navLinks.map((link) => {
          const isActive = activeLink === link.href;
          return (
            <a
              key={link.href}
              href={link.href}
              onClick={(e) => onLinkClick(e, link.href)}
              className={cn(
                "font-body font-black uppercase py-1",
                "transition-colors duration-200",
                isActive ? "text-foreground" : "text-foreground/70 hover:text-foreground"
              )}
              style={{ fontSize: "clamp(2.5rem,9vw,5rem)", lineHeight: 0.9, letterSpacing: "-0.02em" }}
            >
              {link.label}
            </a>
          );
        })}
      </nav>

      {/* Social footer */}
      <div className="flex items-center justify-between px-6 pb-10 pt-4 w-full shrink-0">
        <span className="text-[10px] uppercase tracking-widest text-foreground/40 font-semibold">
          Follow
        </span>
        <div className="flex gap-5">
          {settings?.instagram && (
            <Link href={settings.instagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram">
              <Instagram className="h-5 w-5 text-foreground/60 hover:text-foreground transition-colors" />
            </Link>
          )}
          {settings?.twitter && (
            <Link href={settings.twitter} target="_blank" rel="noopener noreferrer" aria-label="Twitter">
              <Twitter className="h-5 w-5 text-foreground/60 hover:text-foreground transition-colors" />
            </Link>
          )}
          {settings?.facebook && (
            <Link href={settings.facebook} target="_blank" rel="noopener noreferrer" aria-label="Facebook">
              <Facebook className="h-5 w-5 text-foreground/60 hover:text-foreground transition-colors" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
