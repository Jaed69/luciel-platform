// Set compartido de avatares (chibis). Se usan tanto en el picker del libro de
// visitas (capítulo IV) como en las fichas de perfil de mensajes (capítulo II).
// Agregar una entrada acá la hace aparecer automáticamente en ambos lugares.

export interface AvatarOption {
  src: string; // ruta bajo /assets/avatars/
  hue: number; // tono del acento neón asociado
}

export const avatars: AvatarOption[] = [
  { src: '/assets/avatars/avatar-01.png', hue: 200 },
  { src: '/assets/avatars/avatar-02.png', hue: 40 },
  { src: '/assets/avatars/avatar-03.png', hue: 340 },
  { src: '/assets/avatars/avatar-04.png', hue: 150 },
  { src: '/assets/avatars/avatar-05.png', hue: 220 },
  { src: '/assets/avatars/avatar-06.png', hue: 280 },
  { src: '/assets/avatars/avatar-07.png', hue: 320 },
  { src: '/assets/avatars/avatar-08.png', hue: 95 },
  { src: '/assets/avatars/avatar-09.png', hue: 60 },
  { src: '/assets/avatars/avatar-10.png', hue: 260 },
  { src: '/assets/avatars/avatar-11.png', hue: 110 },
  { src: '/assets/avatars/avatar-12.png', hue: 350 },
];
