// Leitura automática do formulário oficial (CSM-IPB) a partir do texto de um PDF digital.
// Usa a posição de cada texto na página: o rótulo identifica o campo e os cabeçalhos das
// colunas (MASC./FEM./TOTAL, Nº Deptos./Nº de Membros, realizado/previsto) dizem a que
// coluna pertence cada número. Célula vazia vira null (não informado), nunca zero.
window.Leitura = (() => {
  const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
  const chave = (s) => norm(s).replace(/\s*:/g, '').trim();

  // "1.234,56" → 1234.56 · "-2" → -2 · "(1.234,56)" → -1234.56 · qualquer outro texto → null
  function numero(s) {
    let t = String(s).replace(/R\$/g, '').replace(/\s/g, '').replace('−', '-');
    let neg = false;
    if (/^\(.*\)$/.test(t)) { neg = true; t = t.slice(1, -1); }
    if (t.startsWith('-')) { neg = true; t = t.slice(1); }
    if (!/^(\d{1,3}(\.\d{3})+|\d+)(,\d+)?$/.test(t)) return null;
    const v = parseFloat(t.replace(/\./g, '').replace(',', '.'));
    return neg ? -v : v;
  }

  // Agrupa os textos das páginas em linhas (mesma altura), da esquerda para a direita
  async function linhas(doc) {
    const out = [];
    for (let p = 1; p <= Math.min(doc.numPages, 4); p++) {
      const tc = await (await doc.getPage(p)).getTextContent();
      const itens = tc.items.filter((i) => i.str && i.str.trim())
        .map((i) => ({ x: i.transform[4], y: i.transform[5], w: i.width || 0, h: Math.abs(i.transform[3]) || 8, s: i.str.trim() }))
        .filter((i) => !/^[A-ZÃÕ]$/.test(i.s)) // letras soltas de "ADMISSÃO"/"DEMISSÃO" escritas na vertical
        .sort((a, b) => b.y - a.y);
      const rows = [];
      for (const it of itens) {
        const r = rows[rows.length - 1];
        if (r && Math.abs(r.y - it.y) <= Math.max(2, it.h * 0.4)) r.itens.push(it);
        else rows.push({ y: it.y, itens: [it] });
      }
      rows.forEach((r) => r.itens.sort((a, b) => a.x - b.x));
      out.push(...rows);
    }
    return out;
  }

  // Divide uma linha em segmentos "rótulo + números que vêm depois dele"
  function segmentos(row) {
    const segs = [];
    let cur = null;
    for (const it of row.itens) {
      const s = it.s.replace(/^R\$\s*/, '');
      if (!s) continue;
      if (/%$/.test(s)) { if (cur) cur.pct.push(s); continue; }
      if (/^#/.test(s)) { if (cur) cur.erros.push(s); continue; } // #REF!, #VALOR! da planilha de origem
      const v = numero(s);
      if (v !== null) { if (cur) cur.nums.push({ x: it.x + it.w / 2, v }); continue; }
      const junta = cur && !cur.nums.length && !cur.pct.length && !cur.erros.length && !/:\s*$/.test(cur.texto) && it.x - cur.fim < it.h * 4;
      if (junta) { cur.texto += ' ' + s; cur.fim = it.x + it.w; }
      else { cur = { x: it.x, fim: it.x + it.w, texto: s, nums: [], pct: [], erros: [] }; segs.push(cur); }
    }
    segs.forEach((g) => { g.k = chave(g.texto); });
    return segs;
  }

  const LIDERANCA = { PASTORES: 'pastores', LICENCIADOS: 'licenciados', PRESBITEROS: 'presbiteros', DIACONOS: 'diaconos', EVANGELISTAS: 'evangelistas', MISSIONARIOS: 'missionarios', CANDIDATOS: 'candidatos' };
  const ESTRUTURA = {
    'CONGREGACOES DA IGREJA': 'congregacoes', 'PONTOS DE PREGACAO': 'pontos_pregacao', 'ESCOLAS DOMINICAIS': 'escolas_dominicais',
    'PROFESSORES DA ESCOLA DOMINICAL': 'professores_ed', 'ALUNOS ESCOLA DOMINICAL (ANO ATUAL)': 'alunos_ed_atual', 'ALUNOS ESCOLA DOMINICAL (ANO ANTERIOR)': 'alunos_ed_anterior',
  };
  const DEPARTAMENTOS = { UCP: 'ucp', UPA: 'upa', UMP: 'ump', SAF: 'saf', UPH: 'uph', OUTRAS: 'outras', TOTAIS: 'totais' };
  // Rol de membros: [bloco, campo]; "TRANSFERENCIA" é decidida pela ordem (admissão, depois demissão)
  const ROL_C = {
    'PROFISSAO DE FE': ['admissao', 'profissao_fe'], 'PROFISSAO DE FE E BATISMO': ['admissao', 'profissao_fe_batismo'],
    JURISDICAO: ['admissao', 'jurisdicao'], 'JURISDICAO EX-OFFICIO': ['admissao', 'jurisdicao_ex_officio'],
    RESTAURACAO: ['admissao', 'restauracao'], 'READMISSAO AO ROL': ['admissao', 'readmissao_rol'],
    'DESIGNACAO DO PRESBITERIO': ['admissao', 'designacao_presbiterio'],
    FALECIMENTO: ['demissao', 'falecimento'], EXCLUSAO: ['demissao', 'exclusao'], 'EXCLUSAO A PEDIDO': ['demissao', 'exclusao_a_pedido'],
    'EXCLUSAO POR AUSENCIA': ['demissao', 'exclusao_por_ausencia'], ORDENACAO: ['demissao', 'ordenacao'],
    'ROL SEPARADO': [null, 'rol_separado'], 'COMUNGANTES ANO ANTERIOR': [null, 'ano_anterior'], 'COMUNGANTES ANO ATUAL': [null, 'ano_atual'],
  };
  const ROL_N = {
    BATISMO: ['admissao', 'batismo'], 'JURISDICAO EX-OFFICIO': ['admissao', 'jurisdicao_ex_officio'], JURISDICAO: ['admissao', 'jurisdicao'],
    'PROFISSAO DE FE': ['demissao', 'profissao_fe'], FALECIMENTO: ['demissao', 'falecimento'], EXCLUSAO: ['demissao', 'exclusao'],
    'NAO-COMUNGANTES ANO ANTERIOR': [null, 'ano_anterior'], 'NAO-COMUNGANTES ANO ATUAL': [null, 'ano_atual'],
  };
  const FINANCAS = {
    'SALDO - ANO ANTERIOR': 'saldo_anterior', DIZIMOS: 'dizimos', OFERTAS: 'ofertas', 'OFERTAS MISSIONARIAS': 'ofertas_missionarias',
    'OFERTAS ESPECIFICAS': 'ofertas_especificas', 'RECEITAS FINANCEIRAS': 'receitas_financeiras', PARCERIAS: 'parcerias',
    'OUTRAS RECEITAS': 'outras_receitas', 'TOTAL DA RECEITA ANUAL': 'total_receita', PATRIMONIO: 'patrimonio', 'CAUSAS LOCAIS': 'causas_locais',
    'EVANGELISMO LOCAL': 'evangelismo_local', MISSOES: 'missoes', 'ACAO SOCIAL': 'acao_social', 'SUSTENTO PASTORAL': 'sustento_pastoral',
    'VERBA PRESBITERIAL': 'verba_presbiterial', 'DIZIMO AO SUPREMO CONCILIO': 'dizimo_supremo_concilio', 'OUTRAS DESPESAS': 'outras_despesas',
    'TOTAL DA DESPESA ANUAL': 'total_despesa', 'SALDO - ANO SEGUINTE': 'saldo_seguinte',
  };
  // Campos do modelo oficial que devem existir no documento (para avisar o que faltou)
  const ESPERADOS = [
    ...Object.values(LIDERANCA).map((k) => ['lideranca', k]), ...Object.values(ESTRUTURA).map((k) => ['estrutura', k]),
    ...Object.values(DEPARTAMENTOS).map((k) => ['departamentos', k]),
    ...['profissao_fe', 'profissao_fe_batismo', 'transferencia', 'jurisdicao', 'restauracao', 'designacao_presbiterio'].map((k) => ['comungantes', 'admissao', k]),
    ...['transferencia', 'falecimento', 'exclusao', 'ordenacao'].map((k) => ['comungantes', 'demissao', k]),
    ...['rol_separado', 'diferenca', 'ano_anterior', 'ano_atual'].map((k) => ['comungantes', k]),
    ...['batismo', 'transferencia', 'jurisdicao_ex_officio'].map((k) => ['nao_comungantes', 'admissao', k]),
    ...['profissao_fe', 'transferencia', 'falecimento', 'exclusao'].map((k) => ['nao_comungantes', 'demissao', k]),
    ...['diferenca', 'ano_anterior', 'ano_atual'].map((k) => ['nao_comungantes', k]), ['rol_atual'],
    ...['realizado', 'previsto'].flatMap((l) => [...Object.values(FINANCAS), 'emprestimos_receita', 'emprestimos_despesa', 'grande_total'].map((k) => ['financeiro', l, k])),
  ];

  const centro = (it) => it.x + it.w / 2;
  const maisPerto = (x, cols) => cols.reduce((m, c, i) => (Math.abs(x - c) < Math.abs(x - cols[m]) ? i : m), 0);
  const isoData = (s) => { const m = String(s || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/); return m ? `${m[3]}-${m[2]}-${m[1]}` : null; };

  // Retorna { ok, dados, alertas[], modelo, ident{}, lidos, esperados }
  async function extrair(doc, { sinodo = null, presbiterio = null } = {}) {
    const rows = await linhas(doc);
    const c = { admissao: {}, demissao: {} }, nc = { admissao: {}, demissao: {} };
    const d = { lideranca: {}, estrutura: {}, departamentos: {}, comungantes: c, nao_comungantes: nc, rol_atual: undefined, financeiro: { realizado: {}, previsto: {} } };
    const alertas = [];
    const alerta = (nivel, campo, msg) => alertas.push({ nivel, campo, msg });
    const ident = {};
    let modelo = null, secao = null, colC = null, colN = null, xNC = null, xMembros = null, xPrevisto = null, fin = 'receitas', lidos = 0;
    const transf = { c: 0, n: 0 };
    const naoReconhecidas = [];
    const grandeTotalFinal = {};

    const depois = (row, i) => row.itens.slice(i + 1).map((x) => x.s);
    for (const row of rows) {
      const ks = row.itens.map((i) => chave(i.s));
      const texto = norm(row.itens.map((i) => i.s).join(' '));

      // ---- Cabeçalho e identificação ----
      const csm = row.itens.find((i) => /CSM-IPB/i.test(i.s));
      if (csm) { const m = norm(csm.s).match(/CSM-IPB\s*-\s*(\d{4})\s*-\s*V\.?\s*([\d.]+)/); modelo = m ? `CSM-IPB ${m[1]} v${m[2]}` : csm.s; }
      let i;
      if ((i = ks.indexOf('ANO')) >= 0 && ident.ano == null) { const v = numero(depois(row, i)[0]); if (v) ident.ano = v; }
      if ((i = ks.indexOf('SINODO')) >= 0) { const r = depois(row, i); ident.sinodo_sigla = r.length > 1 ? r[r.length - 1] : null; }
      if ((i = ks.indexOf('PRESBITERIO')) >= 0) { const r = depois(row, i); ident.presbiterio_sigla = r.length > 1 ? r[r.length - 1] : null; }
      if ((i = ks.indexOf('NOME (IGREJA/CONGREGACAO)')) >= 0) ident.nome = depois(row, i).join(' ').trim() || null;
      if ((i = ks.indexOf('DATA DE ORGANIZACAO')) >= 0) ident.data_organizacao = isoData(depois(row, i)[0]);

      // ---- Mudança de seção ----
      if (texto.includes('LIDERANCA FORMAL')) { secao = 'estrutura'; continue; }
      if (ks.includes('MASC.') && ks.includes('TOTAL')) {
        const cab = row.itens.filter((x) => ['MASC.', 'FEM.', 'TOTAL'].includes(chave(x.s))).map(centro);
        colC = cab.slice(0, 3); colN = cab.slice(3, 6);
        xNC = row.itens.find((x) => chave(x.s).startsWith('NAO-COMUNGANTES'))?.x ?? null;
        secao = 'rol'; continue;
      }
      if (texto.startsWith('IV - INFORMACOES FINANCEIRAS')) { secao = 'fin'; continue; }
      if (texto.startsWith('VI - INFORMACOES FINAIS') || texto.startsWith('V - ')) { secao = 'fim'; continue; }
      if (secao === 'estrutura' && texto.includes('DE MEMBROS')) xMembros = row.itens.find((x) => norm(x.s).includes('DE MEMBROS'))?.x ?? null;

      const segs = segmentos(row);
      if (secao === 'estrutura') {
        for (const g of segs) {
          if (LIDERANCA[g.k]) { d.lideranca[LIDERANCA[g.k]] = g.nums[0]?.v ?? null; lidos++; }
          else if (ESTRUTURA[g.k]) { d.estrutura[ESTRUTURA[g.k]] = g.nums[0]?.v ?? null; lidos++; }
          else if (DEPARTAMENTOS[g.k]) {
            const par = [null, null];
            g.nums.forEach((n, j) => { par[xMembros != null ? (n.x >= xMembros ? 1 : 0) : j] = n.v; });
            d.departamentos[DEPARTAMENTOS[g.k]] = par; lidos++;
          }
        }
      } else if (secao === 'rol' && colC && colN) {
        for (const g of segs) {
          const lado = xNC != null && g.x >= xNC - 2 ? 'n' : 'c';
          const cols = lado === 'n' ? colN : colC;
          const trio = [null, null, null];
          for (const n of g.nums) {
            const j = maisPerto(n.x, cols);
            if (trio[j] !== null) alerta('aviso', 'rol', `Linha "${g.texto}": dois números na mesma coluna; confira no documento.`);
            trio[j] = n.v;
          }
          const alvo = lado === 'n' ? nc : c;
          let destino = null;
          if (g.k === 'TRANSFERENCIA') destino = [transf[lado]++ === 0 ? 'admissao' : 'demissao', 'transferencia'];
          else if (g.k.startsWith('DIFERENCA')) destino = [null, 'diferenca'];
          else if (lado === 'n' && g.k.startsWith('ROL ATUAL')) { d.rol_atual = trio; lidos++; continue; }
          else destino = (lado === 'n' ? ROL_N : ROL_C)[g.k] || null;
          if (!destino) { if (g.nums.length) naoReconhecidas.push(g.texto.replace(/:\s*$/, '')); continue; }
          const [bloco, campo] = destino;
          (bloco ? alvo[bloco] : alvo)[campo] = trio; lidos++;
        }
      } else if (secao === 'fin') {
        const recon = segs.filter((g) => FINANCAS[g.k] || g.k === 'GRANDE TOTAL' || g.k === 'EMPRESTIMOS IPB / JPEF');
        if (segs.some((g) => g.k === 'RECEITAS')) fin = 'receitas';
        if (segs.some((g) => g.k === 'DESPESAS')) fin = 'despesas';
        if (recon.length === 2 && xPrevisto == null) xPrevisto = recon[1].x;
        recon.forEach((g, j) => {
          const lado = xPrevisto != null ? (g.x >= xPrevisto - 5 ? 'previsto' : 'realizado') : (j === 0 ? 'realizado' : 'previsto');
          const f = d.financeiro[lado];
          const v = g.nums[0]?.v ?? null;
          let campo = FINANCAS[g.k];
          if (g.k === 'EMPRESTIMOS IPB / JPEF') campo = fin === 'receitas' ? 'emprestimos_receita' : 'emprestimos_despesa';
          if (g.k === 'GRANDE TOTAL') {
            if (fin === 'despesas') { grandeTotalFinal[lado] = v; return; }
            campo = 'grande_total';
          }
          f[campo] = v; lidos++;
          if (g.erros.length) alerta('erro', `financeiro.${lado}.${campo}`, `A planilha de origem mostra erro (${g.erros.join(', ')}) ${v === null ? 'no valor' : 'na coluna de percentual'} da linha "${g.texto.replace(/:\s*$/, '')}" (${lado}).`);
          if (g.nums.length > 1) alerta('aviso', `financeiro.${lado}.${campo}`, `Mais de um valor na linha "${g.texto.replace(/:\s*$/, '')}"; foi considerado o primeiro.`);
        });
      }
    }

    // Exclusão dividida em "a pedido" + "por ausência" (formulários alterados): total = soma
    if (!c.demissao.exclusao && (c.demissao.exclusao_a_pedido || c.demissao.exclusao_por_ausencia)) {
      const a = c.demissao.exclusao_a_pedido || [null, null, null], b = c.demissao.exclusao_por_ausencia || [null, null, null];
      c.demissao.exclusao = a.map((x, j) => (x == null && b[j] == null ? null : (x || 0) + (b[j] || 0)));
    }

    // ---- Alertas da leitura ----
    const extras = [];
    if (c.admissao.readmissao_rol) extras.push('Readmissão ao Rol');
    if (c.admissao.jurisdicao_ex_officio) extras.push('Jurisdição ex-officio em comungantes');
    if (c.demissao.exclusao_a_pedido || c.demissao.exclusao_por_ausencia) extras.push('Exclusão a Pedido / por Ausência');
    if (nc.admissao.jurisdicao) extras.push('Jurisdição em não comungantes');
    if (extras.length) alerta('aviso', 'modelo', `Formulário com linhas diferentes do modelo oficial (${extras.join(', ')}).`);
    if (naoReconhecidas.length) alerta('aviso', 'modelo', `Linhas não reconhecidas (valores não importados): ${naoReconhecidas.join('; ')}.`);
    if (!modelo) alerta('aviso', 'modelo', 'Versão do formulário não identificada (rodapé CSM-IPB ausente).');
    if (!ident.nome) alerta('aviso', 'identificacao.nome', 'Nome da igreja em branco no documento.');
    if (sinodo && ident.sinodo_sigla && norm(ident.sinodo_sigla) !== norm(sinodo)) alerta('aviso', 'identificacao.sinodo', `Sigla do sínodo "${ident.sinodo_sigla}" (esperado ${sinodo}).`);
    if (presbiterio && ident.presbiterio_sigla && norm(ident.presbiterio_sigla) !== norm(presbiterio)) alerta('aviso', 'identificacao.presbiterio', `Sigla do presbitério "${ident.presbiterio_sigla}" (esperado ${presbiterio}).`);
    for (const lado of ['realizado', 'previsto']) {
      const a = d.financeiro[lado].grande_total, b = grandeTotalFinal[lado];
      if (a != null && b != null && Math.abs(a - b) > 0.005) alerta('aviso', `financeiro.${lado}.grande_total`, `O "Grande Total" das receitas (${a.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}) difere do "Grande Total" das despesas (${b.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}).`);
    }
    const faltou = ESPERADOS.filter((p) => p.reduce((o, k) => (o == null ? undefined : o[k]), d) === undefined);
    if (faltou.length) alerta('aviso', 'leitura', `${faltou.length} linha(s) do modelo oficial não encontrada(s) no documento: ${faltou.map((p) => p.slice(1).join('.') || p[0]).slice(0, 8).join(', ')}${faltou.length > 8 ? '…' : ''}.`);
    if (d.rol_atual === undefined) d.rol_atual = null;

    d.identificacao = { nome_no_documento: ident.nome || null, sinodo_sigla: ident.sinodo_sigla || null, presbiterio_sigla: ident.presbiterio_sigla || null, data_organizacao: ident.data_organizacao || null };
    return { ok: faltou.length <= ESPERADOS.length * 0.4, dados: d, alertas, modelo, ident, lidos, esperados: ESPERADOS.length };
  }

  // ---------- Excel (.xlsx) do modelo oficial: leitura célula a célula conforme o Dicionário ----------
  function lerCelula(ws, ref, tipo) {
    const c = ws?.[ref];
    if (!c || c.v === undefined || c.v === null || (c.t === 's' && !String(c.v).trim())) return { v: null, semValor: !!c?.f };
    if (c.t === 'e') return { v: null, erro: c.w || '#ERRO' };
    if (tipo === 'texto') return { v: String(c.v).replace(/^Quais\?\s*/i, '').trim() || null };
    if (tipo === 'data') {
      if (c.t === 'n' && window.XLSX) { const p = window.XLSX.SSF.parse_date_code(c.v); return { v: p ? `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}` : null }; }
      return { v: isoData(String(c.v).trim()) }; // "00/00/0000" do modelo vira null
    }
    if (c.t === 'n') return { v: Math.round(c.v * 100) / 100 };
    const v = c.t === 's' ? numero(c.v) : null;
    return v === null ? { v: null, invalido: String(c.v) } : { v };
  }

  // wb: planilha lida pelo SheetJS (com cellFormula). Retorna o mesmo formato de extrair().
  function extrairXlsx(wb, { sinodo = null, presbiterio = null } = {}) {
    const D = window.Dicionario;
    const alertas = [];
    const alerta = (nivel, campo, msg) => alertas.push({ nivel, campo, msg });
    const aba = (nome) => wb.Sheets[wb.SheetNames.find((n) => norm(n) === norm(nome))];
    const ws = aba(D.ABAS.CE);
    const diferentes = (w, mapa) => Object.entries(mapa).filter(([ref, txt]) => !norm(w?.[ref]?.v).startsWith(txt)).map(([ref]) => ref);
    if (!ws) return { ok: false, alertas: [{ nivel: 'erro', campo: 'modelo', msg: 'A planilha não tem a aba "Cadastro & Estatística" do modelo oficial.' }], dados: null, lidos: 0, esperados: 0 };
    const fora = diferentes(ws, D.CONFERIR[D.ABAS.CE]);
    if (fora.length) {
      return { ok: false, dados: null, lidos: 0, esperados: 0, alertas: [{ nivel: 'erro', campo: 'modelo',
        msg: `A aba "Cadastro & Estatística" não está na posição do modelo CSM-IPB 2021 v8.0 (células ${fora.join(', ')}). Use o modelo oficial sem inserir ou apagar linhas.` }] };
    }

    const d = { lideranca: {}, estrutura: {}, departamentos: {}, comungantes: { admissao: {}, demissao: {} }, nao_comungantes: { admissao: {}, demissao: {} },
      rol_atual: null, financeiro: { realizado: {}, previsto: {} }, identificacao: {} };
    let lidos = 0;
    const sobrescritas = [];
    const lerCampo = (w, nomeAba, campo) => {
      const tipo = campo.tipo === 'moeda' ? 'moeda' : campo.tipo;
      const vals = campo.celulas.map((ref) => {
        const r = lerCelula(w, ref, tipo === 'texto' || tipo === 'data' ? tipo : 'num');
        if (r.erro) alerta('erro', campo.id, `A planilha mostra erro (${r.erro}) na célula ${ref} — ${campo.rotulo}.`);
        if (r.invalido) alerta('aviso', campo.id, `Valor não numérico "${r.invalido}" na célula ${ref} — ${campo.rotulo}; considerado não informado.`);
        if (r.semValor) alerta('aviso', campo.id, `A fórmula da célula ${ref} está sem resultado calculado. Abra e salve a planilha no Excel antes de enviar.`);
        if (D.FORMULAS[nomeAba]?.has(ref) && w[ref] && !w[ref].f && r.v !== null) sobrescritas.push(`${ref} (${campo.rotulo})`);
        return r.v;
      });
      if (tipo === 'texto') return vals.filter((v) => v).join(' — ') || null;
      return campo.celulas.length > 1 ? vals : vals[0];
    };

    for (const campo of D.campos.filter((c) => c.aba === D.ABAS.CE && !c.pendente)) {
      definirCaminho(d, campo.id.split('.'), lerCampo(ws, D.ABAS.CE, campo));
      if (!campo.id.startsWith('identificacao.')) lidos++;
    }
    // Conselho / Congregação: só entram se houver algo preenchido (o modelo vem com as abas vazias)
    for (const [nomeAba, chave] of [[D.ABAS.CM, 'conselho'], [D.ABAS.CG, 'congregacao_anexo']]) {
      const w = aba(nomeAba);
      if (!w || diferentes(w, D.CONFERIR[D.ABAS.CM]).length) continue;
      const bloco = {};
      for (const campo of D.campos.filter((c) => c.aba === D.ABAS.CM && !c.pendente)) bloco[campo.id.split('.')[1]] = lerCampo(w, nomeAba, campo);
      if (chave === 'congregacao_anexo') bloco.nome = lerCelula(w, 'G8', 'texto').v;
      const preenchido = Object.entries(bloco).some(([k, v]) => k !== 'nome' && v !== null && v !== 0);
      if (preenchido) { d[chave] = bloco; lidos += Object.keys(bloco).length; }
    }

    const ident = d.identificacao;
    const modelo = (() => { const m = norm(ws.A83?.v).match(/CSM-IPB\s*-\s*(\d{4})\s*-\s*V\.?\s*([\d.]+)/); return m ? `CSM-IPB ${m[1]} v${m[2]} (Excel)` : 'CSM-IPB (Excel)'; })();
    if (sobrescritas.length) alerta('aviso', 'formulas', `Fórmula do modelo substituída por valor digitado: ${sobrescritas.slice(0, 6).join('; ')}${sobrescritas.length > 6 ? '…' : ''}. Confira as somas.`);
    if (!ident.nome_no_documento) alerta('aviso', 'identificacao.nome', 'Nome da igreja em branco no documento.');
    if (sinodo && ident.sinodo_sigla && norm(ident.sinodo_sigla) !== norm(sinodo)) alerta('aviso', 'identificacao.sinodo', `Sigla do sínodo "${ident.sinodo_sigla}" (esperado ${sinodo}).`);
    if (presbiterio && ident.presbiterio_sigla && norm(ident.presbiterio_sigla) !== norm(presbiterio)) alerta('aviso', 'identificacao.presbiterio', `Sigla do presbitério "${ident.presbiterio_sigla}" (esperado ${presbiterio}).`);
    for (const [lado, col] of [['realizado', 'H'], ['previsto', 'W']]) {
      const a = d.financeiro[lado].grande_total, b = lerCelula(ws, `${col}71`, 'num').v;
      if (a != null && b != null && Math.abs(a - b) > 0.005) alerta('aviso', `financeiro.${lado}.grande_total`, `O "Grande Total" das receitas (${a.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}) difere do "Grande Total" das despesas (${b.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}).`);
    }
    return { ok: true, dados: d, alertas, modelo, ident: { ano: ident.ano, nome: ident.nome_no_documento, sinodo_sigla: ident.sinodo_sigla, presbiterio_sigla: ident.presbiterio_sigla },
      lidos, esperados: lidos, formato: 'xlsx' };
  }

  function definirCaminho(o, path, v) {
    const pai = path.slice(0, -1).reduce((x, k) => (x[k] && typeof x[k] === 'object' ? x[k] : (x[k] = {})), o);
    pai[path[path.length - 1]] = v;
  }

  return { extrair, extrairXlsx, numero };
})();
