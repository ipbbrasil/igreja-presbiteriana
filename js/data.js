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
    envios: [],
    igrejas: [],        // igrejas que o usuário pode ver (para o envio)
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
      .select('nome, papel, igrejas(codigo, nome, cidade, uf), presbiterios(nome, sigla, sinodos(nome, sigla)), sinodos(nome, sigla)')
      .eq('user_id', user.id).maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('Seu usuário ainda não tem um perfil de acesso. Peça ao administrador para cadastrá-lo.');
    state.usuario = { email: user.email, nome: data.nome || user.email };
    state.perfil = { papel: data.papel, igreja_codigo: data.igrejas?.codigo || null, igreja: data.igrejas || null };
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
      .select('id, ano, versao, status, arquivo, tipo_pdf, modelo, dados, extraido_em, igrejas(codigo, nome, cidade, uf, organizacao), presbiterios(nome, sigla, sinodos(nome, sigla)), alertas(nivel, campo, mensagem), historico_status(status, comentario, criado_em)')
      .eq('ano', state.ano)
      .neq('status', 'substituido');
    if (error) throw error;
    state.relatorios = data.map((r) => ({
      id: r.id, ano: r.ano, versao: r.versao, status: r.status, arquivo: r.arquivo, tipo_pdf: r.tipo_pdf, modelo: r.modelo,
      extraido_em: r.extraido_em,
      igreja: r.igrejas,
      dados: r.dados,
      alertas: (r.alertas || []).map((a) => ({ nivel: a.nivel, campo: a.campo, msg: a.mensagem })),
      historico: (r.historico_status || []).sort((a, b) => a.criado_em.localeCompare(b.criado_em)),
    }));
    const p = data[0]?.presbiterios;
    if (p) { state.presbiterio = { nome: p.nome, sigla: p.sigla }; state.sinodo = p.sinodos; }
    state.igrejas = state.perfil.igreja ? [state.perfil.igreja] : state.relatorios.map((r) => r.igreja);
    await carregarEnvios();
  }

  async function carregarEnvios() {
    const { data, error } = await sb.from('envios')
      .select('id, ano, arquivo_nome, caminho, formato, tipo_pdf, tamanho, status, verificacao, enviado_em, relatorio_id, igrejas(codigo, nome)')
      .order('enviado_em', { ascending: false });
    // Tabela ainda não criada (migração 002 não executada): segue sem envios
    state.envios = error ? [] : data;
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
    state.igrejas = rels.map((r) => r.igreja);
    state.envios = [];
  }

  // ---------- Envio de relatórios ----------
  async function envioExiste(codigo, ano, hash) {
    if (state.modo === 'local') return false;
    const { data } = await sb.from('envios').select('id, enviado_em, igrejas!inner(codigo)')
      .eq('sha256', hash).eq('ano', ano).eq('igrejas.codigo', codigo).limit(1);
    return data?.[0] || false;
  }

  async function enviarRelatorio({ codigo, ano, file, analise }) {
    if (state.modo === 'local') throw new Error('O envio de arquivos só funciona conectado ao Supabase (site publicado).');
    const caminho = `${codigo}/${ano}/${Date.now()}-${Envio.nomeSeguro(file.name)}`;
    const mime = analise.formato === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    const up = await sb.storage.from('relatorios').upload(caminho, file, { contentType: mime, upsert: false });
    if (up.error) throw new Error('Falha no upload: ' + up.error.message);
    const { data: envioId, error } = await sb.rpc('registrar_envio', {
      p_igreja: codigo, p_ano: ano, p_caminho: caminho, p_nome: file.name, p_formato: analise.formato,
      p_tipo_pdf: analise.tipo_pdf, p_tamanho: file.size, p_sha256: analise.sha256,
      p_verificacao: { checks: analise.checks, resumo: analise.resumo },
    });
    if (error) {
      await sb.storage.from('relatorios').remove([caminho]); // não deixa arquivo órfão
      throw new Error(error.message);
    }
    // Leitura feita no navegador: grava como nova versão "aguardando conferência".
    // Se falhar, o arquivo continua recebido e a administração pode usar "Ler agora".
    let lido = false;
    if (analise.leitura?.ok) {
      const r = await sb.rpc('processar_envio', { p_envio: envioId, p_dados: analise.leitura.dados, p_alertas: analise.leitura.alertas, p_modelo: analise.leitura.modelo });
      lido = !r.error;
    }
    await carregar();
    return { lido };
  }

  // Lê de novo um arquivo já enviado (PDF digital) e grava o resultado
  async function processarEnvio(envio) {
    const { data: blob, error } = await sb.storage.from('relatorios').download(envio.caminho);
    if (error) throw new Error('Não foi possível baixar o arquivo: ' + error.message);
    const leitura = await Envio.lerArquivo(await blob.arrayBuffer(), { sinodo: state.sinodo?.sigla, presbiterio: state.presbiterio?.sigla });
    if (!leitura.ok) throw new Error('Não foi possível ler os números deste documento. A conferência precisa ser manual.');
    const r = await sb.rpc('processar_envio', { p_envio: envio.id, p_dados: leitura.dados, p_alertas: leitura.alertas, p_modelo: leitura.modelo });
    if (r.error) throw new Error(r.error.message);
    await carregar();
  }

  // ---------- Digitação / correção manual ----------
  async function corrigirRelatorio(relId, dados, alteracoes, comentario) {
    if (state.modo === 'supabase') {
      const { error } = await sb.rpc('corrigir_relatorio', { p_relatorio: relId, p_dados: dados, p_alteracoes: alteracoes, p_comentario: comentario || null });
      if (error) throw new Error(error.message);
      return carregar();
    }
    const r = state.relatorios.find((x) => x.id === relId); // modo local: só na memória
    r.dados = dados; r.status = 'aguardando_conferencia';
    r.historico.push({ status: 'aguardando_conferencia', comentario: `Correção manual de ${alteracoes.length} campo(s) (modo local, não salvo)`, criado_em: new Date().toISOString() });
  }

  // Digitação a partir de um arquivo recebido que não pôde ser lido (PDF digitalizado, Excel)
  async function digitarEnvio(envio, dados) {
    const alertas = [{ nivel: 'aviso', campo: 'leitura', msg: `Dados digitados manualmente a partir do arquivo ${envio.arquivo_nome}.` }];
    const { error } = await sb.rpc('processar_envio', { p_envio: envio.id, p_dados: dados, p_alertas: alertas, p_modelo: null });
    if (error) throw new Error(error.message);
    await carregar();
  }

  // ---------- Usuários e convites ----------
  const rpc = async (nome, args) => { const { data, error } = await sb.rpc(nome, args); if (error) throw new Error(error.message); return data; };
  const criarConvite = ({ email, nome, papel, igreja }) => rpc('criar_convite', { p_email: email, p_nome: nome, p_papel: papel, p_igreja: igreja || null });
  const cancelarConvite = (id) => rpc('cancelar_convite', { p_id: id });
  const listarUsuarios = () => rpc('listar_usuarios');
  const removerAcesso = (userId) => rpc('remover_acesso', { p_user: userId });
  async function listarConvites() {
    const { data, error } = await sb.from('convites').select('id, codigo, email, nome, papel, criado_em, expira_em, igrejas(codigo, nome)')
      .is('usado_em', null).order('criado_em', { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  }
  const verConvite = async (codigo) => (await rpc('ver_convite', { p_codigo: codigo }))?.[0] || null;

  // Pessoa convidada: cria a conta (ou entra na existente) e liga o perfil do convite
  async function usarConvite({ codigo, email, senha, nome, novaConta }) {
    if (novaConta) {
      const { data, error } = await sb.auth.signUp({ email, password: senha, options: { data: { nome } } });
      if (error) throw new Error(/already registered/i.test(error.message) ? 'Este e-mail já tem conta. Use a opção "Já tenho conta".' : error.message);
      if (!data.session) throw new Error('A conta foi criada, mas o Supabase está exigindo confirmação por e-mail. Peça ao administrador para desligar "Confirm email" nas configurações de autenticação.');
    } else {
      const { error } = await sb.auth.signInWithPassword({ email, password: senha });
      if (error) throw new Error(error.message === 'Invalid login credentials' ? 'E-mail ou senha incorretos.' : error.message);
    }
    await rpc('aceitar_convite', { p_codigo: codigo, p_nome: nome || null });
    const { data } = await sb.auth.getUser();
    return carregarPerfil(data.user);
  }

  async function urlArquivo(caminho) {
    const { data, error } = await sb.storage.from('relatorios').createSignedUrl(caminho, 600);
    if (error) throw error;
    return data.signedUrl;
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
  const podeEnviar = () => ['admin_presbiterial', 'superadmin', 'representante'].includes(state.perfil?.papel);

  return {
    state, sessaoAtual, entrar, entrarLocal, sair, carregar, definirStatus, podeValidar, podeEnviar,
    envioExiste, enviarRelatorio, processarEnvio, corrigirRelatorio, digitarEnvio, urlArquivo,
    criarConvite, cancelarConvite, listarConvites, listarUsuarios, removerAcesso, verConvite, usarConvite,
  };
})();
