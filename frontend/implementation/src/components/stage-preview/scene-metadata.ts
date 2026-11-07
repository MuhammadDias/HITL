/** Metadata from the supplied four-slide visual reference. */
export type SceneIndex = 0 | 1 | 2 | 3;

export const STAGE_SCENES = [
  { index: 0, title: 'Gameplay Screen', level: null, caption: null },
  { index: 1, title: 'Halaman yang Sobek', level: 1, caption: 'Buat pijakan untuk menyeberangi halaman yang terputus.' },
  { index: 2, title: 'Menara Lipatan', level: 2, caption: 'Susun objek untuk mencapai tempat yang lebih tinggi.' },
  { index: 3, title: 'Lorong Kabut Penghapus', level: 3, caption: 'Pilih jalur yang aman dan tempatkan objek secara strategis.' },
] as const;
