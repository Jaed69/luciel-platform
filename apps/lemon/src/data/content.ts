// Contenido editable del sitio. Agrega entradas aquí y haz push a main.

export interface Photo {
  src: string; // ruta bajo /assets/photos/ (poster si es video)
  caption: string;
  video?: string; // si se define, el marco reproduce este video (ruta bajo /assets/videos/) en vez de solo mostrar la imagen
}

export interface Album {
  key: string;
  label: string;
  photos: Photo[];
}

export interface Message {
  name: string;
  text: string;
  approved: boolean; // solo se muestran approved:true en el sitio publicado
  role?: string; // capítulo II: "rol" de la ficha de perfil (ej. "coro / voz aguda")
  avatar?: string; // fuerza un avatar puntual (ruta bajo /assets/avatars/); si no se pone, se asigna por ciclo desde data/avatars.ts
}

export const artAlbums: Album[] = [
  {
    key: 'bocetos',
    label: 'Bocetos',
    photos: [
      { src: '/assets/photos/placeholder.jpg', caption: 'Boceto 1' },
      { src: '/assets/photos/placeholder.jpg', caption: 'Boceto 2' },
    ],
  },
  {
    key: 'mural',
    label: 'Mural',
    photos: [
      { src: '/assets/photos/placeholder.jpg', caption: 'Mural boceto' },
      { src: '/assets/photos/placeholder.jpg', caption: 'Mural final' },
    ],
  },
  {
    key: 'proceso',
    label: 'Proceso',
    photos: [
      { src: '/assets/photos/placeholder.jpg', caption: 'Trabajo en progreso' },
    ],
  },
  {
    key: 'momentos',
    label: 'Momentos',
    photos: [
      { src: '/assets/photos/momentos-01.jpg', caption: 'Momento 1' },
      { src: '/assets/photos/momentos-02.jpg', caption: 'Momento 2' },
      { src: '/assets/photos/momentos-03.jpg', caption: 'Momento 3' },
      { src: '/assets/photos/momentos-04.jpg', caption: 'Momento 4' },
      { src: '/assets/photos/momentos-05.jpg', caption: 'Momento 5' },
      { src: '/assets/photos/momentos-06.jpg', caption: 'Momento 6' },
      { src: '/assets/photos/momentos-07.jpg', caption: 'Momento 7' },
      { src: '/assets/photos/momentos-08.jpg', caption: 'Momento 8' },
      { src: '/assets/photos/momentos-09-poster.jpg', caption: 'Momento 9', video: '/assets/videos/momentos-01.mp4' },
    ],
  },
];

// Mensajes de cariño curados por el dueño del sitio (no es un formulario público).
export const birthdayWishes: Message[] = [];

// Mensajes del guestbook publico. Se cargan en vivo desde Supabase
// (ver GuestbookForm.astro) — este array ya no se usa como fuente de datos.
export const guestbookMessages: Message[] = [];

// Última hoja del libro: dedicatoria de despedida.
// BORRADOR — reemplaza el texto y la firma por los tuyos antes de enviar el regalo.
export const dedication = {
  lines: [
    'Este libro se hizo para guardar un año entero de tu arte, de tus ideas y de la gente que te quiere.',
    'Que cada página te recuerde lo que ya lograste, y que el capítulo que viene lo escribas con la misma luz de siempre.',
    'Feliz cumpleaños, Lemondrea.',
  ],
  signature: 'Con cariño, tu amigo', // ← firma aquí
};
