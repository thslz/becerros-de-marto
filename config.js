// Ranking en Supabase. La anon key (o publishable key) es pública por diseño:
// viaja al navegador igual, y lo que protege la tabla son las políticas RLS de schema.sql
window.BECERROS_CONFIG = {
  supabaseUrl: 'https://xqydlmxhkhmghdplhsvq.supabase.co',
  supabaseAnonKey: '',
  table: 'becerros_scores',
};
