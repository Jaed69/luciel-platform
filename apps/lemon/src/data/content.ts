// Contenido editable del sitio. Agrega entradas aquí y haz push a main.

export interface Photo {
  src: string; // ruta bajo /assets/photos/
  caption: string;
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
  avatar?: string; // capítulo II: ruta bajo /assets/avatars/ — sin foto se muestra la inicial
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
];

// Mensajes de cariño curados por el dueño del sitio (no es un formulario público).
export const birthdayWishes: Message[] = [
  { name: 'Ana', text: 'Feliz cumple, tu arte nos inspira cada dia.', approved: true, role: 'coro / voz aguda' },
  { name: 'Beto', text: 'Que este ano venga cargado de color y creatividad.', approved: true, role: 'coro / bajo' },
];

// Mensajes del guestbook publico. El formulario real envia a un servicio externo
// (ver GuestbookForm.astro) y el dueño copia aqui los que aprueba.
export const guestbookMessages: Message[] = [
  { name: 'Cami', text: 'Gracias por compartir tu arte con todos nosotros.', approved: true },
  { name: 'Diego', text: 'Feliz cumple Lemondrea, un abrazo enorme.', approved: true },
];

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
