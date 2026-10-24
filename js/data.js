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
    exercicio: { situacao: 'aberto' },  // situação do exercício (aberto / fechado)
    eventosExercicio: [],               // fechamentos e reaberturas
    cadastradas: [],    // igrejas vinculadas ao presbitério (inclui as que não enviaram)
    anos: [],           // exercícios disponíveis para escolha
    historico: [],      // resumo de todos os anos: { ano, status, codigo, rol, com, nc, ed, rec, rol_ant, com_ant, nc_ant, ed_ant }
  };
  const lerPref = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const gravarPref = (k, v) => { try { localStorage.setItem(k, String(v)); } catch (e) { /* sem storage */ } };

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
      .select('nome, papel, presbiterio_id, igrejas(codigo, nome, cidade, uf), presbiterios(nome, sigla, sinodos(nome, sigla)), sinodos(nome, sigla)')
      .eq('user_id', user.id).maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('Seu usuário ainda não tem um perfil de acesso. Peça ao administrador para cadastrá-lo.');
    state.usuario = { email: user.email, nome: data.nome || user.email };
    state.perfil = { papel: data.papel, igreja_codigo: data.igrejas?.codigo || null, igreja: data.igrejas || null, presbiterio_id: data.presbiterio_id || null };
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
    state.relatorios = []; state.anos = []; state.historico = [];
  }

  // ---------- Carga ----------
  // ---------- Exercícios (anos) ----------
  // Anos com relatório + ano padrão + ano anterior ao atual (os relatórios são sempre do ano que passou)
  // Os anos disponíveis saem do histórico (que já traz o ano de cada relatório): sem consulta extra
  function definirAnos() {
    const comDados = [...new Set(state.historico.map((r) => r.ano))];
    state.anos = [...new Set([...comDados, cfg.ANO_PADRAO, new Date().getFullYear() - 1])].sort((a, b) => b - a);
    const salvo = +lerPref('painel.ano');
    state.ano = state.anos.includes(salvo) ? salvo : (comDados.length ? Math.max(...comDados) : cfg.ANO_PADRAO);
  }
  function trocarAno(ano) { state.ano = ano; gravarPref('painel.ano', ano); }

  // Resumo de todos os anos para os gráficos de evolução (só os campos usados)
  async function carregarHistorico() {
    const { data, error } = await sb.from('relatorios').select('ano, status, igrejas(codigo), rol:dados->rol_atual, com:dados->comungantes->ano_atual, com_ant:dados->comungantes->ano_anterior, nc:dados->nao_comungantes->ano_atual, nc_ant:dados->nao_comungantes->ano_anterior, ed:dados->estrutura->alunos_ed_atual, ed_ant:dados->estrutura->alunos_ed_anterior, rec:dados->financeiro->realizado->total_receita')
      .neq('status', 'substituido');
    state.historico = error ? [] : data.map((r) => resumoHistorico(r.ano, r.status, r.igrejas?.codigo, r));
  }
  function resumoHistorico(ano, status, codigo, x) {
    const T = Regras.T, num = (v) => (typeof v === 'number' ? v : null);
    const com_ant = T(x.com_ant), nc_ant = T(x.nc_ant);
    return { ano, status, codigo, rol: T(x.rol), com: T(x.com), nc: T(x.nc), ed: num(x.ed), rec: num(x.rec),
      com_ant, nc_ant, rol_ant: com_ant != null && nc_ant != null ? com_ant + nc_ant : null, ed_ant: num(x.ed_ant) };
  }

  // Partes do relatório usadas nas telas. A origem de cada valor ("_origem", ~4x maior que os números)
  // fica de fora e só é buscada quando alguém toca num número (carregarOrigem).
  const PARTES_DADOS = ['lideranca', 'estrutura', 'departamentos', 'comungantes', 'nao_comungantes', 'rol_atual', 'financeiro', 'conselho', 'congregacao_anexo', 'identificacao'];
  const SELECT_RELATORIOS = 'id, ano, versao, status, arquivo, tipo_pdf, modelo, extraido_em, '
    + PARTES_DADOS.map((c) => `d_${c}:dados->${c}`).join(', ')
    + ', igrejas(codigo, nome, cidade, uf, organizacao), presbiterios(nome, sigla, sinodos(nome, sigla)), alertas(nivel, campo, mensagem), historico_status(status, comentario, criado_em)';

  async function carregar() {
    if (state.modo === 'local') return carregarLocal();
    cacheNacional.clear(); // os totais do sínodo/nacional podem ter mudado
    // Primeira vez: o histórico (leve) diz quais anos existem; depois disso ele vem junto com o resto
    const primeira = !state.anos.length;
    if (primeira) { await carregarHistorico(); definirAnos(); }
    // Tudo do exercício ao mesmo tempo (antes eram várias consultas, uma depois da outra)
    const [rel, exerc] = await Promise.all([
      sb.from('relatorios').select(SELECT_RELATORIOS).eq('ano', state.ano).neq('status', 'substituido'),
      buscarExercicio(),
      carregarEnvios(),
      primeira ? null : carregarHistorico(),
    ]);
    if (rel.error) throw rel.error;
    state.relatorios = rel.data.map((r) => ({
      id: r.id, ano: r.ano, versao: r.versao, status: r.status, arquivo: r.arquivo, tipo_pdf: r.tipo_pdf, modelo: r.modelo,
      extraido_em: r.extraido_em,
      igreja: r.igrejas,
      dados: Object.fromEntries(PARTES_DADOS.map((c) => [c, r[`d_${c}`] ?? null])),
      alertas: (r.alertas || []).map((a) => ({ nivel: a.nivel, campo: a.campo, msg: a.mensagem })),
      historico: (r.historico_status || []).sort((a, b) => a.criado_em.localeCompare(b.criado_em)),
    }));
    const p = rel.data[0]?.presbiterios;
    if (p) { state.presbiterio = { nome: p.nome, sigla: p.sigla }; state.sinodo = p.sinodos; }
    state.igrejas = state.perfil.igreja ? [state.perfil.igreja] : state.relatorios.map((r) => r.igreja);
    aplicarExercicio(exerc);
  }

  // Origem de cada valor (rastreabilidade), buscada só quando necessária e guardada no relatório
  async function carregarOrigem(r) {
    if (state.modo === 'local' || r.dados._origem !== undefined) return;
    const { data } = await sb.from('relatorios').select('o:dados->_origem').eq('id', r.id).maybeSingle();
    r.dados._origem = data?.o || null;
  }

  // Situação do exercício e igrejas vinculadas ao presbitério (para "Não enviado") — três consultas em paralelo
  async function buscarExercicio() {
    const presb = state.perfil?.presbiterio_id;
    if (!presb) return null;
    const [ex, ev, vi] = await Promise.all([
      sb.from('exercicios').select('situacao, fechado_em, comentario').eq('presbiterio_id', presb).eq('ano', state.ano).maybeSingle(),
      sb.from('exercicio_eventos').select('acao, comentario, criado_em').eq('presbiterio_id', presb).eq('ano', state.ano).order('criado_em'),
      state.perfil.papel === 'representante' ? null
        : sb.from('vinculos_igreja').select('inicio, igrejas(id, codigo, nome, tipo, igreja_mae_id, cidade, uf, organizacao, situacao)').eq('presbiterio_id', presb).is('fim', null),
    ]);
    return { ex, ev, vi };
  }
  function aplicarExercicio(r) {
    state.exercicio = { situacao: 'aberto' }; state.eventosExercicio = []; state.cadastradas = [];
    if (!r) return;
    if (!r.ex.error && r.ex.data) state.exercicio = r.ex.data;
    if (!r.ev.error) state.eventosExercicio = r.ev.data; // tabela só existe depois do 006_exercicio.sql
    if (r.vi && !r.vi.error) state.cadastradas = r.vi.data.filter((v) => v.igrejas).map((v) => ({ ...v.igrejas, vinculo_inicio: v.inicio }));
    const comRelatorio = new Set(state.relatorios.map((x) => x.igreja.codigo));
    for (const i of enviamRelatorio()) if (!state.igrejas.some((x) => x.codigo === i.codigo) && !comRelatorio.has(i.codigo)) state.igrejas.push(i);
  }
  // Recarrega só o exercício (depois de fechar ou reabrir)
  async function carregarExercicio() { aplicarExercicio(await buscarExercicio()); }

  // Quem envia relatório próprio: igrejas ativas e congregações presbiteriais (sem igreja-mãe).
  // Congregações de uma igreja entram no relatório da igreja-mãe (anexo "Congregação").
  const enviamRelatorio = () => state.cadastradas.filter((i) => i.situacao !== 'inativa' && (i.tipo !== 'congregacao' || !i.igreja_mae_id));
  const exercicioFechado = () => state.exercicio?.situacao === 'fechado';
  const naoEnviadas = () => {
    const comRelatorio = new Set(state.relatorios.map((r) => r.igreja.codigo));
    return enviamRelatorio().filter((i) => !comRelatorio.has(i.codigo));
  };

  // ---------- Visão nacional (totais agregados por presbitério e UF) ----------
  // Guardado na memória da sessão: voltar ao sínodo/nacional é instantâneo (limpo a cada recarga dos dados)
  const cacheNacional = new Map();
  function emCache(chave, buscar) {
    if (!cacheNacional.has(chave)) cacheNacional.set(chave, buscar().catch((e) => { cacheNacional.delete(chave); throw e; }));
    return cacheNacional.get(chave);
  }
  function painelNacional() {
    if (state.modo === 'local') return Promise.resolve(nacionalLocal());
    return emCache(`painel-${state.ano}`, async () => {
      const [p, e] = await Promise.all([sb.rpc('painel_nacional', { p_ano: state.ano }), sb.rpc('estrutura_nacional')]);
      if (p.error) throw new Error(p.error.message.includes('painel_nacional') ? 'A visão nacional ainda não foi ativada no banco (rode o 009_nacional.sql).' : p.error.message);
      return { linhas: p.data, estrutura: e.error ? [] : e.data };
    });
  }
  // Evolução por exercício e presbitério (totais de relatórios validados)
  async function evolucaoNacional() {
    if (state.modo === 'local') {
      const porAno = {};
      for (const h of state.historico.filter((x) => x.status === 'validado')) {
        const l = porAno[h.ano] || (porAno[h.ano] = { ano: h.ano, sinodo_sigla: state.sinodo?.sigla, presbiterio_sigla: state.presbiterio?.sigla });
        for (const c of ['rol', 'rol_ant', 'com', 'com_ant', 'ed', 'ed_ant', 'rec']) {
          if (h[c] != null) { l[c] = (l[c] || 0) + h[c]; l['n_' + c] = (l['n_' + c] || 0) + 1; }
        }
      }
      return Object.values(porAno);
    }
    return emCache('evolucao', async () => {
      const { data, error } = await sb.rpc('evolucao_nacional');
      if (error) throw new Error(error.message.includes('evolucao_nacional') ? 'A evolução histórica nacional ainda não foi ativada no banco (rode o 013_evolucao_nacional.sql).' : error.message);
      return data;
    });
  }

  // Modo local: mesma estrutura, calculada a partir do arquivo do presbitério
  function nacionalLocal() {
    const s = state.sinodo || {}, p = state.presbiterio || {};
    const porUf = {};
    const unidades = [...state.relatorios.map((r) => ({ uf: r.igreja.uf, r })), ...naoEnviadas().map((i) => ({ uf: i.uf, r: null }))];
    for (const { uf, r } of unidades) {
      const k = uf || '—';
      const l = porUf[k] || (porUf[k] = { sinodo_sigla: s.sigla, sinodo_nome: s.nome, presbiterio_sigla: p.sigla, presbiterio_nome: p.nome, uf: k, igrejas: 0, recebidos: 0, validados: 0,
        rol: null, n_rol: 0, comungantes: null, n_comungantes: 0, nao_comungantes: null, n_nao_comungantes: 0, alunos_ed: null, n_alunos_ed: 0, admissoes: null, demissoes: null, n_movimento: 0, receita: null, n_receita: 0 });
      l.igrejas++;
      if (!r) continue;
      l.recebidos++;
      if (r.status !== 'validado') continue;
      l.validados++;
      const add = (campo, n, v) => { if (v != null) { l[campo] = (l[campo] || 0) + v; l[n]++; } };
      const d = r.dados;
      add('rol', 'n_rol', Regras.T(d.rol_atual)); add('comungantes', 'n_comungantes', Regras.T(d.comungantes?.ano_atual));
      add('nao_comungantes', 'n_nao_comungantes', Regras.T(d.nao_comungantes?.ano_atual)); add('alunos_ed', 'n_alunos_ed', d.estrutura?.alunos_ed_atual);
      add('receita', 'n_receita', d.financeiro?.realizado?.total_receita);
      const a = Regras.somaBloco(d.comungantes?.admissao), m = Regras.somaBloco(d.comungantes?.demissao);
      if (a != null) { l.admissoes = (l.admissoes || 0) + a; l.demissoes = (l.demissoes || 0) + (m || 0); l.n_movimento++; }
    }
    return { linhas: Object.values(porUf), estrutura: [{ sinodo_sigla: s.sigla, sinodo_nome: s.nome, presbiterio_sigla: p.sigla, presbiterio_nome: p.nome }] };
  }

  // ---------- Estrutura conciliar: sínodos e presbitérios (superadministrador) ----------
  async function listarEstrutura() {
    const [s, p, vi, vp, au] = await Promise.all([
      sb.from('sinodos').select('id, nome, sigla, situacao').order('nome'),
      sb.from('presbiterios').select('id, nome, sigla, situacao, sinodo_id').order('nome'),
      sb.from('vinculos_igreja').select('presbiterio_id').is('fim', null),
      sb.from('vinculos_presbiterio').select('presbiterio_id, inicio, fim, sinodos(sigla)').order('inicio'),
      sb.from('auditoria').select('acao, alvo, detalhe, criado_em').eq('acao', 'estrutura').order('criado_em', { ascending: false }).limit(40),
    ]);
    if (s.error || p.error) throw new Error((s.error || p.error).message);
    const igrejas = {};
    for (const v of vi.data || []) igrejas[v.presbiterio_id] = (igrejas[v.presbiterio_id] || 0) + 1;
    return { sinodos: s.data, presbiterios: p.data, igrejas, vinculos: vp.error ? [] : vp.data, auditoria: au.error ? [] : au.data };
  }
  const salvarSinodo = (x, novo) => rpc('salvar_sinodo', { p_novo: novo, p_sigla: x.sigla, p_nome: x.nome, p_situacao: x.situacao });
  const salvarPresbiterio = (x, novo) => rpc('salvar_presbiterio', { p_novo: novo, p_sigla: x.sigla, p_nome: x.nome, p_sinodo: x.sinodo || null, p_situacao: x.situacao });
  const moverPresbiterio = (x) => rpc('mover_presbiterio', { p_sigla: x.sigla, p_sinodo: x.sinodo, p_data: x.data, p_motivo: x.motivo });
  const convidarAdmin = (x) => rpc('criar_convite_admin', { p_email: x.email, p_nome: x.nome || null, p_presbiterio: x.presbiterio });

  // ---------- Cadastro institucional ----------
  async function listarPresbiterios() {
    const { data, error } = await sb.from('presbiterios').select('id, nome, sigla, sinodos(sigla)').order('nome');
    if (error) throw new Error(error.message);
    return data;
  }
  async function listarAuditoria(limite = 60, acoes = null) {
    let q = sb.from('auditoria').select('acao, alvo, detalhe, usuario_id, criado_em').eq('presbiterio_id', state.perfil.presbiterio_id).order('criado_em', { ascending: false }).limit(limite);
    if (acoes) q = q.in('acao', acoes);
    const { data, error } = await q;
    return error ? [] : data; // tabela só existe depois do 007_cadastro.sql
  }

  // ---------- Cópia de segurança ----------
  // Tudo o que o presbitério tem no banco (todas as versões e anos), num único objeto
  async function coletarBackup() {
    const presb = state.perfil.presbiterio_id;
    const pegar = async (nome, q) => { const { data, error } = await q; if (error) throw new Error(`${nome}: ${error.message}`); return data; };
    const opcional = async (q) => { const { data, error } = await q; return error ? [] : data; };
    const vinculos = await pegar('vínculos', sb.from('vinculos_igreja').select('*').eq('presbiterio_id', presb));
    const idsIgrejas = [...new Set(vinculos.map((v) => v.igreja_id))];
    const dados = {
      sinodos: await pegar('sínodos', sb.from('sinodos').select('*')),
      presbiterios: await pegar('presbitérios', sb.from('presbiterios').select('*').eq('id', presb)),
      igrejas: await pegar('igrejas', sb.from('igrejas').select('*').in('id', idsIgrejas)),
      vinculos_igreja: vinculos,
      exercicios: await pegar('exercícios', sb.from('exercicios').select('*').eq('presbiterio_id', presb)),
      exercicio_eventos: await opcional(sb.from('exercicio_eventos').select('*').eq('presbiterio_id', presb)),
      relatorios: await pegar('relatórios', sb.from('relatorios').select('*').eq('presbiterio_id', presb).order('ano').order('versao')),
      alertas: await pegar('alertas', sb.from('alertas').select('*, relatorios!inner(presbiterio_id)').eq('relatorios.presbiterio_id', presb)),
      historico_status: await pegar('histórico', sb.from('historico_status').select('*, relatorios!inner(presbiterio_id)').eq('relatorios.presbiterio_id', presb)),
      correcoes: await opcional(sb.from('correcoes').select('*, relatorios!inner(presbiterio_id)').eq('relatorios.presbiterio_id', presb)),
      envios: await opcional(sb.from('envios').select('*').eq('presbiterio_id', presb)),
      usuarios: await opcional(sb.rpc('listar_usuarios')),
      convites_pendentes: await opcional(sb.from('convites').select('email, nome, papel, igreja_id, criado_em, expira_em').is('usado_em', null)),
      auditoria: await opcional(sb.from('auditoria').select('*').eq('presbiterio_id', presb).order('criado_em')),
    };
    for (const t of ['alertas', 'historico_status', 'correcoes']) dados[t] = dados[t].map(({ relatorios, ...resto }) => resto);
    return dados;
  }
  const baixarArquivo = async (caminho) => { const { data, error } = await sb.storage.from('relatorios').download(caminho); if (error) throw new Error(error.message); return data; };
  const registrarBackup = async (detalhe) => { await sb.rpc('registrar_backup', { p_detalhe: detalhe }); }; // não impede o backup se falhar
  async function salvarIgreja(i, novo) {
    const { error } = await sb.rpc('salvar_igreja', { p_novo: novo, p_codigo: i.codigo, p_nome: i.nome, p_tipo: i.tipo, p_cidade: i.cidade || null,
      p_uf: i.uf || null, p_organizacao: i.organizacao || null, p_igreja_mae: i.igreja_mae || null, p_situacao: i.situacao });
    if (error) throw new Error(error.message);
    await carregar();
  }
  async function transferirIgreja({ codigo, destino, data, motivo }) {
    const { error } = await sb.rpc('transferir_igreja', { p_codigo: codigo, p_destino: destino, p_data: data, p_motivo: motivo });
    if (error) throw new Error(error.message);
    await carregar();
  }

  async function fecharExercicio(comentario) {
    if (state.modo === 'local') { state.exercicio = { situacao: 'fechado', fechado_em: new Date().toISOString(), comentario }; state.eventosExercicio.push({ acao: 'fechado', comentario, criado_em: new Date().toISOString() }); return; }
    const { error } = await sb.rpc('fechar_exercicio', { p_ano: state.ano, p_comentario: comentario || null });
    if (error) throw new Error(error.message);
    await carregarExercicio();
  }
  async function reabrirExercicio(motivo) {
    if (state.modo === 'local') { state.exercicio = { situacao: 'aberto' }; state.eventosExercicio.push({ acao: 'reaberto', comentario: motivo, criado_em: new Date().toISOString() }); return; }
    const { error } = await sb.rpc('reabrir_exercicio', { p_ano: state.ano, p_motivo: motivo });
    if (error) throw new Error(error.message);
    await carregarExercicio();
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
    state.exercicio = state.exercicio || { situacao: 'aberto' };
    state.eventosExercicio = state.eventosExercicio || [];
    state.cadastradas = state.perfil?.papel === 'representante' ? [] : rels.map((r) => r.igreja);
    state.anos = [state.ano];
    state.historico = rels.map((r) => {
      const d = r.dados;
      return resumoHistorico(r.ano, r.status, r.igreja.codigo, { rol: d.rol_atual, com: d.comungantes?.ano_atual, com_ant: d.comungantes?.ano_anterior,
        nc: d.nao_comungantes?.ano_atual, nc_ant: d.nao_comungantes?.ano_anterior, ed: d.estrutura?.alunos_ed_atual, ed_ant: d.estrutura?.alunos_ed_anterior,
        rec: d.financeiro?.realizado?.total_receita });
    });
  }

  // ---------- Envio de relatórios ----------
  async function envioExiste(codigo, ano, hash) {
    if (state.modo === 'local') return false;
    const { data } = await sb.from('envios').select('id, enviado_em, igrejas!inner(codigo)')
      .eq('sha256', hash).eq('ano', ano).eq('igrejas.codigo', codigo).limit(1);
    return data?.[0] || false;
  }

  // Versão em vigor (não substituída) da igreja no exercício, para avisar antes de substituí-la
  async function relatorioAtual(codigo, ano) {
    if (ano === state.ano) {
      const r = state.relatorios.find((x) => x.igreja?.codigo === codigo);
      return r ? { versao: r.versao || 1, status: r.status } : null;
    }
    if (state.modo === 'local') return null;
    const { data } = await sb.from('relatorios').select('versao, status, igrejas!inner(codigo)')
      .eq('ano', ano).eq('igrejas.codigo', codigo).neq('status', 'substituido').order('versao', { ascending: false }).limit(1);
    return data?.[0] ? { versao: data[0].versao, status: data[0].status } : null;
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
      // A origem não vem na carga normal: garante que ela continue gravada junto dos dados corrigidos
      const atual = state.relatorios.find((x) => x.id === relId);
      if (atual) { await carregarOrigem(atual); if (atual.dados._origem && dados._origem === undefined) dados._origem = atual.dados._origem; }
      const { error } = await sb.rpc('corrigir_relatorio', { p_relatorio: relId, p_dados: dados, p_alteracoes: alteracoes, p_comentario: comentario || null });
      if (error) throw new Error(error.message);
      return carregar();
    }
    const r = state.relatorios.find((x) => x.id === relId); // modo local: só na memória
    r.dados = dados; r.status = 'aguardando_conferencia';
    r.historico.push({ status: 'aguardando_conferencia', comentario: `Correção manual de ${alteracoes.length} campo(s) (modo local, não salvo)`, criado_em: new Date().toISOString() });
  }

  // Correções manuais de um relatório (para a rastreabilidade de cada valor)
  async function listarCorrecoes(relId) {
    if (state.modo === 'local') return [];
    const { data, error } = await sb.from('correcoes').select('criado_em, comentario, alteracoes').eq('relatorio_id', relId).order('criado_em');
    if (error) throw new Error(error.message);
    return data;
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
  const listarAcessosSuperiores = () => rpc('listar_acessos_superiores');
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
    envioExiste, relatorioAtual, enviarRelatorio, processarEnvio, corrigirRelatorio, digitarEnvio, listarCorrecoes, urlArquivo,
    trocarAno, exercicioFechado, naoEnviadas, enviamRelatorio, fecharExercicio, reabrirExercicio,
    painelNacional, evolucaoNacional, carregarOrigem, listarEstrutura, salvarSinodo, salvarPresbiterio, moverPresbiterio, convidarAdmin, listarPresbiterios, listarAuditoria, salvarIgreja, transferirIgreja, coletarBackup, baixarArquivo, registrarBackup,
    criarConvite, cancelarConvite, listarConvites, listarUsuarios, listarAcessosSuperiores, removerAcesso, verConvite, usarConvite,
  };
})();
