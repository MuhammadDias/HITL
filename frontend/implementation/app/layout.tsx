import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sketchbook Universe — DEV BUILD (author-side)",
  description:
    "Simulasi literasi AI Human-in-the-Loop untuk siswa SMP. DEV build: prediksi memakai provider mock/partner adapter, bukan model final.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
