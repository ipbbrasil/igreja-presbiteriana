// Configuração pública do app.
// A chave "anon" do Supabase é pública por natureza: o acesso aos dados é
// protegido por login + Row Level Security (supabase/schema.sql).
// NUNCA coloque aqui a chave service_role/secret nem a senha do banco.
window.APP_CONFIG = {
  SUPABASE_URL: 'https://emrqtuvehkwngdnlhhjx.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_ciXqN2rif1E3oH61b2AlqA_8e5QrgUJ',
  ANO_PADRAO: 2025,
  // Sem Supabase configurado, o app roda em "modo local" lendo
  // dados/relatorios-2025.json (pasta ignorada pelo git, só existe no seu PC).
  ARQUIVO_LOCAL: 'dados/relatorios-2025.json',
};
