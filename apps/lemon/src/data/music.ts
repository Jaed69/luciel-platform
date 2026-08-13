// Música de fondo del libro (capítulo I-V). Se reproduce en loop de playlist
// al abrir el libro; el botón de sonido la pausa/reanuda y el panel deja
// saltar a la siguiente. Cunumi va primero a propósito.

export interface Track {
  title: string;
  artist: string;
  src: string; // ruta bajo /assets/music/
}

export const playlist: Track[] = [
  { title: 'Faraon Love Shady', artist: 'Cunumi', src: '/assets/music/track-01-cunumi.webm' },
  { title: 'Otsukare Summer', artist: 'HALCALI', src: '/assets/music/track-02-halcali.webm' },
  { title: 'Run Rabbit', artist: 'Mollie Elizabeth', src: '/assets/music/track-03-runrabbit.webm' },
  { title: 'Lemon Boy', artist: 'Cavetown', src: '/assets/music/track-04-lemonboy.mp3' },
];
