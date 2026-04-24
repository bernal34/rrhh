// Tipos de Supabase — regenerar con:
//   npx supabase gen types typescript --project-id <id> > src/types/database.ts
// Por ahora dejamos un stub para que compile.

export type Database = {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};
