"use client";
import Link from "next/link";
import { SiteHeader } from "../shared/SiteHeader";
import { Momo } from "../momo/Momo";
import { useCamera } from "../camera/CameraProvider";

export function LandingPage() {
  const { status } = useCamera();
  const seesHand = ["drawing", "hover", "undo-pending", "undo-triggered"].includes(status.kind);
  return <div className="site-shell">
    <SiteHeader />
    <main className="landing">
      <section className="hero-copy">
        <span className="eyebrow"><span className="tiny-star">✦</span> BUKU SKETSA YANG BISA DIMAINKAN</span>
        <h1>Dari ujung<br/>jarimu,<br/><span className="highlight-word">jadi dunia.</span></h1>
        <p className="hero-lead">Satu gambar kecil. Satu petualangan baru.<br/>Bantu Momo menghidupkan buku sketsa—<br className="desktop-break"/>kamu yang menggambar, kamu yang memutuskan.</p>
        <Link className="btn btn-primary hero-cta" href="/live">Buka buku sketsa <span aria-hidden="true">↗</span></Link>
        <p className="hero-note">3 level · gambar pakai jari, mouse, atau sentuhan</p>
      </section>
      <section className="hero-art" aria-label="Sambutan Momo">
        <span className="paper-label">TEMAN BARUMU, MOMO</span>
        <div className="momo-greeting" role="status"><strong>Hi, halo! Aku Momo.</strong><span>{seesHand ? "Aku lihat tanganmu! Siap bikin sesuatu?" : "Angkat tanganmu. Kita bikin dunia bareng!"}</span></div>
        <div className="momo-orbit"><Momo large /></div>
        <span className="art-stamp">IMAJINASIMU<br/>PUNYA TEMPAT DI SINI.</span>
        <span className="orbit-star" aria-hidden="true">✳</span>
      </section>
      <ol className="landing-steps" aria-label="Cara bermain">
        <li><span>01</span><div><strong>Gambar</strong><p>Cubit jari, buat goresanmu.</p></div></li>
        <li><span>02</span><div><strong>Periksa</strong><p>Pilih objek yang kamu maksud.</p></div></li>
        <li><span>03</span><div><strong>Hidupkan</strong><p>Bawa stickman melewati dunia.</p></div></li>
      </ol>
    </main>
    <footer className="landing-footer">BUKU INI MENUNGGU IDEMU. <span>Sketchbook Universe · Live demo</span></footer>
  </div>;
}
