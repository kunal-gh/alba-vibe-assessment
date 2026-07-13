"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { Menu, X, Instagram, Twitter, Facebook } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useSettings } from "@/lib/data-provider";

export const navLinks = [
  { href: "/#home", label: "Home" },
  { href: "/#portfolio", label: "Portfolio" },
  { href: "/#testimonials", label: "Testimonials" },
  { href: "/#contact", label: "Contact" },
];

interface HeaderProps {
  isMenuOpen: boolean;
  onMenuToggle: () => void;
  onLinkClick: (e: React.MouseEvent<HTMLAnchorElement>, href: string) => void;
  activeLink: string;
}

export function Header({ isMenuOpen, onMenuToggle, onLinkClick, activeLink }: HeaderProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isMobileScreen, setIsMobileScreen] = useState(false);
  const pathname = usePathname();
  const { data: settings } = useSettings();

  useEffect(() => {
    const checkMobile = () => setIsMobileScreen(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    const handleMouseMove = (e: MouseEvent) => {
      setIsHovered(e.clientY < 80);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll);
    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  const showHeader = isMobileScreen || isScrolled || isHovered;

  const NavLink = ({ href, label }: { href: string; label: string }) => {
    const isActive = activeLink === href;
    const isHomePage = pathname === "/";
    const cls = cn(
      "relative py-2 text-sm font-medium transition-colors duration-300",
      isActive ? "text-primary" : "text-foreground/80 hover:text-foreground",
      "after:absolute after:bottom-0 after:left-0 after:h-[2px] after:w-full after:bg-primary after:transition-transform after:duration-300 after:origin-left",
      isActive ? "after:scale-x-100" : "after:scale-x-0"
    );
    if (isHomePage && href.startsWith("/#")) {
      return <a href={href} className={cls} onClick={(e) => onLinkClick(e, href)}><span>{label}</span></a>;
    }
    return <Link href={href} className={cls} onClick={(e) => onLinkClick(e, href)}><span>{label}</span></Link>;
  };

  return (
    <header
      className={cn(
        "fixed top-0 z-50 w-full transition-all duration-500",
        showHeader
          ? "translate-y-0 opacity-100 border-b border-border/60 bg-background shadow-sm"
          : "-translate-y-full opacity-0 pointer-events-none"
      )}
    >
      <div className="flex h-14 items-center justify-between px-4 w-full max-w-full">
        {pathname === "/" ? (
          <a href="/#home" onClick={(e) => onLinkClick(e, "/#home")} className="flex flex-col items-start shrink-0 leading-tight">
            <span className="font-bold font-headline text-2xl md:text-3xl tracking-[0.2em]">THE</span>
            <span className="text-[0.6rem] md:text-xs font-body tracking-widest uppercase whitespace-nowrap opacity-70">
              Through Hardik's Eye
            </span>
          </a>
        ) : (
          <Link href="/#home" onClick={(e) => onLinkClick(e, "/#home")} className="flex flex-col items-start shrink-0 leading-tight">
            <span className="font-bold font-headline text-2xl md:text-3xl tracking-[0.2em]">THE</span>
            <span className="text-[0.6rem] md:text-xs font-body tracking-widest uppercase whitespace-nowrap opacity-70">
              Through Hardik's Eye
            </span>
          </Link>
        )}

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-8">
          <nav className="flex items-center gap-6 text-sm">
            {navLinks.map((link) => <NavLink key={link.href} {...link} />)}
          </nav>
          <div className="flex items-center gap-3">
            {settings?.twitter && (
              <Link href={settings.twitter} target="_blank" rel="noopener noreferrer" aria-label="Twitter">
                <Twitter className="h-4 w-4 opacity-80 hover:opacity-100 transition-opacity" />
              </Link>
            )}
            {settings?.facebook && (
              <Link href={settings.facebook} target="_blank" rel="noopener noreferrer" aria-label="Facebook">
                <Facebook className="h-4 w-4 opacity-80 hover:opacity-100 transition-opacity" />
              </Link>
            )}
            {settings?.instagram && (
              <Link href={settings.instagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram">
                <Instagram className="h-4 w-4 opacity-80 hover:opacity-100 transition-opacity" />
              </Link>
            )}
          </div>
        </div>

        {/* Hamburger — mobile only */}
        <div className="flex items-center md:hidden">
          <Button variant="ghost" size="icon" onClick={onMenuToggle}>
            {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            <span className="sr-only">Toggle Menu</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
