export interface VideoEntry {
  id: string;
  title: string;
  youtubeId: string;
  date: string; // ISO yyyy-mm-dd
  description?: string;
}

export interface Section {
  slug: string; // usado como anchor: lemon.luciel.dev#slug
  title: string;
  videos: VideoEntry[];
}

// Agrega secciones/videos nuevos aquí y haz push a main — el deploy es automático.
export const sections: Section[] = [
  {
    slug: 'bienvenida',
    title: 'Bienvenida',
    videos: [
      {
        id: 'ejemplo-1',
        title: 'Video de ejemplo — reemplázame',
        youtubeId: 'dQw4w9WgXcQ',
        date: '2026-07-15',
        description: 'Reemplaza esta entrada con el primer video real.',
      },
    ],
  },
];
