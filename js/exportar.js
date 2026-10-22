// Exportação do consolidado, gerada no próprio aparelho: planilha Excel (SheetJS) e resumo em PDF (jsPDF).
// Usa os mesmos relatórios do painel (somente validados ou todos) e mantém "não informado" como célula vazia.
window.Exportar = (() => {
  const SHEETJS = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
  const JSPDF = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
  const AUTOTABLE = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js';
  const { T, fmt, STATUS, ROTULOS, somaBloco, consolidar, variacao, verificacoes, LIDERANCA, DEPARTAMENTOS, RECEITAS, DESPESAS } = Regras;
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
  const situacaoTxt = (ctx) => (ctx.exercicio?.situacao === 'fechado'
    ? `Exercício fechado${ctx.exercicio.fechado_em ? ` em ${new Date(ctx.exercicio.fechado_em).toLocaleDateString('pt-BR')}` : ''} — resultado oficial`
    : 'Exercício aberto — resultado parcial');

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
      ['Relatórios considerados', escopoTxt(ctx)], ['Situação do exercício', situacaoTxt(ctx)], ['Gerado em', agora()],
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
      [...ordenar(ctx.todos).map((r) => { const s = situacao(r); return [nome(r), s.status, val(r.versao), s.falhas, s.erros, s.avisos, r.arquivo || '', r.modelo || '']; }),
        ...(ctx.naoEnviadas || []).map((i) => [i.nome, STATUS.nao_enviado.label, null, null, null, null, '', ''])],
      { totais: false }), 'Situação');

    X.writeFile(wb, nomeArquivo(ctx, 'xlsx'));
  }

  // ---------- PDF ----------
  // A fonte padrão do PDF (WinAnsi) não tem alguns símbolos: troca os conhecidos e remove o resto
  const pdfTxt = (s) => String(s ?? '').replace(/\u2212/g, '-').replace(/[\u202f\u2009]/g, ' ').replace(/\u21b3/g, '-').replace(/\u2192/g, '->').replace(/\u2260/g, '<>')
    .replace(/[^\x00-\xFF\u2013\u2014\u2018\u2019\u201C\u201D\u2022\u2026\u20AC]/g, '');
  async function logo() {
    const blob = await (await fetch('icons/logo_ipb.png')).blob();
    return new Promise((ok, erro) => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.onerror = erro; fr.readAsDataURL(blob); });
  }

  const NAVY = [18, 32, 41], GOLD = [200, 155, 60], MUTED = [109, 102, 86], LINE = [226, 219, 201], PAPER = [247, 244, 236];
  const M = 14, W = 210 - 2 * M;
  const num = (v) => pdfTxt(fmt.int(v)), brl = (v) => pdfTxt(fmt.brl(v));

  // Documento A4 com cabeçalho (logo, título, subtítulo, linha de contexto) e utilitários de tabela e aviso
  async function novoPdf(titulo, subtitulo, contexto) {
    await Envio.carregarScript(JSPDF);
    await Envio.carregarScript(AUTOTABLE);
    const doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4' });
    try { doc.addImage(await logo(), 'PNG', M, 10, 30, 20.3); } catch (e) { /* segue sem o logo */ }
    doc.setFont('helvetica', 'bold').setFontSize(17).setTextColor(...NAVY).text(pdfTxt(titulo), 50, 17);
    doc.setFontSize(11.5).text(doc.splitTextToSize(pdfTxt(subtitulo), W - 36)[0], 50, 23.5);
    doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(...MUTED).text(doc.splitTextToSize(pdfTxt(contexto), W - 36)[0], 50, 29);
    doc.setDrawColor(...GOLD).setLineWidth(0.8).line(M, 34, M + W, 34);
    const p = { doc, y: 40 };
    const estilo = (opts) => ({
      theme: 'grid',
      styles: { fontSize: 8.2, cellPadding: 1.25, lineColor: LINE, lineWidth: 0.2, textColor: [27, 37, 43] },
      headStyles: { fillColor: NAVY, textColor: 255, fontStyle: 'bold' },
      footStyles: { fillColor: PAPER, textColor: NAVY, fontStyle: 'bold' },
      // cabeçalho e total seguem o alinhamento da coluna (números à direita)
      didParseCell: (h) => { const cs = opts.columnStyles?.[h.column.index]; if (cs?.halign && h.section !== 'body') h.cell.styles.halign = cs.halign; },
      ...opts,
    });
    const titular = (t, x) => doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(...NAVY).text(pdfTxt(t), x, p.y);
    // Quebra de página antes de um bloco que não cabe (título + algumas linhas)
    const espaco = (mm) => { if (p.y + mm > 280) { doc.addPage(); p.y = 18; } };
    p.tabela = (titulo, opts) => {
      espaco(24);
      titular(titulo, M);
      doc.autoTable(estilo({ startY: p.y + 2.5, margin: { left: M, right: M }, ...opts }));
      p.y = doc.lastAutoTable.finalY + 8;
    };
    // Duas tabelas lado a lado
    p.lado = ([t1, o1], [t2, o2]) => {
      espaco(40);
      const y0 = p.y, meio = M + W / 2;
      titular(t1, M); titular(t2, meio + 3);
      doc.autoTable(estilo({ startY: y0 + 2.5, margin: { left: M, right: 210 - meio + 3 }, ...o1 }));
      const f1 = doc.lastAutoTable.finalY;
      doc.autoTable(estilo({ startY: y0 + 2.5, margin: { left: meio + 3, right: M }, ...o2 }));
      p.y = Math.max(f1, doc.lastAutoTable.finalY) + 8;
    };
    p.aviso = (texto, destaque = GOLD) => {
      const linhas = doc.setFontSize(8.5).splitTextToSize(pdfTxt(texto), W - 6);
      const h = 4 + linhas.length * 3.8;
      doc.setFillColor(...PAPER).setDrawColor(...destaque).setLineWidth(0.3).rect(M, p.y - 4.5, W, h, 'FD');
      doc.setFont('helvetica', 'normal').setTextColor(...NAVY).text(linhas, M + 3, p.y);
      p.y += h + 2;
    };
    p.salvar = (rodape, nome) => {
      const paginas = doc.internal.getNumberOfPages();
      for (let i = 1; i <= paginas; i++) {
        doc.setPage(i);
        doc.setDrawColor(...LINE).setLineWidth(0.2).line(M, 284, M + W, 284);
        doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(...MUTED)
          .text(pdfTxt(rodape), M, 288.5).text(`Página ${i} de ${paginas}`, M + W, 288.5, { align: 'right' });
      }
      doc.save(nome);
    };
    return p;
  }

  const RODAPE = 'Campos vazios nos relatórios significam "não informado" e não são somados como zero.';

  async function pdf(ctx) {
    const base = ordenar(ctx.base);
    const P = await novoPdf('Relatório estatístico', `${ctx.presbiterio?.nome || ''} · Exercício ${ctx.ano}`,
      `${ctx.sinodo?.nome || ''} · ${escopoTxt(ctx)} · gerado em ${agora()}`);

    const validados = ctx.todos.filter((r) => r.status === 'validado').length;
    const cadastradas = ctx.cadastradas || ctx.todos.length, fechado = ctx.exercicio?.situacao === 'fechado';
    if (ctx.escopo === 'todos' || validados < cadastradas || fechado) {
      P.aviso(ctx.escopo === 'todos'
        ? `Inclui relatórios ainda não validados (${ctx.todos.length - validados}). Use apenas para acompanhamento.`
        : fechado ? `${situacaoTxt(ctx)}: ${validados} de ${cadastradas} igrejas com relatório validado compõem os totais.`
        : `Resultado parcial: ${validados} de ${cadastradas} igrejas têm relatório validado. Os totais consideram somente estas.`);
    }
    const tabela = P.tabela;

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
    const faltam = ctx.naoEnviadas || [];
    if (pend.length || faltam.length) {
      tabela(`${fechado ? 'Fora do resultado oficial' : 'Relatórios pendentes'} (${pend.length + faltam.length})`, {
        head: [['Igreja', 'Situação', 'Divergências de soma', 'Erros', 'Avisos']],
        body: [...pend.map((r) => { const s = situacao(r); return [r.igreja.nome, s.status, s.falhas, s.erros, s.avisos]; }),
          ...faltam.map((i) => [i.nome, STATUS.nao_enviado.label, '—', '—', '—'])],
        columnStyles: { 2: { halign: 'center' }, 3: { halign: 'center' }, 4: { halign: 'center' } },
      });
    }

    P.salvar(RODAPE, nomeArquivo(ctx, 'pdf'));
  }

  // ---------- Relatório individual da igreja (PDF) ----------
  async function pdfIgreja(r, ctx) {
    const d = r.dados, c = d.comungantes || {}, nc = d.nao_comungantes || {}, e = d.estrutura || {};
    const fr = d.financeiro?.realizado || {}, fp = d.financeiro?.previsto || {};
    const ig = r.igreja;
    const formato = r.tipo_pdf ? `PDF ${r.tipo_pdf}` : /\.xlsx$/i.test(r.arquivo || '') ? 'Excel' : 'arquivo';
    const P = await novoPdf('Relatório estatístico da igreja', ig.nome,
      `${ctx.presbiterio?.nome || ''} · Exercício ${r.ano} · ${STATUS[r.status]?.label || r.status}${r.versao ? ` · versão ${r.versao}` : ''} · gerado em ${agora()}`);

    // Situação do relatório
    const ultimo = r.historico?.[r.historico.length - 1];
    const quando = ultimo ? ` em ${new Date(ultimo.criado_em).toLocaleDateString('pt-BR')}` : '';
    if (r.status === 'validado') P.aviso(`Relatório validado pela administração do presbitério${quando}.${ctx.exercicio?.situacao === 'fechado' ? ` ${situacaoTxt(ctx)}.` : ''}`, [43, 110, 79]);
    else P.aviso(`Relatório ainda NÃO validado (${(STATUS[r.status]?.label || r.status).toLowerCase()}${quando}). Os números podem mudar após a conferência.`);

    P.tabela('Identificação', {
      body: [['Igreja', ig.nome], ['Cidade', `${ig.cidade || '—'}${ig.uf ? ` · ${ig.uf}` : ''}`],
        ['Organizada em', ig.organizacao ? new Date(`${ig.organizacao}T12:00:00`).toLocaleDateString('pt-BR') : '—'],
        ['Documento de origem', `${r.arquivo || '—'} · ${formato}${r.modelo ? ` · ${r.modelo}` : ''}`],
        ['Extração', r.extraido_em ? `${new Date(r.extraido_em).toLocaleString('pt-BR')} (leitura automática)` : 'importação inicial']].map((l) => l.map(pdfTxt)),
      columnStyles: { 0: { cellWidth: 42, fontStyle: 'bold' } },
    });

    // Membresia
    const sinal = (v) => (v == null ? '—' : pdfTxt(fmt.sinal(v)));
    const trio = (v) => [num(v?.[0]), num(v?.[1]), num(v?.[2])];
    P.tabela('Membresia', {
      head: [['', 'Ano anterior', 'Diferença', 'Ano atual · masc.', 'fem.', 'total']],
      body: [['Comungantes', num(T(c.ano_anterior)), sinal(T(c.diferenca)), ...trio(c.ano_atual)],
        ['Não comungantes', num(T(nc.ano_anterior)), sinal(T(nc.diferenca)), ...trio(nc.ano_atual)],
        ['Rol atual', '', '', ...trio(d.rol_atual)]],
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right', fontStyle: 'bold' } },
    });
    const mov = (bloco) => ['admissao', 'demissao'].flatMap((g) => [
      [{ content: g === 'admissao' ? 'Admissões' : 'Demissões', colSpan: 4, styles: { fontStyle: 'bold', textColor: GOLD } }],
      ...Object.entries(bloco?.[g] || {}).filter(([, v]) => Array.isArray(v)).map(([k, v]) => [pdfTxt(ROTULOS[k] || k), ...trio(v)]),
    ]);
    const colMov = { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right', fontStyle: 'bold' } };
    P.lado(['Movimentação — comungantes', { head: [['Movimento', 'M', 'F', 'Total']], body: mov(c), columnStyles: colMov }],
      ['Movimentação — não comungantes', { head: [['Movimento', 'M', 'F', 'Total']], body: mov(nc), columnStyles: colMov }]);

    // Liderança, estrutura e departamentos
    P.lado(['Liderança formal', { head: [['Função', 'Nº']], body: LIDERANCA.map(([k, l]) => [l, num(d.lideranca?.[k])]), columnStyles: { 1: { halign: 'right' } } }],
      ['Estrutura e Escola Dominical', { head: [['Item', 'Nº']], columnStyles: { 1: { halign: 'right' } },
        body: [['Congregações', e.congregacoes], ['Pontos de pregação', e.pontos_pregacao], ['Escolas dominicais', e.escolas_dominicais], ['Professores da ED', e.professores_ed],
          ['Alunos da ED (ano atual)', e.alunos_ed_atual], ['Alunos da ED (ano anterior)', e.alunos_ed_anterior]].map(([l, v]) => [l, num(v)]) }]);
    P.tabela('Departamentos internos', {
      head: [['Departamento', ...DEPARTAMENTOS.map(([, l]) => l), 'Total']],
      body: [['Nº de departamentos', ...DEPARTAMENTOS.map(([k]) => num(d.departamentos?.[k]?.[0])), num(d.departamentos?.totais?.[0])],
        ['Nº de membros', ...DEPARTAMENTOS.map(([k]) => num(d.departamentos?.[k]?.[1])), num(d.departamentos?.totais?.[1])]],
      columnStyles: Object.fromEntries(Array.from({ length: 7 }, (_, i) => [i + 1, { halign: 'right' }])),
    });

    // Finanças
    const linhaFin = (k, l, forte) => [{ content: pdfTxt(l), styles: forte ? { fontStyle: 'bold' } : {} }, brl(fr[k]), brl(fp[k])];
    const grupo = (t) => [{ content: t, colSpan: 3, styles: { fontStyle: 'bold', textColor: GOLD } }];
    P.tabela('Finanças (R$)', {
      head: [['Item', 'Realizado no exercício', 'Previsto para o próximo']],
      body: [linhaFin('saldo_anterior', 'Saldo do ano anterior', true), grupo('Receitas'), ...RECEITAS.map(([k, l]) => linhaFin(k, l)),
        linhaFin('total_receita', 'Total da receita anual', true), linhaFin('grande_total', 'Grande total', true), grupo('Despesas'),
        ...DESPESAS.map(([k, l]) => linhaFin(k, l)), linhaFin('total_despesa', 'Total da despesa anual', true), linhaFin('saldo_seguinte', 'Saldo para o ano seguinte', true)],
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
    });

    // Vida ministerial (só quando veio a aba do Conselho, no Excel)
    if (d.conselho) {
      const m = d.conselho;
      const itens = [['Celebrações da Santa Ceia', m.ceia_total], ['Atividades evangelísticas', m.atividades_evangelisticas], ['Textos distribuídos', m.textos_total],
        ['Grupos corais', m.grupos_corais], ['Conjuntos musicais', m.conjuntos_musicais], ['Discipulados', m.discipulados], ['Atos beneficentes', m.atos_beneficentes_total],
        ['Visitas', m.visitas_total], ['Reuniões do Conselho', m.reunioes_conselho], ['Reuniões da Junta Diaconal', m.reunioes_junta]];
      const metade = Math.ceil(itens.length / 2);
      P.lado(['Vida ministerial', { head: [['Indicador', 'Nº']], body: itens.slice(0, metade).map(([l, v]) => [l, num(v)]), columnStyles: { 1: { halign: 'right' } } }],
        [' ', { head: [['Indicador', 'Nº']], body: itens.slice(metade).map(([l, v]) => [l, num(v)]), columnStyles: { 1: { halign: 'right' } } }]);
    }

    // Conferência: verificações de soma e alertas da leitura
    const verif = verificacoes(d);
    const val = (x, v) => (v == null ? '—' : x.moeda ? brl(v) : num(v));
    P.tabela('Verificações automáticas', {
      head: [['Verificação', 'Resultado', 'Calculado', 'Informado']],
      body: verif.map((x) => [pdfTxt(x.titulo), x.ok === true ? 'confere' : x.ok === false ? 'DIVERGE' : 'não verificável', x.ok === false ? val(x, x.esperado) : '', x.ok === false ? val(x, x.informado) : '']),
      columnStyles: { 1: { halign: 'center' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
      didParseCell: (h) => { if (h.section === 'body' && h.column.index === 1 && h.cell.raw === 'DIVERGE') { h.cell.styles.textColor = [177, 90, 67]; h.cell.styles.fontStyle = 'bold'; } },
    });
    if (r.alertas?.length) {
      P.tabela('Alertas da leitura do documento', {
        head: [['Nível', 'Descrição']],
        body: r.alertas.map((a) => [a.nivel === 'erro' ? 'Erro' : 'Aviso', pdfTxt(a.msg)]),
        columnStyles: { 0: { cellWidth: 18 } },
      });
    }

    const arquivo = `estatistica-${(ig.codigo || 'igreja').replace(/[^\w-]/g, '')}-${r.ano}.pdf`;
    P.salvar(`${RODAPE} Fonte: ${r.arquivo || 'relatório'}.`, arquivo);
  }

  return { excel, pdf, pdfIgreja };
})();
