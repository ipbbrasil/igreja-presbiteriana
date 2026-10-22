// Camada de dados: Supabase (produção) ou arquivo local (desenvolvimento).
// Os dois modos entregam o mesmo formato normalizado de relatório.
window.Data = (() => {
  const cfg = window.APP_CONFIG;
  // ?local=1 em localhost força o modo local (testes com o arquivo do PC)
  const forcarLocal = location.hostname === 'localhost' && new URLSearchParams(location.search).has('local');
  const usaSupabase = !forcarLocal && !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && window.supabase);
  const sb = usaSupabase ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;

  const state = {
    modo: usaSupabase ? 'supabase' : 'local',
    usuario: null,      // { email, nome }
    perfil: null,       // { papel, igreja_codigo? }
    sinodo: null,       // { nome, sigla }
    presbiterio: null,  // { nome, sigla }
    ano: cfg.ANO_PADRAO,
    relatorios: [],
  };

  const chaveLocal = 'painel.perfilLocal';
  const lerLocal = () => { try { return JSON.parse(sessionStorage.getItem(chaveLocal)); } catch { return null; } };
  const gravarLocal = (v) => { try { v ? sessionStorage.setItem(chaveLocal, JSON.stringify(v)) : sessionStorage.removeItem(chaveLocal); } catch { /* sem storage */ } };

  // ---------- Sessão ----------
  async function sessaoAtual() {
    if (state.modo === 'local') {
      const papelUrl = new URLSearchParams(location.search).get('perfil');
      if (papelUrl) entrarLocal(papelUrl);
      const p = lerLocal();
      if (!p) return false;
      state.usuario = { email: 'modo-local', nome: 'Usuário local' };
      state.perfil = p;
      return true;
    }
    const { data } = await sb.auth.getSession();
    if (!data.session) return false;
    return carregarPerfil(data.session.user);
  }

  async function carregarPerfil(user) {
    const { data, error } = await sb.from('perfis')
      .select('nome, papel, igrejas(codigo), presbiterios(nome, sigla, sinodos(nome, sigla)), sinodos(nome, sigla)')
      .eq('user_id', user.id).maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('Seu usuário ainda não tem um perfil de acesso. Peça ao administrador para cadastrá-lo.');
    state.usuario = { email: user.email, nome: data.nome || user.email };
    state.perfil = { papel: data.papel, igreja_codigo: data.igrejas?.codigo || null };
    return true;
  }

  async function entrar(email, senha) {
    const { data, error } = await sb.auth.signInWithPassword({ email, password: senha });
    if (error) throw new Error(error.message === 'Invalid login credentials' ? 'E-mail ou senha incorretos.' : error.message);
    return carregarPerfil(data.user);
  }

  function entrarLocal(papel) {
    const perfil = { papel, igreja_codigo: papel === 'representante' ? '1IPC' : null };
    gravarLocal(perfil);
    state.usuario = { email: 'modo-local', nome: 'Usuário local' };
    state.perfil = perfil;
  }

  async function sair() {
    if (state.modo === 'supabase') await sb.auth.signOut();
    gravarLocal(null);
    state.usuario = state.perfil = null;
    state.relatorios = [];
  }

  // ---------- Carga ----------
  async function carregar() {
    if (state.modo === 'local') return carregarLocal();
    const { data, error } = await sb.from('relatorios')
      .select('id, ano, status, arquivo, tipo_pdf, modelo, dados, extraido_em, igrejas(codigo, nome, cidade, uf, organizacao), presbiterios(nome, sigla, sinodos(nome, sigla)), alertas(nivel, campo, mensagem), historico_status(status, comentario, criado_em)')
      .eq('ano', state.ano)
      .neq('status', 'substituido');
    if (error) throw error;
    state.relatorios = data.map((r) => ({
      id: r.id, ano: r.ano, status: r.status, arquivo: r.arquivo, tipo_pdf: r.tipo_pdf, modelo: r.modelo,
      extraido_em: r.extraido_em,
      igreja: r.igrejas,
      dados: r.dados,
      alertas: (r.alertas || []).map((a) => ({ nivel: a.nivel, campo: a.campo, msg: a.mensagem })),
      historico: (r.historico_status || []).sort((a, b) => a.criado_em.localeCompare(b.criado_em)),
    }));
    const p = data[0]?.presbiterios;
    if (p) { state.presbiterio = { nome: p.nome, sigla: p.sigla }; state.sinodo = p.sinodos; }
  }

  async function carregarLocal() {
    const resp = await fetch(cfg.ARQUIVO_LOCAL, { cache: 'no-store' });
    if (!resp.ok) throw new Error('Arquivo de dados local não encontrado (' + cfg.ARQUIVO_LOCAL + ').');
    const j = await resp.json();
    state.sinodo = j._sobre.sinodo;
    state.presbiterio = j._sobre.presbiterio;
    state.ano = j._sobre.exercicio;
    let rels = j.igrejas.map((ig) => {
      const { id, nome, cidade, uf, organizacao, arquivo, tipo_pdf, modelo, alertas, ...dados } = ig;
      const temErro = (alertas || []).some((a) => a.nivel === 'erro');
      return {
        id, ano: state.ano, status: temErro ? 'aguardando_correcao' : 'validado', arquivo, tipo_pdf, modelo,
        extraido_em: null,
        igreja: { codigo: id, nome, cidade, uf, organizacao },
        dados, alertas: alertas || [],
        historico: [{ status: 'aguardando_conferencia', comentario: 'Relatório importado do PDF', criado_em: new Date().toISOString() }],
      };
    });
    if (state.perfil?.papel === 'representante') rels = rels.filter((r) => r.igreja.codigo === state.perfil.igreja_codigo);
    state.relatorios = rels;
  }

  // ---------- Ações ----------
  async function definirStatus(relId, status, comentario) {
    if (state.modo === 'supabase') {
      const { error } = await sb.rpc('definir_status', { p_relatorio: relId, p_status: status, p_comentario: comentario || null });
      if (error) throw error;
    }
    const r = state.relatorios.find((x) => x.id === relId);
    if (r) {
      r.status = status;
      r.historico.push({ status, comentario: comentario || null, criado_em: new Date().toISOString() });
    }
  }

  const podeValidar = () => ['admin_presbiterial', 'superadmin'].includes(state.perfil?.papel);

  return { state, sessaoAtual, entrar, entrarLocal, sair, carregar, definirStatus, podeValidar };
})();
