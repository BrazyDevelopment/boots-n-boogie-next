"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Menu, MessageCircle, ShoppingBag, Ticket, User, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { NAV, SITE } from "@/lib/data";
import { loadSiteVisibility } from "@/lib/site-settings";

const PRIMARY_HREFS = [
  "/",
  "/classes/",
  "/book/",
  "/events/",
  "/blog/",
  "/shop/",
  "/subscribe/",
  "/franchise/",
];

export function Header() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { count } = useCart();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [franchisePublic, setFranchisePublic] = useState(true);
  // Community PWA shell — hide chrome, but hooks must still run every render
  const hideChrome = Boolean(pathname?.startsWith("/community"));

  useEffect(() => {
    if (hideChrome) return;
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [hideChrome]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (hideChrome) return;
    loadSiteVisibility()
      .then((s) => setFranchisePublic(s.franchisePagePublic))
      .catch(() => setFranchisePublic(true));
  }, [pathname, hideChrome]);

  const isActive = (href: string) =>
    href === "/"
      ? pathname === "/"
      : pathname === href || pathname.startsWith(href.replace(/\/$/, ""));

  const visibleNav = useMemo(
    () =>
      NAV.filter((n) => {
        if (n.href === "/franchise/" && !franchisePublic) return false;
        return true;
      }),
    [franchisePublic]
  );

  const primaryNav = visibleNav.filter((n) => PRIMARY_HREFS.includes(n.href));
  const moreNav = visibleNav.filter((n) => !primaryNav.includes(n));

  if (hideChrome) {
    return null;
  }

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled || open || pathname !== "/"
          ? "header-western border-b border-accent/15 bg-bg/92 backdrop-blur-xl"
          : "border-b border-transparent bg-transparent"
      }`}
    >
      <div className="container-wide flex h-[4.5rem] items-center justify-between gap-3">
        <Link href="/" className="group flex shrink-0 items-center gap-3">
          <Image
            src="/images/logo.png"
            alt={SITE.name}
            width={120}
            height={120}
            priority
            className="h-12 w-12 object-contain transition group-hover:brightness-110 md:h-14 md:w-14"
          />
        </Link>

        <nav className="hidden items-center gap-0.5 xl:flex">
          {primaryNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-full px-3 py-2 text-sm font-medium transition-colors ${
                isActive(item.href)
                  ? "bg-white/8 text-foreground"
                  : "text-muted hover:bg-white/5 hover:text-foreground"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/community/"
            className="hidden h-10 items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-3 text-sm font-semibold text-accent hover:bg-accent hover:text-bg sm:inline-flex"
            aria-label="Community chat"
          >
            <MessageCircle size={16} />
            Chat
          </Link>
          <Link
            href="/shop/"
            className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-line bg-white/5 text-foreground hover:bg-white/10"
            aria-label="Shop cart"
          >
            <ShoppingBag size={18} />
            {count > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-bg">
                {count}
              </span>
            )}
          </Link>
          <Link
            href={user ? "/account/" : "/account/login/"}
            className="hidden h-10 items-center gap-2 rounded-full border border-line bg-white/5 px-3 text-sm font-semibold text-foreground hover:bg-white/10 sm:inline-flex"
          >
            <User size={16} />
            {user ? user.name.split(" ")[0] : "Account"}
          </Link>
          <Link href="/book/" className="btn-primary hidden !px-4 !py-2 text-sm lg:inline-flex">
            <Ticket size={16} />
            Book a class
          </Link>
          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-line bg-white/5 text-foreground xl:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-line bg-bg-elevated xl:hidden">
          <div className="container-page flex max-h-[70vh] flex-col gap-1 overflow-y-auto py-4">
            {[...primaryNav, ...moreNav].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-xl px-4 py-3 text-base font-medium ${
                  isActive(item.href) ? "bg-white/8 text-accent" : "text-foreground"
                }`}
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/community/"
              className="rounded-xl px-4 py-3 text-base font-medium text-accent"
            >
              Chat
            </Link>
            <Link
              href={user ? "/account/" : "/account/login/"}
              className="rounded-xl px-4 py-3 text-base font-medium text-foreground"
            >
              {user ? "My account" : "Log in / Register"}
            </Link>
            {user?.role === "admin" && (
              <Link href="/admin/" className="rounded-xl px-4 py-3 text-base font-medium text-accent">
                Admin dashboard
              </Link>
            )}
            <Link href="/book/" className="btn-primary mt-2 w-full">
              <Ticket size={16} />
              Book a class
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
