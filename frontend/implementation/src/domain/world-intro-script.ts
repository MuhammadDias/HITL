/**
 * What Momo tells when a student enters a level: where Thinman has to get to, why, and that the drawing
 * page is up in the sky. Plain sentences, no parenthesised asides. Momo only tells; she never decides
 * or draws (lore invariant). Copy is placeholder story text, not locked narrative.
 */
import { formatCharacterText } from "../config/character-tokens";

const TO_SKY = "Yuk kita ke langit, tempat kamu menggambar!";

const SCRIPT: Record<1 | 2 | 3, string[]> = {
  1: [
    "Ini dunia {character}. Dia harus sampai ke bendera di seberang.",
    "Kalau berhasil, dia bisa jalan sendiri tanpa bantuanmu.",
    `Tapi ada celah di depan. ${TO_SKY}`,
  ],
  2: [
    "Halaman ini terlipat ke atas. {character} harus naik sampai dataran paling tinggi.",
    "Setelah sampai, dia bisa jalan sendiri tanpa bantuanmu.",
    `Dia butuh pijakan. ${TO_SKY}`,
  ],
  3: [
    "Lorong ini berkabut dan lantainya penuh duri. {character} harus keluar sampai ke bendera.",
    "Kalau selamat, dia bisa jalan sendiri tanpa bantuanmu.",
    `Pilih benda yang aman buat dia. ${TO_SKY}`,
  ],
};

export function introLines(stage: number, characterDisplayName?: string | null): string[] {
  const key = (stage >= 1 && stage <= 3 ? stage : 1) as 1 | 2 | 3;
  return SCRIPT[key].map((line) => formatCharacterText(line, characterDisplayName));
}
