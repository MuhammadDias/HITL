import type { Metadata, Viewport } from "next";
import "./globals.css";
import { CameraProvider } from "@/src/components/camera/CameraProvider";

export const metadata: Metadata = {
  title: "Sketchbook Universe — Gambar. Putuskan. Hidupkan.",
  description:
    "Buku sketsa interaktif: gambar dengan jarimu, periksa tebakan, dan hidupkan ciptaanmu bersama Momo.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body><CameraProvider>{children}</CameraProvider></body>
    </html>
  );
}
