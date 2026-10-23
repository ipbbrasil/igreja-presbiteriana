// Regras determinísticas: formatação, status, verificações e consolidação.
// Princípio: campo vazio (null) é "não informado" — nunca vira zero.
window.Regras = (() => {
  const T = (a) => (Array.isArray(a) ? a[2] : null);
  const temValor = (v) => v !== null && v !== undefined && !Number.isNaN(v);
  const cent = (v) => Math.round(v * 100) / 100;

  // ---------- Formatação ----------
  const fmt = {
    int: (n) => (temValor(n) ? Math.round(n).toLocaleString('pt-BR') : '—'),
    brl: (n) => (temValor(n) ? n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }) : '—'),
    brlCurto: (n) => {
      if (!temValor(n)) return '—';
      const a = Math.abs(n);
      if (a >= 1e6) return 'R$ ' + (n / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + ' mi';
      if (a >= 1e3) return 'R$ ' + (n / 1e3).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mil';
      return 'R$ ' + n.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
    },
    pct: (n, casas = 1) => (temValor(n) ? (n * 100).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas }) + '%' : '—'),
    sinal: (n) => (temValor(n) ? (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(Math.round(n)).toLocaleString('pt-BR') : '—'),
    data: (iso) => (iso ? new Date(iso + (iso.length === 10 ? 'T12:00:00' : '')).toLocaleDateString('pt-BR') : '—'),
    dataHora: (iso) => (iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—'),
  };

  // ---------- Situações do relatório ----------
  const STATUS = {
    nao_enviado: { label: 'Não enviado', cls: 'neutral', icon: '○' },
    recebido: { label: 'Recebido', cls: 'neutral', icon: '↓' },
    em_processamento: { label: 'Em processamento', cls: 'neutral', icon: '⋯' },
    aguardando_conferencia: { label: 'Aguardando conferência', cls: 'warning', icon: '◔' },
    aguardando_correcao: { label: 'Aguardando correção', cls: 'critical', icon: '!' },
    validado: { label: 'Validado', cls: 'good', icon: '✓' },
    substituido: { label: 'Substituído', cls: 'neutral', icon: '↺' },
  };
  const ORDEM_STATUS = ['aguardando_correcao', 'aguardando_conferencia', 'em_processamento', 'recebido', 'validado', 'substituido', 'nao_enviado'];

  const PAPEIS = {
    superadmin: 'Superadministrador',
    admin_nacional: 'Administrador nacional',
    admin_sinodal: 'Administrador sinodal',
    admin_presbiterial: 'Administrador presbiterial',
    representante: 'Representante da igreja',
  };

  // ---------- Rótulos dos campos ----------
  const ROTULOS = {
    profissao_fe: 'Profissão de fé',
    profissao_fe_batismo: 'Profissão de fé e batismo',
    transferencia: 'Transferência',
    jurisdicao: 'Jurisdição',
    jurisdicao_ex_officio: 'Jurisdição ex-officio',
    restauracao: 'Restauração',
    readmissao_rol: 'Readmissão ao rol',
    designacao_presbiterio: 'Designação do Presbitério',
    falecimento: 'Falecimento',
    exclusao: 'Exclusão',
    exclusao_a_pedido: '↳ a pedido',
    exclusao_por_ausencia: '↳ por ausência',
    ordenacao: 'Ordenação',
    batismo: 'Batismo',
  };
  // Linhas que detalham outra (não entram na soma para não duplicar)
  const DETALHE = new Set(['exclusao_a_pedido', 'exclusao_por_ausencia']);

  const RECEITAS = [
    ['dizimos', 'Dízimos'], ['ofertas', 'Ofertas'], ['ofertas_missionarias', 'Ofertas missionárias'],
    ['ofertas_especificas', 'Ofertas específicas'], ['receitas_financeiras', 'Receitas financeiras'],
    ['emprestimos_receita', 'Empréstimos IPB / JPEF'], ['parcerias', 'Parcerias'], ['outras_receitas', 'Outras receitas'],
  ];
  const DESPESAS = [
    ['patrimonio', 'Patrimônio'], ['causas_locais', 'Causas locais'], ['evangelismo_local', 'Evangelismo local'],
    ['missoes', 'Missões'], ['acao_social', 'Ação social'], ['sustento_pastoral', 'Sustento pastoral'],
    ['verba_presbiterial', 'Verba presbiterial'], ['dizimo_supremo_concilio', 'Dízimo ao Supremo Concílio'],
    ['emprestimos_despesa', 'Empréstimos IPB / JPEF'], ['outras_despesas', 'Outras despesas'],
  ];
  // Composição de despesas: 6 categorias nomeadas + "Demais" (paleta categórica não passa de 8)
  const COMPOSICAO_DESPESA = [
    ['sustento_pastoral', 'Sustento pastoral'], ['causas_locais', 'Causas locais'], ['patrimonio', 'Patrimônio'],
    ['dizimo_supremo_concilio', 'Dízimo ao SC'], ['verba_presbiterial', 'Verba presbiterial'], ['missoes', 'Missões'],
  ];
  const DEPARTAMENTOS = [['ucp', 'UCP'], ['upa', 'UPA'], ['ump', 'UMP'], ['saf', 'SAF'], ['uph', 'UPH'], ['outras', 'Outras']];
  const LIDERANCA = [
    ['pastores', 'Pastores'], ['licenciados', 'Licenciados'], ['presbiteros', 'Presbíteros'], ['diaconos', 'Diáconos'],
    ['evangelistas', 'Evangelistas'], ['missionarios', 'Missionários'], ['candidatos', 'Candidatos'],
  ];

  // Soma de um bloco de movimentação [m,f,t]; null se nada informado
  function somaBloco(bloco, idx = 2) {
    let s = 0, algum = false;
    for (const [k, v] of Object.entries(bloco || {})) {
      if (DETALHE.has(k) || !Array.isArray(v) || !temValor(v[idx])) continue;
      s += v[idx]; algum = true;
    }
    return algum ? s : null;
  }
  function somaCampos(obj, chaves) {
    let s = 0, algum = false;
    for (const [k] of chaves) if (temValor(obj?.[k])) { s += obj[k]; algum = true; }
    return algum ? cent(s) : null;
  }

  // ---------- Verificações automáticas (recalculam o que o relatório informa) ----------
  function verificacoes(d) {
    const out = [];
    const chk = (grupo, titulo, esperado, informado, moeda = false) => {
      if (!temValor(esperado) || !temValor(informado)) {
        out.push({ grupo, titulo, ok: null, esperado, informado, moeda });
      } else {
        out.push({ grupo, titulo, ok: Math.abs(cent(esperado) - cent(informado)) < 0.015, esperado: cent(esperado), informado, moeda });
      }
    };
    const c = d.comungantes || {}, nc = d.nao_comungantes || {};
    const admC = somaBloco(c.admissao), demC = somaBloco(c.demissao);
    chk('Membresia', 'Comungantes: admissões − demissões = diferença', admC != null && demC != null ? admC - demC : null, T(c.diferenca));
    chk('Membresia', 'Comungantes: ano anterior + diferença = ano atual', temValor(T(c.ano_anterior)) && temValor(T(c.diferenca)) ? T(c.ano_anterior) + T(c.diferenca) : null, T(c.ano_atual));
    const admN = somaBloco(nc.admissao), demN = somaBloco(nc.demissao);
    chk('Membresia', 'Não comungantes: admissões − demissões = diferença', admN != null && demN != null ? admN - demN : null, T(nc.diferenca));
    chk('Membresia', 'Não comungantes: ano anterior + diferença = ano atual', temValor(T(nc.ano_anterior)) && temValor(T(nc.diferenca)) ? T(nc.ano_anterior) + T(nc.diferenca) : null, T(nc.ano_atual));
    chk('Membresia', 'Rol atual = comungantes + não comungantes', temValor(T(c.ano_atual)) && temValor(T(nc.ano_atual)) ? T(c.ano_atual) + T(nc.ano_atual) : null, T(d.rol_atual));
    for (const lado of ['realizado', 'previsto']) {
      const f = d.financeiro?.[lado]; if (!f) continue;
      const nome = lado === 'realizado' ? 'Realizado' : 'Previsto';
      chk('Finanças', `${nome}: soma das receitas = total da receita`, somaCampos(f, RECEITAS), f.total_receita, true);
      chk('Finanças', `${nome}: saldo anterior + receita = grande total`, temValor(f.saldo_anterior) && temValor(f.total_receita) ? f.saldo_anterior + f.total_receita : null, f.grande_total, true);
      chk('Finanças', `${nome}: soma das despesas = total da despesa`, somaCampos(f, DESPESAS), f.total_despesa, true);
      chk('Finanças', `${nome}: grande total − despesa = saldo seguinte`, temValor(f.grande_total) && temValor(f.total_despesa) ? f.grande_total - f.total_despesa : null, f.saldo_seguinte, true);
    }
    const r = d.financeiro?.realizado, p = d.financeiro?.previsto;
    if (r && p) chk('Finanças', 'Saldo inicial previsto = saldo final realizado', r.saldo_seguinte, p.saldo_anterior, true);
    return out;
  }

  // ---------- Variações relevantes no ano (ano anterior × ano atual, do próprio relatório) ----------
  // Relevante = |variação| ≥ pct E ≥ minimo pessoas. Para membresia, confere se a movimentação
  // registrada explica a mudança (anterior + admissões − demissões = atual).
  const LIMITES_VARIACAO = { pct: 0.15, minimo: 5 };
  function variacoesRelevantes(d, { pct = LIMITES_VARIACAO.pct, minimo = LIMITES_VARIACAO.minimo } = {}) {
    const c = d.comungantes || {}, nc = d.nao_comungantes || {}, e = d.estrutura || {};
    const mov = (b) => {
      const adm = somaBloco(b.admissao), dem = somaBloco(b.demissao);
      return adm == null || dem == null ? null : { adm, dem };
    };
    const soma = (a, b) => (temValor(a) && temValor(b) ? a + b : null);
    const movC = mov(c), movN = mov(nc);
    const movRol = movC && movN ? { adm: movC.adm + movN.adm, dem: movC.dem + movN.dem } : null;
    const itens = [
      ['comungantes', 'Comungantes', T(c.ano_anterior), T(c.ano_atual), movC],
      ['nao_comungantes', 'Não comungantes', T(nc.ano_anterior), T(nc.ano_atual), movN],
      ['rol', 'Rol de membros', soma(T(c.ano_anterior), T(nc.ano_anterior)), T(d.rol_atual), movRol],
      ['alunos_ed', 'Alunos da Escola Dominical', e.alunos_ed_anterior, e.alunos_ed_atual, undefined],
    ];
    const out = [];
    for (const [id, titulo, ant, atu, m] of itens) {
      if (!temValor(ant) || !temValor(atu)) { out.push({ id, titulo, anterior: ant ?? null, atual: atu ?? null, tipo: 'sem_comparacao', relevante: false, explicacao: 'Um dos anos não foi informado; não há comparação.' }); continue; }
      const abs = atu - ant, p = ant ? abs / ant : (atu ? 1 : 0);
      const relevante = Math.abs(abs) >= minimo && Math.abs(p) >= pct;
      let tipo = 'real', explicacao;
      if (m === undefined) { tipo = 'informado'; explicacao = 'Informado pela igreja (o relatório não tem movimentação para conferir).'; }
      else if (m === null) { tipo = 'dado'; explicacao = 'Movimentação incompleta: não dá para conferir se ela explica a mudança.'; }
      else {
        const esperado = ant + m.adm - m.dem;
        explicacao = `Admissões ${m.adm}, demissões ${m.dem}`;
        if (esperado === atu) explicacao += ' — explicam a mudança.';
        else { tipo = 'dado'; explicacao += ` — esperado ${esperado}, informado ${atu}: a movimentação registrada não explica a mudança.`; }
        if (abs < 0 && m.dem === 0) { tipo = 'dado'; explicacao = `Queda sem nenhuma demissão registrada (esperado ${esperado}, informado ${atu}).`; }
      }
      out.push({ id, titulo, anterior: ant, atual: atu, abs, pct: p, tipo, relevante, explicacao });
    }
    return out;
  }

  // ---------- Consolidação ----------
  // Soma apenas valores informados e registra quantas unidades contribuíram.
  function consolidar(rels, fn) {
    let total = 0, n = 0;
    for (const r of rels) { const v = fn(r); if (temValor(v)) { total += v; n++; } }
    return { total: n ? cent(total) : null, n, de: rels.length };
  }
  // Variação: só igrejas com os dois anos informados (mesmo conjunto)
  function variacao(rels, fnAnt, fnAtu) {
    let ant = 0, atu = 0, n = 0;
    for (const r of rels) {
      const a = fnAnt(r), b = fnAtu(r);
      if (temValor(a) && temValor(b)) { ant += a; atu += b; n++; }
    }
    return { anterior: n ? ant : null, atual: n ? atu : null, abs: n ? atu - ant : null, pct: n && ant ? (atu - ant) / ant : null, n, de: rels.length };
  }

  return {
    T, temValor, fmt, STATUS, ORDEM_STATUS, PAPEIS, ROTULOS, DETALHE, RECEITAS, DESPESAS,
    COMPOSICAO_DESPESA, DEPARTAMENTOS, LIDERANCA, somaBloco, somaCampos, verificacoes, consolidar, variacao,
    variacoesRelevantes, LIMITES_VARIACAO,
  };
})();
