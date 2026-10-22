// Exportação do consolidado, gerada no próprio aparelho: planilha Excel (SheetJS) e resumo em PDF (jsPDF).
// Usa os mesmos relatórios do painel (somente validados ou todos) e mantém "não informado" como célula vazia.
window.Exportar = (() => {
  const SHEETJS = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
  const JSPDF = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
  const AUTOTABLE = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js';
  const { T, fmt, STATUS, somaBloco, consolidar, variacao, verificacoes, LIDERANCA, DEPARTAMENTOS, RECEITAS, DESPESAS } = Regras;
  const val = (v) => (v === undefined ? null : v);

  // ---------- Dados comuns ----------
  function indicadores(base) {
    const c = (fn) => consolidar(base, fn);
    const lid = (k) => c((r) => r.dados.lideranca?.[k]);
    return [
      { label: 'Rol de membros', ...c((r) => T(r.dados.rol_atual)) },
      { label: 'Comungantes', ...c((r) => T(r.dados.comungantes?.ano_atual)), v: variacao(base, (r) => T(r.dados.comungantes?.ano_anterior), (r) => T(r.dados.comungantes?.ano_atual)) },
      { label: 'Não comungantes', ...c((r) => T(r.dados.nao_comungantes?.ano_atual)), v: variacao(base, (r) => T(r.dados.nao_comungantes?.ano_anterior), (r) => T(r.dados.nao_comungantes?.ano_atual)) },
      { label: 'Alunos na Escola Dominical', ...c((r) => r.dados.estrutura?.alunos_ed_atual), v: variacao(base, (r) => r.dados.estrutura?.alunos_ed_anterior, (r) => r.dados.estrutura?.alunos_ed_atual) },
      { label: 'Professores da Escola Dominical', ...c((r) => r.dados.estrutura?.professores_ed) },
      { label: 'Receita anual realizada', ...c((r) => r.dados.financeiro?.realizado?.total_receita), moeda: true },
      { label: 'Despesa anual realizada', ...c((r) => r.dados.financeiro?.realizado?.total_despesa), moeda: true },
      { label: 'Pastores', ...lid('pastores') }, { label: 'Presbíteros', ...lid('presbiteros') }, { label: 'Diáconos', ...lid('diaconos') },
    ];
  }

  const situacao = (r) => {
    const v = verificacoes(r.dados);
    return { status: STATUS[r.status]?.label || r.status, falhas: v.filter((x) => x.ok === false).length,
      erros: r.alertas.filter((a) => a.nivel === 'erro').length, avisos: r.alertas.filter((a) => a.nivel === 'aviso').length };
  };
  const ordenar = (rels) => [...rels].sort((a, b) => a.igreja.nome.localeCompare(b.igreja.nome, 'pt-BR'));
  const escopoTxt = (ctx) => (ctx.escopo === 'todos' ? `Todos os relatórios recebidos (${ctx.base.length})` : `Somente relatórios validados (${ctx.base.length} de ${ctx.todos.length})`);
  const nomeArquivo = (ctx, ext) => `estatistica-${ctx.presbiterio?.sigla || 'presbiterio'}-${ctx.ano}-${ctx.escopo === 'todos' ? 'todos' : 'validados'}.${ext}`;
  const agora = () => new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

  // ---------- Excel ----------
  // Monta uma aba com cabeçalho, uma linha por igreja e, no fim, totais e contagem (fórmulas do Excel)
  function aba(X, cabecalho, linhas, { moeda = [], totais = true } = {}) {
    const n = linhas.length;
    const aoa = [cabecalho, ...linhas];
    const ws = X.utils.aoa_to_sheet(aoa);
    const numericas = cabecalho.map((_, j) => j).filter((j) => j > 0 && linhas.some((l) => typeof l[j] === 'number'));
    if (totais && n) {
      const lt = n + 2, lc = n + 3; // linhas 1-based do Excel
      X.utils.sheet_add_aoa(ws, [['Total (somente valores informados)'], ['Igrejas que informaram']], { origin: `A${lt}` });
      for (const j of numericas) {
        const col = X.utils.encode_col(j);
        ws[`${col}${lt}`] = { t: 'n', f: `SUM(${col}2:${col}${n + 1})` };
        ws[`${col}${lc}`] = { t: 'n', f: `COUNT(${col}2:${col}${n + 1})` };
      }
      ws['!ref'] = X.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: lc - 1, c: cabecalho.length - 1 } });
    }
    // Formato de moeda nas colunas financeiras
    for (const j of moeda) for (let i = 1; i <= n + 1; i++) { const cel = ws[X.utils.encode_cell({ r: i, c: j })]; if (cel) cel.z = '#,##0.00'; }
    ws['!cols'] = cabecalho.map((h, j) => ({ wch: j === 0 ? 44 : Math.max(10, Math.min(28, String(h).length + 2)) }));
    ws['!freeze'] = { xSplit: 1, ySplit: 1 };
    return ws;
  }

  async function excel(ctx) {
    await Envio.carregarScript(SHEETJS);
    const X = window.XLSX;
    const wb = X.utils.book_new();
    const base = ordenar(ctx.base);

    const resumo = [
      ['Relatório estatístico'], ['Sínodo', ctx.sinodo?.nome || ''], ['Presbitério', ctx.presbiterio?.nome || ''], ['Exercício', ctx.ano],
      ['Relatórios considerados', escopoTxt(ctx)], ['Gerado em', agora()], [],
      ['Indicador', 'Total', 'Igrejas que informaram', 'De', 'Variação no ano', 'Variação %'],
      ...indicadores(base).map((i) => [i.label, i.total, i.n, i.de, i.v ? val(i.v.abs) : null, i.v && i.v.pct != null ? Math.round(i.v.pct * 1000) / 10 : null]),
      [], ['Campos vazios nos relatórios significam "não informado" e não são somados como zero.'],
    ];
    const wsR = X.utils.aoa_to_sheet(resumo);
    wsR['!cols'] = [{ wch: 34 }, { wch: 18 }, { wch: 22 }, { wch: 6 }, { wch: 16 }, { wch: 12 }];
    indicadores(base).forEach((i, k) => { if (i.moeda) { const cel = wsR[`B${9 + k}`]; if (cel) cel.z = '#,##0.00'; } });
    X.utils.book_append_sheet(wb, wsR, 'Resumo');

    const nome = (r) => r.igreja.nome;
    X.utils.book_append_sheet(wb, aba(X,
      ['Igreja', 'Comungantes (ano anterior)', 'Admissões', 'Demissões', 'Diferença', 'Comungantes masc.', 'Comungantes fem.', 'Comungantes (ano atual)',
        'Não comungantes (ano anterior)', 'Não comungantes (ano atual)', 'Rol atual masc.', 'Rol atual fem.', 'Rol atual'],
      base.map((r) => {
        const c = r.dados.comungantes || {}, nc = r.dados.nao_comungantes || {}, rol = r.dados.rol_atual || [];
        return [nome(r), T(c.ano_anterior), somaBloco(c.admissao), somaBloco(c.demissao), T(c.diferenca), val(c.ano_atual?.[0]), val(c.ano_atual?.[1]), T(c.ano_atual),
          T(nc.ano_anterior), T(nc.ano_atual), val(rol[0]), val(rol[1]), val(rol[2])].map(val);
      })), 'Membresia');

    X.utils.book_append_sheet(wb, aba(X,
      ['Igreja', ...LIDERANCA.map(([, l]) => l), 'Congregações', 'Pontos de pregação', 'Escolas dominicais', 'Professores da ED', 'Alunos da ED (ano atual)', 'Alunos da ED (ano anterior)',
        'Departamentos (nº)', ...DEPARTAMENTOS.map(([, l]) => `Membros ${l}`), 'Membros dos departamentos'],
      base.map((r) => {
        const d = r.dados, e = d.estrutura || {}, dp = d.departamentos || {};
        return [nome(r), ...LIDERANCA.map(([k]) => d.lideranca?.[k]), e.congregacoes, e.pontos_pregacao, e.escolas_dominicais, e.professores_ed, e.alunos_ed_atual, e.alunos_ed_anterior,
          dp.totais?.[0], ...DEPARTAMENTOS.map(([k]) => dp[k]?.[1]), dp.totais?.[1]].map(val);
      })), 'Estrutura');

    const minis = Dicionario.campos.filter((c) => c.id.startsWith('conselho.') && !c.pendente && c.tipo !== 'texto' && c.id !== 'conselho.congregacoes');
    X.utils.book_append_sheet(wb, aba(X, ['Igreja', ...minis.map((c) => c.rotulo)],
      base.map((r) => [nome(r), ...minis.map((c) => val(r.dados.conselho?.[c.id.split('.')[1]]))])), 'Vida ministerial');

    const camposFin = [['saldo_anterior', 'Saldo anterior'], ...RECEITAS, ['total_receita', 'Total da receita'], ['grande_total', 'Grande total'],
      ...DESPESAS, ['total_despesa', 'Total da despesa'], ['saldo_seguinte', 'Saldo para o ano seguinte']];
    const moedas = camposFin.map((_, j) => j + 1);
    for (const [lado, titulo] of [['realizado', 'Finanças realizado'], ['previsto', 'Finanças previsto']]) {
      X.utils.book_append_sheet(wb, aba(X, ['Igreja', ...camposFin.map(([, l]) => l)],
        base.map((r) => [nome(r), ...camposFin.map(([k]) => val(r.dados.financeiro?.[lado]?.[k]))]), { moeda: moedas }), titulo);
    }

    X.utils.book_append_sheet(wb, aba(X, ['Igreja', 'Situação', 'Versão', 'Divergências de soma', 'Erros na leitura', 'Avisos na leitura', 'Arquivo', 'Modelo'],
      ordenar(ctx.todos).map((r) => { const s = situacao(r); return [nome(r), s.status, val(r.versao), s.falhas, s.erros, s.avisos, r.arquivo || '', r.modelo || '']; }),
      { totais: false }), 'Situação');

    X.writeFile(wb, nomeArquivo(ctx, 'xlsx'));
  }

  // ---------- PDF ----------
  const pdfTxt = (s) => String(s).replace(/−/g, '-').replace(/[  ]/g, ' '); // fonte padrão do PDF não tem "−"
  async function logo() {
    const blob = await (await fetch('icons/logo_ipb.png')).blob();
    return new Promise((ok, erro) => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.onerror = erro; fr.readAsDataURL(blob); });
  }

  async function pdf(ctx) {
    await Envio.carregarScript(JSPDF);
    await Envio.carregarScript(AUTOTABLE);
    const doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4' });
    const NAVY = [18, 32, 41], GOLD = [200, 155, 60], MUTED = [109, 102, 86], LINE = [226, 219, 201], PAPER = [247, 244, 236];
    const base = ordenar(ctx.base);
    const M = 14, W = 210 - 2 * M;

    try { doc.addImage(await logo(), 'PNG', M, 10, 30, 20.3); } catch (e) { /* segue sem o logo */ }
    doc.setFont('helvetica', 'bold').setFontSize(17).setTextColor(...NAVY).text('Relatório estatístico', 50, 17);
    doc.setFontSize(11.5).text(pdfTxt(`${ctx.presbiterio?.nome || ''} · Exercício ${ctx.ano}`), 50, 23.5);
    doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(...MUTED)
      .text(pdfTxt(`${ctx.sinodo?.nome || ''} · ${escopoTxt(ctx)} · gerado em ${agora()}`), 50, 29);
    doc.setDrawColor(...GOLD).setLineWidth(0.8).line(M, 34, M + W, 34);
    let y = 40;

    const validados = ctx.todos.filter((r) => r.status === 'validado').length;
    if (ctx.escopo === 'todos' || validados < ctx.todos.length) {
      const aviso = ctx.escopo === 'todos'
        ? `Inclui relatórios ainda não validados (${ctx.todos.length - validados}). Use apenas para acompanhamento.`
        : `Resultado parcial: ${validados} de ${ctx.todos.length} relatórios recebidos estão validados. Os totais consideram somente estes.`;
      doc.setFillColor(...PAPER).setDrawColor(...GOLD).setLineWidth(0.3).rect(M, y - 4.5, W, 8, 'FD');
      doc.setFontSize(8.5).setTextColor(...NAVY).text(pdfTxt(aviso), M + 3, y + 0.5);
      y += 10;
    }

    const tabela = (titulo, opts) => {
      doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(...NAVY).text(titulo, M, y);
      doc.autoTable({
        startY: y + 2.5, margin: { left: M, right: M }, theme: 'grid',
        styles: { fontSize: 8.2, cellPadding: 1.25, lineColor: LINE, lineWidth: 0.2, textColor: [27, 37, 43] },
        headStyles: { fillColor: NAVY, textColor: 255, fontStyle: 'bold' },
        footStyles: { fillColor: PAPER, textColor: NAVY, fontStyle: 'bold' },
        // cabeçalho e total seguem o alinhamento da coluna (números à direita)
        didParseCell: (h) => { const cs = opts.columnStyles?.[h.column.index]; if (cs?.halign && h.section !== 'body') h.cell.styles.halign = cs.halign; },
        ...opts,
      });
      y = doc.lastAutoTable.finalY + 8;
    };
    const num = (v) => pdfTxt(fmt.int(v)), brl = (v) => pdfTxt(fmt.brl(v));

    tabela('Indicadores consolidados', {
      head: [['Indicador', 'Total', 'Igrejas que informaram', 'Variação no ano']],
      body: indicadores(base).map((i) => [i.label, i.moeda ? brl(i.total) : num(i.total), `${i.n} de ${i.de}`,
        i.v && i.v.abs != null ? pdfTxt(`${fmt.sinal(i.v.abs)}${i.v.pct != null ? ` (${fmt.pct(i.v.pct)})` : ''}`) : '—']),
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'center' }, 3: { halign: 'right' } },
    });

    const soma = (fn) => consolidar(base, fn).total;
    const colunas = [
      (r) => T(r.dados.comungantes?.ano_atual), (r) => T(r.dados.nao_comungantes?.ano_atual), (r) => T(r.dados.rol_atual),
      (r) => r.dados.estrutura?.alunos_ed_atual, (r) => r.dados.financeiro?.realizado?.total_receita, (r) => r.dados.financeiro?.realizado?.total_despesa,
    ];
    tabela('Por igreja', {
      head: [['Igreja', 'Comung.', 'Não com.', 'Rol', 'Alunos ED', 'Receita realizada', 'Despesa realizada']],
      body: base.map((r) => [r.igreja.nome, ...colunas.map((f, j) => (j >= 4 ? brl(f(r)) : num(f(r))))]),
      foot: [['Total (valores informados)', ...colunas.map((f, j) => (j >= 4 ? brl(soma(f)) : num(soma(f))))]],
      columnStyles: { 0: { cellWidth: 56 }, 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' } },
    });

    const pend = ordenar(ctx.todos.filter((r) => r.status !== 'validado'));
    if (pend.length) {
      tabela(`Relatórios pendentes de validação (${pend.length})`, {
        head: [['Igreja', 'Situação', 'Divergências de soma', 'Erros', 'Avisos']],
        body: pend.map((r) => { const s = situacao(r); return [r.igreja.nome, s.status, s.falhas, s.erros, s.avisos]; }),
        columnStyles: { 2: { halign: 'center' }, 3: { halign: 'center' }, 4: { halign: 'center' } },
      });
    }

    const paginas = doc.internal.getNumberOfPages();
    for (let p = 1; p <= paginas; p++) {
      doc.setPage(p);
      doc.setDrawColor(...LINE).setLineWidth(0.2).line(M, 284, M + W, 284);
      doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(...MUTED)
        .text('Campos vazios nos relatórios significam "não informado" e não são somados como zero.', M, 288.5)
        .text(`Página ${p} de ${paginas}`, M + W, 288.5, { align: 'right' });
    }
    doc.save(nomeArquivo(ctx, 'pdf'));
  }

  return { excel, pdf };
})();
