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

// Para sumar una foto nueva al final de un álbum: agregar un objeto más al
// final de su array `photos`, con `src` bajo /assets/photos/. Para un video:
// agregar `video` (ruta bajo /assets/videos/) y usar `src` como poster —
// ver el ejemplo del último elemento de 'momentos'.
export const artAlbums: Album[] = [
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
    '¡Hola Andrea! ^-^',
    'Traté de hacer lo mejor que pude con el tiempo que tenía, jajaja. En este libro, en la presentación, en el regalo... puse todo lo que pude. Sé que no soy artista ni fotógrafo, pero algo de computadoras sí sé.',
    'Espero que cada página te recuerde y te alegre los días — ojalá hasta suene tu canción favorita, xdxdxd.',
    'Sos de esa pigmentación de noche taciturna e inexplorada que, en palabras simples, es un evento maravilloso. Me alegro de haberte conocido: hiciste mis días más irónicamente coloridos.',
    '¿Para cuándo el Roblox o el mundo de Minecraft? jajaja',
    'Feliz cumpleaños, Andrea.',
  ],
  signature: 'Con cariño, Luciel',
};
