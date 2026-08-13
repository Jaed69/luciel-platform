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
        id: 'recopilado-1',
        title: 'Creación de sticker',
        youtubeId: 'aBYLe2C4T9I',
        date: '2026-07-30',
      },
      {
        id: 'recopilado-2',
        title: 'Creación de sticker parte 2',
        youtubeId: 'p6bEW32McRE',
        date: '2026-07-30',
      },
      {
        id: 'recopilado-3',
        title: 'Graba bien yoyo!! XD',
        youtubeId: 'BjI_XiacqWM',
        date: '2026-07-30',
      },
      {
        id: 'recopilado-4',
        title: 'Buenas',
        youtubeId: 'lR-ufHiSpsA',
        date: '2026-07-30',
      },
      {
        // Reemplazá youtubeId por el video real cuando lo tengas — el resto
        // del clip queda listo.
        id: 'especial',
        title: 'Feliz cumpleaños',
        youtubeId: 'PENDIENTE',
        date: '2026-08-13',
        description: 'Mensaje especial de cumpleaños.',
      },
    ],
  },
];
