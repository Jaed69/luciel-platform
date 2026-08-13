// Música de fondo del libro (capítulo I-V). La playlist normal rota en los
// capítulos I-IV; capítulo V (despedida) corta a farewellTrack en vez de
// seguir la rotación — ver SoundToggle.astro.

export interface Track {
  title: string;
  artist: string;
  src: string; // ruta bajo /assets/music/
}

export const playlist: Track[] = [
  { title: 'Otsukare Summer', artist: 'HALCALI', src: '/assets/music/track-02-halcali.webm' },
  { title: 'Run Rabbit', artist: 'Mollie Elizabeth', src: '/assets/music/track-03-runrabbit.webm' },
  { title: 'Lemon Boy', artist: 'Cavetown', src: '/assets/music/track-04-lemonboy.mp3' },
];

// Pista única para el cierre: suena en la revelación del intro (primera
// visita) y cada vez que se llega al capítulo V del libro. No forma parte
// de la rotación ni de aleatorio/repetir.
export const farewellTrack: Track = {
  title: 'Tienes 19',
  artist: '',
  src: '/assets/music/track-farewell.mp3',
};
