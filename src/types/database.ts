// Tipos de Supabase — regenerar con:
//   npx supabase gen types typescript --project-id <id> > src/types/database.ts
// Mientras tanto, tipo permisivo (any) para no bloquear el build.
// El código ya hace casts manuales en los lugares críticos.
export type Database = any;
