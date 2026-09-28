/* =========================================================
   Configuración de la aplicación
   ---------------------------------------------------------
   Copie aquí los datos de su proyecto de Supabase
   (botón "Connect" o Project Settings → API Keys).
   Si los deja vacíos, la
   aplicación funciona en MODO DEMOSTRACIÓN: se puede
   probar todo, pero los datos no se guardan.
   ========================================================= */
window.APP_CONFIG = {
  SUPABASE_URL: 'https://dyburkcxtdwynoybebab.supabase.co',        // ej.: 'https://abcdefghijkl.supabase.co'
  SUPABASE_CLAVE_PUBLICA: 'sb_publishable_1bQ0hzBUsth6T3asGzNPUA_BoZ2zxXz', // "Publishable key" (sb_publishable_…) o la antigua "anon". Es segura de publicar.

  // No cambiar salvo que también se cambie en el script SQL
  DOMINIO_INTERNO: 'giea-uni.local',
  PREFIJO_CLAVE: 'giea-',

  NOMBRE_GRUPO: 'GIEA',
  TITULO_APP: 'Asistencia y reserva de equipos',
  INSTITUCION: 'Universidad Nacional de Ingeniería',
  ZONA_HORARIA: 'America/Lima'
};
