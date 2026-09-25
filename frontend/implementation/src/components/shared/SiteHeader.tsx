"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function SiteHeader() {
  const path = usePathname();
  return <header className="site-header">
    <Link className="brand" href="/" aria-label="Sketchbook Universe, beranda"><span className="brand-mark" aria-hidden="true"/><span>SKETCHBOOK<br/><small>UNIVERSE</small></span></Link>
    <nav aria-label="Navigasi utama"><Link href="/" aria-current={path === "/" ? "page" : undefined}>Beranda</Link><Link href="/live" className="nav-demo" aria-current={path === "/live" ? "page" : undefined}>Live demo <span aria-hidden="true">↗</span></Link></nav>
  </header>;
}
