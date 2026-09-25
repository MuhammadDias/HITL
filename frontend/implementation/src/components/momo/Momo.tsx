import Image from "next/image";

export function Momo({ large = false }: { large?: boolean }) {
  return <Image className={`momo-illustration ${large ? "momo-large" : ""}`} src="/assets/momo.svg" width={220} height={300} alt="Momo, layang-layang hijau dengan tiga ekor warna-warni" priority={large} unoptimized />;
}
