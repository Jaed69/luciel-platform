// Config de Supabase para el libro de visitas en vivo (capítulos II y IV).
// SUPABASE_ANON_KEY es la "publishable key" — pensada para exponerse en el
// cliente; el acceso real lo controlan las policies de RLS de la tabla.
export const SUPABASE_URL = 'https://ojoirxufxmzxtjowzbqk.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_ZaX7Vkmn8BTolPM_TzeLnw_hva6ujk2';
export const GUESTBOOK_TABLE = 'guestbook_messages';
export const GUESTBOOK_REST_URL = `${SUPABASE_URL}/rest/v1/${GUESTBOOK_TABLE}`;

// Álbum "Momentos" en vivo (capítulo I): fotos/video subidos por visitantes.
export const MOMENTOS_TABLE = 'momentos_photos';
export const MOMENTOS_REST_URL = `${SUPABASE_URL}/rest/v1/${MOMENTOS_TABLE}`;
export const MOMENTOS_BUCKET = 'momentos';
export const MOMENTOS_STORAGE_UPLOAD_URL = `${SUPABASE_URL}/storage/v1/object/${MOMENTOS_BUCKET}`;
export const MOMENTOS_STORAGE_PUBLIC_URL = `${SUPABASE_URL}/storage/v1/object/public/${MOMENTOS_BUCKET}`;
