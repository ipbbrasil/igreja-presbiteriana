// Interface: roteamento por hash, telas e ações.
(() => {
  const S = Data.state;
  const { T, fmt, STATUS, ORDEM_STATUS, PAPEIS, temValor } = Regras;
  const esc = Charts.esc;
  const $app = document.getElementById('app');
  const ui = { escopo: 'validados', carregado: false };

  // ---------- Sem "puxar para atualizar" ----------
  // O CSS (overscroll-behavior) resolve no Android; no iPhone, ignora o gesto de puxar para baixo
  // quando nada embaixo do dedo ainda pode rolar para cima (assim a tela não faz nada).
  let toqueY = 0;
  document.addEventListener('touchstart', (e) => { if (e.touches.length === 1) toqueY = e.touches[0].clientY; }, { passive: true });
  document.addEventListener('touchmove', (e) => {
    if (e.touches.length !== 1 || e.touches[0].clientY <= toqueY) return;
    for (let el = e.target; el && el !== document.body; el = el.parentElement) {
      if (el.scrollTop > 0 && el.scrollHeight > el.clientHeight) return;
    }
    if ((document.scrollingElement || document.documentElement).scrollTop <= 0 && e.cancelable) e.preventDefault();
  }, { passive: false });

  // ---------- Ícones ----------
  const ICON = {
    home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
    igrejas: '<path d="M12 2v4M10 4h4M5 21V11l7-5 7 5v10M9.5 21v-5h5v5M3 21h18"/>',
    conferencia: '<path d="M9 11l2 2 4-4"/><path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5"/>',
    sinodo: '<path d="M12 3 2 8l10 5 10-5-10-5z"/><path d="M2 13l10 5 10-5"/><path d="M2 18l10 5 10-5"/>',
    perfil: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
    voltar: '<path d="M15 5l-7 7 7 7"/>',
    cadeado: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    seta: '<path d="M9 5l7 7-7 7"/>',
    arquivo: '<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5"/>',
    busca: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
    enviar: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"/>',
    baixar: '<path d="M12 4v12M7 11l5 5 5-5"/><path d="M4 20h16"/>',
    ajuda: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 1 1 3.4 2.4c-.6.3-1 .8-1 1.5v.5"/><path d="M12 17h.01"/>',
  };
  const ic = (n, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICON[n]}</svg>`;

  // ---------- Utilidades ----------
  const chip = (status) => {
    const s = STATUS[status] || STATUS.recebido;
    return `<span class="chip ${s.cls}"><b aria-hidden="true">${s.icon}</b>${s.label}</span>`;
  };
  const delta = (v, { moeda = false } = {}) => {
    if (!v || !temValor(v.abs)) return '';
    const cls = v.abs > 0 ? 'up' : v.abs < 0 ? 'down' : 'flat';
    const seta = v.abs > 0 ? '▲' : v.abs < 0 ? '▼' : '■';
    const abs = moeda ? fmt.brlCurto(Math.abs(v.abs)) : fmt.sinal(v.abs);
    return `<span class="kpi-d ${cls}"><b aria-hidden="true">${seta}</b>${moeda && v.abs < 0 ? '−' : ''}${abs}${temValor(v.pct) ? ` (${fmt.pct(v.pct)})` : ''}</span>`;
  };
  const cobertura = (c) => (c && c.de ? `<span class="kpi-f">${c.n} de ${c.de} ${c.de === 1 ? 'igreja' : 'igrejas'}</span>` : '');
  const kpi = (label, valor, extra = '', foot = '') => `<div class="kpi"><span class="kpi-l">${label}</span><strong class="kpi-v">${valor}</strong>${extra}${foot}</div>`;
  const card = (titulo, corpo, { sub = '', fonte = '', cls = '' } = {}) => `<section class="card ${cls}">
      ${titulo ? `<header class="card-h"><h2>${titulo}</h2>${sub ? `<p>${sub}</p>` : ''}</header>` : ''}
      ${corpo}
      ${fonte ? `<footer class="card-f">${fonte}</footer>` : ''}
    </section>`;
  const relPorCodigo = (cod) => S.relatorios.find((r) => r.igreja.codigo === cod);
  const nomeCurto = (n) => String(n || '').replace(/Igreja Presbiteriana/i, 'IP').replace(/Primeira/i, '1ª').replace(/Segunda/i, '2ª');
  const contaVerif = (r) => {
    const v = Regras.verificacoes(r.dados);
    return { falhas: v.filter((x) => x.ok === false).length, total: v.filter((x) => x.ok !== null).length };
  };
  const toast = (msg) => {
    const t = document.getElementById('toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toast._t); toast._t = setTimeout(() => { t.hidden = true; }, 2600);
  };

  // ---------- Exercício (ano) e evolução histórica ----------
  const seletorAno = () => `<label class="sel-ano">Exercício <select id="sel-ano" aria-label="Exercício">${(S.anos.length ? S.anos : [S.ano])
    .map((a) => `<option value="${a}"${a === S.ano ? ' selected' : ''}>${a}</option>`).join('')}</select></label>`;
  document.addEventListener('change', (e) => {
    if (e.target.id !== 'sel-ano') return;
    Data.trocarAno(+e.target.value); ui.carregado = false; rota();
  });

  // Série de um indicador por ano. "ant" = campo do "ano anterior": acrescenta o ano que antecede
  // o primeiro relatório (valor informado nele mesmo), marcado como tal.
  function serieAnual(linhas, campo, ant) {
    const anos = [...new Set(linhas.map((l) => l.ano))].sort((a, b) => a - b);
    const pontos = anos.map((a) => { const c = Regras.consolidar(linhas.filter((l) => l.ano === a), (l) => l[campo]); return { ano: a, valor: c.total, n: c.n, de: c.de }; });
    if (ant && anos.length) {
      const c = Regras.consolidar(linhas.filter((l) => l.ano === anos[0]), (l) => l[ant]);
      if (c.n) pontos.unshift({ ano: anos[0] - 1, valor: c.total, n: c.n, de: c.de, anterior: true });
    }
    return pontos;
  }
  const INDICADORES_EVOL = [['rol', 'rol_ant', 'Rol de membros', fmt.int], ['com', 'com_ant', 'Comungantes', fmt.int],
    ['ed', 'ed_ant', 'Alunos da Escola Dominical', fmt.int], ['rec', null, 'Receita anual realizada', fmt.brlCurto]];

  // Quadro de evolução: um minigráfico por indicador (escalas diferentes não dividem eixo)
  // Série a partir de totais já agregados (visões do sínodo e nacional): cada linha traz soma e "n_" (igrejas que informaram)
  function serieAgregada(linhas, campo, ant) {
    const anos = [...new Set(linhas.map((l) => l.ano))].sort((a, b) => a - b);
    const soma = (ls, c) => {
      const ok = ls.filter((l) => l['n_' + c] > 0);
      return ok.length ? { valor: ok.reduce((s, l) => s + Number(l[c]), 0), n: ok.reduce((s, l) => s + l['n_' + c], 0) } : { valor: null, n: 0 };
    };
    const pontos = anos.map((a) => ({ ano: a, ...soma(linhas.filter((l) => l.ano === a), campo) }));
    if (ant && anos.length) {
      const s = soma(linhas.filter((l) => l.ano === anos[0]), ant);
      if (s.n) pontos.unshift({ ano: anos[0] - 1, ...s, anterior: true });
    }
    return pontos;
  }

  function cardEvolucao(linhas, { titulo = 'Evolução histórica', sub = '', igreja = false, agregado = false } = {}) {
    const blocos = INDICADORES_EVOL.map(([c, a, nome, f], i) => {
      const p = agregado ? serieAgregada(linhas, c, a) : serieAnual(linhas, c, a);
      const reais = p.filter((x) => !x.anterior && Regras.temValor(x.valor));
      const ult = reais[reais.length - 1];
      const ns = new Set(p.filter((x) => Regras.temValor(x.valor)).map((x) => x.n));
      return `<div class="evo">
        <div class="evo-h"><span>${nome}</span><strong>${ult ? f(ult.valor) : '—'}</strong></div>
        ${Charts.linha(p, { fmt: f, serie: i + 1, unidade: igreja ? 'relatório' : 'igreja' })}
        ${!igreja && ns.size > 1 ? '<p class="evo-n">Atenção: conjunto de igrejas diferente entre os anos — parte da mudança pode ser cobertura, não crescimento.</p>' : ''}
      </div>`;
    }).join('');
    const anosReais = [...new Set(linhas.map((l) => l.ano))];
    return card(titulo, `<div class="evos">${blocos}</div>
      <p class="nota">${anosReais.length < 2 ? 'Por enquanto há relatórios de um só exercício; o ponto vazado (linha tracejada) é o “ano anterior” informado nesse mesmo relatório. A série cresce a cada exercício enviado.' : 'Ponto vazado e linha tracejada: valor informado como “ano anterior” no relatório seguinte.'} Toque nos pontos para ver valores e quantas igrejas contribuíram.</p>`, { sub });
  }

  // ---------- Variações relevantes ----------
  // Limite escolhido pelo usuário (fica salvo só neste aparelho)
  const lerLimite = () => { try { return +localStorage.getItem('painel.limiteVar') || Regras.LIMITES_VARIACAO.pct; } catch (e) { return Regras.LIMITES_VARIACAO.pct; } };
  ui.limiteVar = lerLimite();
  const variacoes = (r) => Regras.variacoesRelevantes(r.dados, { pct: ui.limiteVar });
  const pctTxt = (p) => `${p > 0 ? '+' : p < 0 ? '−' : ''}${Math.abs(p * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
  const seloVar = (x) => (x.tipo === 'dado' ? '<span class="flag crit">verificar dado</span>'
    : !x.relevante ? '<span class="flag ok">dentro do normal</span>'
    : `<span class="flag ${x.abs < 0 ? 'queda' : 'alta'}">${x.abs < 0 ? 'queda' : 'alta'} ${x.tipo === 'informado' ? 'informada' : 'real'}</span>`);
  function tabelaVariacoes(lista, { igreja = false } = {}) {
    return `<div class="tbl-wrap"><table class="tbl var"><thead><tr>${igreja ? '<th>Igreja</th>' : ''}<th>Indicador</th><th>Ano anterior</th><th>Ano atual</th><th>Variação</th><th>Leitura</th></tr></thead><tbody>
      ${lista.map(({ r, x }) => `<tr>${igreja ? `<td><a href="#/igreja/${esc(r.igreja.codigo)}/membresia">${esc(nomeCurto(r.igreja.nome))}</a></td>` : ''}
        <td>${esc(x.titulo)}</td><td>${fmt.int(x.anterior)}</td><td>${fmt.int(x.atual)}</td>
        <td><strong>${x.abs != null ? `${fmt.sinal(x.abs)} (${pctTxt(x.pct)})` : '—'}</strong></td>
        <td>${x.tipo === 'sem_comparacao' ? '<span class="na">sem comparação</span>' : seloVar(x)}<small>${esc(x.explicacao)}</small></td></tr>`).join('')}
    </tbody></table></div>`;
  }

  // ---------- Rastreabilidade ----------
  // Valor tocável: abre a origem do dado (documento, página/célula, extração, validação, correções)
  const rv = (html, caminho, i = null, igreja = null) => `<button type="button" class="rv" data-campo="${caminho}"${i != null ? ` data-i="${i}"` : ''}${igreja ? ` data-igreja="${esc(igreja)}"` : ''} title="Ver a origem deste valor">${html}</button>`;
  // Total consolidado tocável: abre a lista de igrejas que somaram
  const rvc = (html, chave) => `<button type="button" class="rv" data-consol="${chave}" title="Ver quais igrejas compõem este total">${html}</button>`;
  const COL3 = ['masculino', 'feminino', 'total'], COL2 = ['nº de departamentos', 'nº de membros'];
  const CONSOL = {
    rol: ['Rol de membros', (r) => T(r.dados.rol_atual), 'int', 'rol_atual', 2],
    com: ['Comungantes', (r) => T(r.dados.comungantes?.ano_atual), 'int', 'comungantes.ano_atual', 2],
    nc: ['Não comungantes', (r) => T(r.dados.nao_comungantes?.ano_atual), 'int', 'nao_comungantes.ano_atual', 2],
    ed: ['Alunos na Escola Dominical', (r) => r.dados.estrutura?.alunos_ed_atual, 'int', 'estrutura.alunos_ed_atual'],
    prof: ['Professores da Escola Dominical', (r) => r.dados.estrutura?.professores_ed, 'int', 'estrutura.professores_ed'],
    rec: ['Receita anual realizada', (r) => r.dados.financeiro?.realizado?.total_receita, 'brl', 'financeiro.realizado.total_receita'],
    desp: ['Despesa anual realizada', (r) => r.dados.financeiro?.realizado?.total_despesa, 'brl', 'financeiro.realizado.total_despesa'],
  };

  function abrirPainel(titulo, html) {
    fecharPainel();
    const el = document.createElement('div');
    el.className = 'sheet-bg'; el.id = 'sheet';
    el.innerHTML = `<section class="sheet" role="dialog" aria-modal="true" aria-label="${esc(titulo)}">
        <header class="sheet-h"><h2>${titulo}</h2><button class="btn ic-btn" id="sheet-x" aria-label="Fechar">✕</button></header>
        <div class="sheet-c">${html}</div></section>`;
    document.body.appendChild(el);
    el.addEventListener('click', (e) => { if (e.target === el || e.target.closest('#sheet-x') || e.target.closest('a[href^="#/"]')) fecharPainel(); });
    el.querySelector('#sheet-x').focus();
    return el;
  }
  function fecharPainel() { document.getElementById('sheet')?.remove(); }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') fecharPainel(); });

  const campoDic = (caminho) => { const id = caminho.replace(/^congregacao_anexo\./, 'conselho.'); return Dicionario.campos.find((c) => c.id === id) || null; };
  const envioDoRelatorio = (r) => S.envios.find((e) => e.relatorio_id === r.id) || S.envios.find((e) => e.igrejas?.codigo === r.igreja.codigo && e.arquivo_nome === r.arquivo);

  async function painelOrigem(r, caminho, i) {
    if (r.dados._origem === undefined && S.modo !== 'local') {
      abrirPainel('Origem do valor', '<div class="carregando dark"><span class="spin"></span>Buscando a origem no documento…</div>');
      try { await Data.carregarOrigem(r); } catch (e) { /* segue sem a localização exata */ }
    }
    const dic = campoDic(caminho);
    const bruto = caminho.split('.').reduce((o, k) => (o == null ? undefined : o[k]), r.dados);
    const valor = i != null && Array.isArray(bruto) ? bruto[i] : bruto;
    const moeda = dic?.tipo === 'moeda';
    const valorTxt = temValor(valor) ? (moeda ? fmt.brl(valor) : fmt.int(valor)) : 'não informado (campo vazio no relatório)';
    const coluna = i != null ? (dic?.tipo === 'par' ? COL2 : COL3)[i] : null;
    const orig = r.dados._origem?.campos?.[caminho];
    const envio = envioDoRelatorio(r);
    const digitado = r.alertas.some((a) => a.campo === 'leitura' && /digitados manualmente/i.test(a.msg));
    let local;
    if (orig?.derivado) local = esc(orig.derivado);
    else if (orig?.p) local = `Página ${orig.p} do PDF<blockquote class="trecho">${esc(orig.l)}</blockquote>`;
    else if (orig?.a) local = `Aba “${esc(orig.a)}” · célula <strong>${esc(orig.c)}</strong>${coluna ? ` (coluna ${coluna})` : ''}`;
    else if (digitado) local = 'Digitado manualmente a partir do arquivo enviado';
    else if (dic) local = `${r.tipo_pdf ? `PDF · ${dic.aba === 'Cadastro & Estatística' ? (caminho.startsWith('financeiro') ? 'página 2, seção IV' : 'página 1, seções II e III') : 'aba do Conselho'}` : 'Excel'}
      · no modelo: aba “${esc(dic.aba)}”, célula ${esc(dic.celulas.join(' · '))}<br><span class="muted small">Localização exata não registrada (relatório importado antes da rastreabilidade)</span>`;
    else local = '—';
    const ultimo = r.historico[r.historico.length - 1];
    const html = `
      <p class="rv-valor">${valorTxt}</p>
      <dl class="dl">
        <dt>Indicador</dt><dd>${esc(dic?.rotulo || caminho)}${coluna ? ` · ${coluna}` : ''}<br><code>${esc(caminho)}${i != null ? `[${i}]` : ''}</code></dd>
        <dt>Igreja</dt><dd>${esc(r.igreja.nome)}</dd>
        <dt>Ano de referência</dt><dd>${r.ano}${dic?.periodo ? ` · ${esc(dic.periodo)}` : ''}</dd>
        <dt>Documento</dt><dd>${esc(r.arquivo || '—')} · ${esc(formatoTxt(r))}${r.versao ? ` · versão ${r.versao}` : ''}
          ${envio ? `<br><button class="btn" data-baixar="${esc(envio.caminho)}">${ic('baixar')}Abrir o documento original</button>` : ''}</dd>
        <dt>Origem no documento</dt><dd>${local}</dd>
        <dt>Extração</dt><dd>${r.extraido_em ? `${fmt.dataHora(r.extraido_em)} · leitura automática` : 'Importação inicial (transcrição dos PDFs)'}</dd>
        <dt>Validação</dt><dd>${chip(r.status)}${ultimo ? `<br><span class="muted small">${fmt.dataHora(ultimo.criado_em)}${ultimo.comentario ? ` · ${esc(ultimo.comentario)}` : ''}</span>` : ''}</dd>
        ${dic?.formula ? `<dt>Fórmula do modelo</dt><dd>${esc(dic.formula)}</dd>` : ''}
        ${dic?.validacao ? `<dt>Regra</dt><dd>${esc(dic.validacao)}</dd>` : ''}
        <dt>Correções</dt><dd id="rv-corr"><span class="muted">Consultando…</span></dd>
      </dl>
      <p class="nota">Valor tal como está no relatório${temValor(valor) ? '' : ' — campo vazio não é tratado como zero'}. Use “Abrir o documento original” para conferir.</p>`;
    const el = abrirPainel('Origem do valor', html);
    try {
      const alvo = caminho + (i != null ? `[${i}]` : '');
      const correcoes = await Data.listarCorrecoes(r.id);
      const lista = correcoes.flatMap((c) => (c.alteracoes || []).filter((a) => a.caminho === alvo).map((a) => ({ ...a, quando: c.criado_em, comentario: c.comentario })));
      // Correções feitas antes de o campo exato ser registrado
      const antigas = correcoes.filter((c) => (c.alteracoes || []).some((a) => !a.caminho)).length;
      el.querySelector('#rv-corr').innerHTML = (lista.length
        ? lista.map((a) => `${fmt.dataHora(a.quando)}: <strong>${esc(a.de ?? 'vazio')} → ${esc(a.para ?? 'vazio')}</strong>${a.comentario ? ` · ${esc(a.comentario)}` : ''}`).join('<br>')
        : 'Nenhuma correção manual neste campo.')
        + (antigas ? `<br><span class="muted small">${antigas} correção(ões) anterior(es) sem o campo registrado — veja o Histórico na Conferência.</span>` : '');
    } catch (e) { el.querySelector('#rv-corr').textContent = 'Não foi possível consultar as correções.'; }
  }

  function painelConsolidado(chave) {
    const [titulo, fn, tipo, caminho, i] = CONSOL[chave];
    const validados = S.relatorios.filter((r) => r.status === 'validado');
    const base = ui.escopo === 'todos' ? S.relatorios : validados;
    const c = Regras.consolidar(base, fn);
    const f = tipo === 'brl' ? fmt.brl : fmt.int;
    const linhas = [...base].sort((a, b) => (fn(b) ?? -Infinity) - (fn(a) ?? -Infinity));
    const fora = S.relatorios.filter((r) => !base.includes(r));
    abrirPainel(titulo, `
      <p class="rv-valor">${f(c.total)}</p>
      <p>Soma de <strong>${c.n} de ${c.de}</strong> igrejas consideradas (${ui.escopo === 'todos' ? 'todos os relatórios recebidos' : 'somente validados'}). Igreja sem o dado não entra na soma — não é contada como zero.</p>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Igreja</th><th>Valor</th><th>Situação</th></tr></thead><tbody>
        ${linhas.map((r) => `<tr><td><a href="#/igreja/${esc(r.igreja.codigo)}">${esc(r.igreja.nome)}</a></td>
          <td>${temValor(fn(r)) ? rv(f(fn(r)), caminho, i, r.igreja.codigo) : '<span class="na">não informado</span>'}</td><td>${chip(r.status)}</td></tr>`).join('')}
      </tbody><tfoot><tr class="tot"><td>Total</td><td>${f(c.total)}</td><td>${c.n} de ${c.de}</td></tr></tfoot></table></div>
      ${fora.length ? `<p class="nota">Fora deste total por não estarem validados: ${fora.map((r) => esc(nomeCurto(r.igreja.nome))).join(', ')}.</p>` : ''}
      <p class="nota">Toque em um valor para ver de que linha do relatório ele veio.</p>`);
  }

  document.addEventListener('click', (e) => {
    const b = e.target.closest('.rv');
    if (!b || b.closest('.previa')) return; // na prévia os valores ainda não foram gravados
    if (b.dataset.consol) return painelConsolidado(b.dataset.consol);
    const cod = b.dataset.igreja || location.hash.split('/')[2];
    const r = relPorCodigo(decodeURIComponent(cod || ''));
    if (r) painelOrigem(r, b.dataset.campo, b.dataset.i != null ? +b.dataset.i : null);
  });

  // ---------- Navegação por perfil ----------
  function itensNav() {
    const p = S.perfil?.papel;
    const pend = S.relatorios.filter((r) => r.status !== 'validado').length;
    if (p === 'representante') {
      return [
        { id: 'igreja', href: `#/igreja/${S.perfil.igreja_codigo}`, label: 'Minha igreja', icon: 'igrejas' },
        { id: 'enviar', href: '#/enviar', label: 'Enviar', icon: 'enviar' },
        { id: 'perfil', href: '#/perfil', label: 'Perfil', icon: 'perfil' },
      ];
    }
    if (p === 'superadmin' || p === 'admin_nacional') {
      return [
        { id: 'nacional', href: '#/nacional', label: 'Nacional', icon: 'home' },
        ...(p === 'superadmin' ? [{ id: 'estrutura', href: '#/estrutura', label: 'Estrutura', icon: 'sinodo' }] : []),
        { id: 'perfil', href: '#/perfil', label: 'Perfil', icon: 'perfil' },
      ];
    }
    const base = [
      { id: 'inicio', href: '#/', label: 'Presbitério', icon: 'home' },
      { id: 'igrejas', href: '#/igrejas', label: 'Igrejas', icon: 'igrejas' },
      { id: 'pendencias', href: '#/pendencias', label: 'Conferência', icon: 'conferencia', badge: pend },
      { id: 'sinodo', href: '#/sinodo', label: 'Sínodo', icon: 'sinodo' },
      { id: 'perfil', href: '#/perfil', label: 'Perfil', icon: 'perfil' },
    ];
    if (p === 'admin_sinodal') return [base[3], base[0], base[1], base[4]];
    return base;
  }

  function render(v, ativo) {
    const nav = itensNav().map((i) => `<a href="${i.href}" class="nav-i${i.id === ativo ? ' on' : ''}"${i.id === ativo ? ' aria-current="page"' : ''}>
        <span class="nav-ic">${ic(i.icon)}${i.badge ? `<span class="badge">${i.badge}</span>` : ''}</span><span class="nav-l">${i.label}</span></a>`).join('');
    $app.innerHTML = `<div class="shell">
      <nav class="nav" aria-label="Navegação principal">
        <div class="brand"><img src="icons/logo_ipb.png" alt="Igreja Presbiteriana do Brasil"><small>Estatística · ${esc(S.presbiterio?.sigla || '')} ${S.ano}</small></div>
        ${nav}
      </nav>
      <header class="appbar">
        ${v.back ? `<a class="ab-back" href="${v.back}" aria-label="Voltar">${ic('voltar')}</a>` : ''}
        <div class="ab-t">${v.sub ? `<small>${v.sub}</small>` : ''}<h1>${v.title}</h1></div>
        ${S.modo === 'local' ? '<span class="modo" title="Dados lidos do arquivo local">local</span>' : ''}
        ${ativo !== 'ajuda' ? `<a class="ab-help" href="#/ajuda" aria-label="Ajuda" title="Ajuda">${ic('ajuda')}</a>` : ''}
      </header>
      <main class="content" id="conteudo">${v.body}</main>
    </div>`;
    window.scrollTo(0, 0);
    v.after?.();
  }

  function renderSimples(html) { $app.innerHTML = `<div class="solo">${html}</div>`; }

  // ---------- Login ----------
  function telaLogin(erro = '') {
    const local = S.modo === 'local';
    renderSimples(`<div class="login">
      <h1 class="login-logo"><img src="icons/logo_ipb.png" alt="Igreja Presbiteriana do Brasil"></h1>
      <p class="muted">Relatórios estatísticos das igrejas, consolidados por presbitério e sínodo.</p>
      ${erro ? `<p class="erro" role="alert">${esc(erro)}</p>` : ''}
      ${local ? `
        <div class="aviso-local"><strong>Modo local</strong> — os dados vêm do arquivo no seu computador. Escolha um perfil para simular o acesso:</div>
        <div class="perfis">
          <button class="btn primary" data-papel="admin_presbiterial">Administrador presbiterial</button>
          <button class="btn" data-papel="admin_sinodal">Administrador sinodal</button>
          <button class="btn" data-papel="representante">Representante de igreja</button>
        </div>` : `
        <form id="f-login" class="form">
          <label>E-mail<input type="email" name="email" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" inputmode="email" required></label>
          <label>Senha<input type="password" name="senha" id="senha" autocomplete="current-password" autocapitalize="none" autocorrect="off" spellcheck="false" required></label>
          <label class="conf"><input type="checkbox" id="ver-senha"> Mostrar senha</label>
          <button class="btn primary" type="submit">Entrar</button>
        </form>`}
      <a class="login-ajuda" href="#/ajuda">${ic('ajuda')}Como funciona o sistema?</a>
      <a class="login-priv" href="#/privacidade">Aviso de privacidade</a>
    </div>`);
    if (local) {
      $app.querySelectorAll('[data-papel]').forEach((b) => b.addEventListener('click', () => {
        Data.entrarLocal(b.dataset.papel); ui.carregado = false;
        location.hash = b.dataset.papel === 'admin_sinodal' ? '#/sinodo' : '#/';
        rota();
      }));
    } else {
      document.getElementById('ver-senha').addEventListener('change', (e) => { document.getElementById('senha').type = e.target.checked ? 'text' : 'password'; });
      document.getElementById('f-login').addEventListener('submit', async (e) => {
        e.preventDefault();
        const f = new FormData(e.target);
        const btn = e.target.querySelector('button[type=submit]'); btn.disabled = true; btn.textContent = 'Entrando…';
        // Teclados de celular costumam pôr maiúscula inicial ou espaço no fim do e-mail
        const email = String(f.get('email') || '').trim().toLowerCase();
        try { await Data.entrar(email, f.get('senha')); ui.carregado = false; location.hash = '#/'; rota(); } catch (err) { telaLogin(err.message); }
      });
    }
  }

  // ---------- Presbitério ----------
  function telaPresbiterio() {
    const todos = S.relatorios;
    const validados = todos.filter((r) => r.status === 'validado');
    const base = ui.escopo === 'todos' ? todos : validados;
    const parcial = validados.length < todos.length;

    // Cobertura por situação
    const porStatus = {};
    for (const r of todos) porStatus[r.status] = (porStatus[r.status] || 0) + 1;
    const faltam = Data.naoEnviadas();
    if (faltam.length) porStatus.nao_enviado = faltam.length;
    const cadastradas = Math.max(Data.enviamRelatorio().length, todos.length);
    const fechado = Data.exercicioFechado();
    const segs = ORDEM_STATUS.filter((s) => porStatus[s]).map((s) => `<span class="cs-seg st-${STATUS[s].cls}" style="flex:${porStatus[s]}" data-tip="${STATUS[s].label}: ${porStatus[s]}"></span>`).join('');
    const chipsStatus = ORDEM_STATUS.filter((s) => porStatus[s]).map((s) => `<a class="cob-i" href="#/pendencias">${chip(s)}<strong>${porStatus[s]}</strong></a>`).join('');

    const com = Regras.consolidar(base, (r) => T(r.dados.comungantes?.ano_atual));
    const comV = Regras.variacao(base, (r) => T(r.dados.comungantes?.ano_anterior), (r) => T(r.dados.comungantes?.ano_atual));
    const nc = Regras.consolidar(base, (r) => T(r.dados.nao_comungantes?.ano_atual));
    const ncV = Regras.variacao(base, (r) => T(r.dados.nao_comungantes?.ano_anterior), (r) => T(r.dados.nao_comungantes?.ano_atual));
    const rol = Regras.consolidar(base, (r) => T(r.dados.rol_atual));
    const ed = Regras.consolidar(base, (r) => r.dados.estrutura?.alunos_ed_atual);
    const edV = Regras.variacao(base, (r) => r.dados.estrutura?.alunos_ed_anterior, (r) => r.dados.estrutura?.alunos_ed_atual);
    const prof = Regras.consolidar(base, (r) => r.dados.estrutura?.professores_ed);
    const rec = Regras.consolidar(base, (r) => r.dados.financeiro?.realizado?.total_receita);
    const desp = Regras.consolidar(base, (r) => r.dados.financeiro?.realizado?.total_despesa);

    // Movimentação consolidada (comungantes)
    const somaTipo = (bloco) => {
      const acc = {};
      for (const r of base) for (const [k, v] of Object.entries(r.dados.comungantes?.[bloco] || {})) {
        if (Regras.DETALHE.has(k) || !Array.isArray(v) || !temValor(v[2])) continue;
        acc[k] = (acc[k] || 0) + v[2];
      }
      return Object.entries(acc).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ label: Regras.ROTULOS[k] || k, value: v }));
    };
    const adm = somaTipo('admissao'), dem = somaTipo('demissao');
    const totAdm = adm.reduce((s, i) => s + i.value, 0), totDem = dem.reduce((s, i) => s + i.value, 0);

    // Composição das despesas realizadas
    const somaDesp = (k) => Regras.consolidar(base, (r) => r.dados.financeiro?.realizado?.[k]).total;
    const nomeadas = Regras.COMPOSICAO_DESPESA.map(([k, l], i) => ({ label: l, value: somaDesp(k), slot: i + 1 }));
    const chavesNomeadas = new Set(Regras.COMPOSICAO_DESPESA.map(([k]) => k));
    const demais = Regras.DESPESAS.filter(([k]) => !chavesNomeadas.has(k)).reduce((s, [k]) => s + (somaDesp(k) || 0), 0);
    const compo = [...nomeadas, { label: 'Demais despesas', value: demais, slot: null }];

    const porIgreja = (fn) => base.map((r) => ({ label: nomeCurto(r.igreja.nome), value: fn(r), href: `#/igreja/${r.igreja.codigo}`, tip: `${r.igreja.nome}` }))
      .sort((a, b) => (b.value ?? -Infinity) - (a.value ?? -Infinity));
    const lid = (k) => Regras.consolidar(base, (r) => r.dados.lideranca?.[k]);

    const dTxt = (v) => (v && temValor(v.abs) ? `${fmt.sinal(v.abs)}${temValor(v.pct) ? ` (${fmt.pct(v.pct)})` : ''} no ano` : '');
    const body = `
      <section class="hero">
        <p class="kicker"><a href="#/sinodo">${esc(S.sinodo?.nome || 'Sínodo')}</a> › ${esc(S.presbiterio?.nome || '')} — relatórios estatísticos do exercício ${S.ano}, ${ui.escopo === 'todos' ? 'todos os recebidos' : 'somente os validados'}.</p>
        <h2>${rvc(fmt.int(rol.total), 'rol')} <small>membros</small></h2>
        <div class="metric-row">
          <div class="metric-pill"><span class="num">${rvc(fmt.int(com.total), 'com')}</span><span class="label">Comungantes</span><span class="d">${dTxt(comV)}</span></div>
          <div class="metric-pill"><span class="num">${rvc(fmt.int(nc.total), 'nc')}</span><span class="label">Não comungantes</span><span class="d">${dTxt(ncV)}</span></div>
          <div class="metric-pill"><span class="num">${base.length} <small>de ${cadastradas}</small></span><span class="label">Igrejas consideradas</span><span class="d">${validados.length} validados · ${todos.length} recebidos${faltam.length ? ` · ${faltam.length} ${faltam.length === 1 ? 'não enviou' : 'não enviaram'}` : ''}</span></div>
        </div>
        <div class="hero-ano">${seletorAno()}</div>
        <div class="seg" role="group" aria-label="Relatórios considerados">
          <button class="${ui.escopo === 'validados' ? 'on' : ''}" data-escopo="validados">Somente validados (${validados.length})</button>
          <button class="${ui.escopo === 'todos' ? 'on' : ''}" data-escopo="todos">Todos recebidos (${todos.length})</button>
        </div>
      </section>

      ${ui.escopo === 'todos'
        ? `<div class="banner warning" role="note"><b>!</b><div><strong>Inclui relatórios não validados.</strong> Use apenas para acompanhamento — ${todos.length - validados.length} relatórios ainda têm pendências.</div></div>`
        : fechado ? `<div class="banner info" role="note"><b>✓</b><div><strong>Exercício ${S.ano} fechado${S.exercicio.fechado_em ? ` em ${fmt.data(S.exercicio.fechado_em.slice(0, 10))}` : ''} — resultado oficial.</strong> Compõem o resultado ${validados.length} de ${cadastradas} igrejas (relatórios validados)${cadastradas > validados.length ? `; ${cadastradas - validados.length} ficaram de fora` : ''}.</div></div>`
        : (parcial || faltam.length) ? `<div class="banner info" role="note"><b>i</b><div><strong>Resultado parcial:</strong> ${validados.length} de ${cadastradas} igrejas têm relatório validado${faltam.length ? ` (${faltam.length} ainda não ${faltam.length === 1 ? 'enviou' : 'enviaram'})` : ''}. Os números abaixo consideram somente os validados.</div></div>` : ''}

      ${cardResumo(Resumo.presbiterio({ base, todos, naoEnviadas: faltam, cadastradas, ano: S.ano, escopo: ui.escopo, exercicio: S.exercicio, limiteVar: ui.limiteVar }))}

      ${card('Recebimento dos relatórios', `<div class="cs-bar">${segs}</div><div class="cob">${chipsStatus}</div>`, { sub: `Exercício ${S.ano} · ${fechado ? 'fechado' : 'aberto'} · ${todos.length} de ${cadastradas} igrejas enviaram` })}

      <div class="kpis k4">
        ${kpi('Alunos na Escola Dominical', rvc(fmt.int(ed.total), 'ed'), delta(edV), cobertura(ed))}
        ${kpi('Professores da Escola Dominical', rvc(fmt.int(prof.total), 'prof'), '', cobertura(prof))}
        ${kpi('Receita anual realizada', rvc(fmt.brlCurto(rec.total), 'rec'), '', cobertura(rec))}
        ${kpi('Despesa anual realizada', rvc(fmt.brlCurto(desp.total), 'desp'), '', cobertura(desp))}
      </div>

      ${cardEvolucao(S.historico.filter((l) => ui.escopo === 'todos' || l.status === 'validado'),
        { sub: `Por exercício · ${ui.escopo === 'todos' ? 'todos os relatórios recebidos' : 'somente relatórios validados'}` })}

      ${(() => {
        const rel = base.flatMap((r) => variacoes(r).filter((x) => x.relevante).map((x) => ({ r, x })))
          .sort((a, b) => (b.x.tipo === 'dado') - (a.x.tipo === 'dado') || Math.abs(b.x.pct) - Math.abs(a.x.pct));
        const sel = `<label class="lim">Alertar a partir de <select id="lim-var">${[0.1, 0.15, 0.2, 0.25, 0.3].map((p) => `<option value="${p}"${Math.abs(p - ui.limiteVar) < 0.001 ? ' selected' : ''}>${Math.round(p * 100)}%</option>`).join('')}</select> e ${Regras.LIMITES_VARIACAO.minimo} pessoas</label>`;
        return card('Variações relevantes no ano', `${sel}
          ${rel.length ? tabelaVariacoes(rel, { igreja: true }) : '<p class="vazio">Nenhuma variação acima do limite entre as igrejas consideradas.</p>'}
          <p class="nota">Compara o ano anterior com o ano atual informados no próprio relatório. “Alta/queda real”: a movimentação registrada (admissões − demissões) explica a mudança. “Informada”: o relatório não tem movimentação para conferir (ex.: Escola Dominical). “Verificar dado”: a mudança não é explicada pelo que foi registrado — provável erro no relatório. Regra fixa, sem estimativas.</p>`,
          { sub: `${rel.length} variação(ões) em ${new Set(rel.map((v) => v.r.igreja.codigo)).size} igreja(s) · ${ui.escopo === 'todos' ? 'todos os recebidos' : 'somente validados'}` });
      })()}

      <div class="grid2">
        ${card('Comungantes por igreja', Charts.barras(porIgreja((r) => T(r.dados.comungantes?.ano_atual)), { fmt: fmt.int }), { sub: 'Toque em uma igreja para abrir o painel dela' })}
        ${card('Receita anual realizada por igreja', Charts.barras(porIgreja((r) => r.dados.financeiro?.realizado?.total_receita), { fmt: fmt.brlCurto }), { sub: 'Total da receita anual, sem saldo anterior' })}
      </div>

      <div class="grid2">
        ${card('Movimentação de comungantes', `
          <div class="mov">
            <div><h3>Admissões <strong>${fmt.int(totAdm)}</strong></h3>${Charts.barras(adm, { fmt: fmt.int })}</div>
            <div><h3>Demissões <strong>${fmt.int(totDem)}</strong></h3>${Charts.barras(dem, { fmt: fmt.int, serie: 2 })}</div>
          </div>`, { sub: `Saldo do período: ${fmt.sinal(totAdm - totDem)} comungantes` })}
        ${card('Composição das despesas realizadas', Charts.composicao(compo, { fmt: fmt.brlCurto, rotuloTotal: 'Total das despesas' }))}
      </div>

      ${cardMapa([...todos.map((r) => ({ r, uf: r.igreja.uf })), ...faltam.map((i) => ({ r: null, uf: i.uf }))].map(({ r, uf }) => {
        // Uma linha por igreja, no mesmo formato dos totais por UF das visões do sínodo e nacional
        const val = r?.status === 'validado', rolV = val ? T(r.dados.rol_atual) : null;
        return { uf: uf || '—', igrejas: 1, recebidos: r ? 1 : 0, validados: val ? 1 : 0, rol: rolV, n_rol: rolV != null ? 1 : 0 };
      }))}

      ${card('Liderança formal', `<div class="mini">${Regras.LIDERANCA.map(([k, l]) => { const c = lid(k); return `<div><strong>${fmt.int(c.total)}</strong><span>${l}</span></div>`; }).join('')}</div>`)}

      ${(() => {
        const itens = [['ceia_total', 'Celebrações da Santa Ceia'], ['atividades_evangelisticas', 'Atividades evangelísticas'], ['textos_total', 'Textos distribuídos'],
          ['discipulados', 'Discipulados'], ['atos_beneficentes_total', 'Atos beneficentes'], ['visitas_total', 'Visitas']]
          .map(([k, l]) => ({ l, c: Regras.consolidar(base, (r) => r.dados.conselho?.[k]) }));
        return card('Vida ministerial', itens.some((x) => x.c.n)
          ? `<div class="mini">${itens.map((x) => `<div><strong>${fmt.int(x.c.total)}</strong><span>${x.l}</span><span>${x.c.n} de ${x.c.de} igrejas</span></div>`).join('')}</div>`
          : '<p class="vazio">Nenhum dos relatórios considerados trouxe a aba “Conselho ou Mesa”. Esses dados chegam quando a igreja envia o relatório completo em Excel.</p>',
        { sub: 'Da aba “Conselho ou Mesa” dos relatórios enviados em Excel · cada número mostra quantas igrejas informaram' });
      })()}

      ${card('Exportar', `<div class="btns exp">
          <button class="btn" data-exportar="excel">${ic('baixar')}Planilha Excel</button>
          <button class="btn" data-exportar="pdf">${ic('arquivo')}Resumo em PDF</button>
        </div>`, { sub: `Mesmos relatórios do painel: ${ui.escopo === 'todos' ? 'todos os recebidos' : 'somente os validados'} (${base.length} de ${todos.length})` })}

      <p class="nota">Campos vazios nos relatórios contam como <em>não informado</em>, não como zero. Cada indicador mostra quantas igrejas contribuíram para o total. Toque em um número sublinhado para ver de onde ele vem.</p>`;

    return {
      title: esc(S.presbiterio?.nome || 'Presbitério'), sub: `Exercício ${S.ano}`, body,
      after: () => {
        $app.querySelectorAll('[data-escopo]').forEach((b) => b.addEventListener('click', () => { ui.escopo = b.dataset.escopo; rota(); }));
        document.getElementById('lim-var')?.addEventListener('change', (e) => {
          ui.limiteVar = +e.target.value;
          try { localStorage.setItem('painel.limiteVar', String(ui.limiteVar)); } catch (err) { /* sem storage */ }
          const y = window.scrollY; rota(); window.scrollTo(0, y);
        });
        $app.querySelectorAll('[data-exportar]').forEach((b) => b.addEventListener('click', async () => {
          const html = b.innerHTML;
          b.disabled = true; b.innerHTML = '<span class="spin"></span>Gerando…';
          try {
            await Exportar[b.dataset.exportar]({ base, todos, escopo: ui.escopo, presbiterio: S.presbiterio, sinodo: S.sinodo, ano: S.ano,
              exercicio: S.exercicio, naoEnviadas: Data.naoEnviadas(), cadastradas, limiteVar: ui.limiteVar });
          } catch (e) { toast('Não foi possível exportar: ' + e.message); }
          b.disabled = false; b.innerHTML = html;
        }));
      },
    };
  }

  // ---------- Lista de igrejas ----------
  function telaIgrejas() {
    const rels = [...S.relatorios].sort((a, b) => a.igreja.nome.localeCompare(b.igreja.nome, 'pt-BR'));
    const itens = rels.map((r) => {
      const v = contaVerif(r);
      const erros = r.alertas.filter((a) => a.nivel === 'erro').length;
      return `<a class="item" href="#/igreja/${r.igreja.codigo}" data-busca="${esc((r.igreja.nome + ' ' + r.igreja.cidade + ' ' + r.igreja.codigo).toLowerCase())}">
        <div class="item-m">
          <strong>${esc(r.igreja.nome)}</strong>
          <span class="muted">${esc(r.igreja.cidade)} · ${esc(r.igreja.uf)}</span>
          <div class="item-s">${chip(r.status)}${erros || v.falhas ? `<span class="flag">${erros + v.falhas} ${erros + v.falhas === 1 ? 'pendência' : 'pendências'}</span>` : ''}${(() => {
            const n = variacoes(r).filter((x) => x.relevante).length;
            return n ? `<span class="flag alta">${n} ${n > 1 ? 'variações relevantes' : 'variação relevante'}</span>` : '';
          })()}</div>
        </div>
        <div class="item-n"><strong>${fmt.int(T(r.dados.rol_atual))}</strong><span>membros</span></div>
        ${ic('seta', 'chev')}
      </a>`;
    }).join('') + Data.naoEnviadas().map((i) => `<a class="item" href="#/enviar/${esc(i.codigo)}" data-busca="${esc((i.nome + ' ' + (i.cidade || '') + ' ' + i.codigo).toLowerCase())}">
        <div class="item-m">
          <strong>${esc(i.nome)}</strong>
          <span class="muted">${esc(i.cidade || '')}${i.uf ? ` · ${esc(i.uf)}` : ''}</span>
          <div class="item-s">${chip('nao_enviado')}<span class="flag">${Data.exercicioFechado() ? 'exercício fechado' : 'toque para enviar pela igreja'}</span></div>
        </div>${ic('seta', 'chev')}</a>`).join('');
    const faltam = Data.naoEnviadas().length;
    return {
      title: 'Igrejas', sub: `${rels.length} relatórios${faltam ? ` · ${faltam} não enviados` : ''} · ${S.ano}`,
      body: `${seletorAno()}<div class="btns">${Data.podeEnviar() && !Data.exercicioFechado() ? `<a class="btn primary" href="#/enviar">${ic('enviar')}Enviar relatório</a>` : ''}
        ${S.perfil.papel === 'admin_presbiterial' ? `<a class="btn" href="#/cadastro">${ic('igrejas')}Cadastro de igrejas</a>` : ''}</div>
        <label class="busca">${ic('busca')}<input type="search" id="q" placeholder="Buscar igreja ou cidade" autocomplete="off"></label>
        <div class="lista" id="lista">${itens}</div><p class="vazio" id="nada" hidden>Nenhuma igreja encontrada.</p>`,
      after: () => {
        const q = document.getElementById('q');
        q.addEventListener('input', () => {
          const t = q.value.trim().toLowerCase(); let n = 0;
          document.querySelectorAll('#lista .item').forEach((el) => { const ok = el.dataset.busca.includes(t); el.hidden = !ok; if (ok) n++; });
          document.getElementById('nada').hidden = n > 0;
        });
      },
    };
  }

  // ---------- Envio de relatório ----------
  const STATUS_ENVIO = {
    recebido: { label: 'Recebido · aguardando leitura', cls: 'warning', icon: '↓' },
    em_processamento: { label: 'Em processamento', cls: 'warning', icon: '⋯' },
    processado: { label: 'Lido · enviado para conferência', cls: 'good', icon: '✓' },
    rejeitado: { label: 'Rejeitado', cls: 'critical', icon: '!' },
  };
  const chipEnvio = (s) => { const x = STATUS_ENVIO[s] || STATUS_ENVIO.recebido; return `<span class="chip ${x.cls}"><b aria-hidden="true">${x.icon}</b>${x.label}</span>`; };
  const tamanho = (b) => (b >= 1048576 ? (b / 1048576).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB');

  function listaEnvios(envios, { igreja = true } = {}) {
    if (!envios.length) return '<p class="vazio">Nenhum arquivo enviado ainda.</p>';
    return `<ul class="envios">${envios.map((e) => `<li>
        <div class="env-m">
          <strong>${esc(e.arquivo_nome)}</strong>
          <span class="muted small">${igreja ? `${esc(e.igrejas?.nome || '')} · ` : ''}Exercício ${e.ano} · ${e.formato.toUpperCase()}${e.tipo_pdf ? ` ${esc(e.tipo_pdf)}` : ''} · ${tamanho(e.tamanho || 0)} · ${fmt.dataHora(e.enviado_em)}</span>
          <div class="item-s">${chipEnvio(e.status)}</div>
        </div>
        <div class="env-a">
          ${e.status === 'recebido' && !Data.exercicioFechado() && (e.formato === 'xlsx' || e.tipo_pdf === 'digital') && Data.podeEnviar() ? `<button class="btn" data-ler="${esc(e.id)}">Ler agora</button>` : ''}
          ${e.status === 'recebido' && !Data.exercicioFechado() && !(e.formato === 'pdf' && e.tipo_pdf === 'digital') && Data.podeValidar() ? `<a class="btn" href="#/digitar/${esc(e.id)}">Digitar dados</a>` : ''}
          <button class="btn ic-btn" data-baixar="${esc(e.caminho)}" aria-label="Baixar ${esc(e.arquivo_nome)}" title="Baixar arquivo original">${ic('baixar')}</button>
        </div>
      </li>`).join('')}</ul>`;
  }

  function checksHtml(checks) {
    const cls = { ok: 'ok', aviso: 'aviso', erro: 'falha' };
    const sim = { ok: '✓', aviso: '!', erro: '✕' };
    return `<ul class="vfs">${checks.map((c) => `<li class="vf ${cls[c.estado]}"><b aria-hidden="true">${sim[c.estado]}</b>
      <div><span>${esc(c.titulo)}</span>${c.detalhe ? `<small>${esc(c.detalhe)}</small>` : ''}</div></li>`).join('')}</ul>`;
  }

  // Prévia dos valores lidos, para o representante conferir antes de enviar (seção 6, passos 9 e 10)
  function previaHtml(leitura) {
    const d = leitura.dados;
    const verif = Regras.verificacoes(d);
    const falhas = verif.filter((x) => x.ok === false), conferidas = verif.filter((x) => x.ok !== null).length;
    // Campos inteiramente em branco no relatório (lidos como "não informado")
    const vazios = Dicionario.campos.filter((c) => c.aba === Dicionario.ABAS.CE && !c.pendente && !c.id.startsWith('identificacao.')).filter((c) => {
      const v = c.id.split('.').reduce((o, k) => (o == null ? undefined : o[k]), d);
      return v === null || (Array.isArray(v) && v.every((x) => x === null));
    }).map((c) => c.rotulo);
    const fr = d.financeiro?.realizado || {}, fp = d.financeiro?.previsto || {}, e = d.estrutura || {};
    const dep = [...Regras.DEPARTAMENTOS, ['totais', 'Totais']].map(([k, l]) => `<tr${k === 'totais' ? ' class="tot"' : ''}><td>${l}</td><td>${cel(d.departamentos?.[k]?.[0])}</td><td>${cel(d.departamentos?.[k]?.[1])}</td></tr>`).join('');
    const sec = (titulo, corpo, aberto = false) => `<details class="pv"${aberto ? ' open' : ''}><summary>${titulo}</summary><div class="pv-c">${corpo}</div></details>`;
    return `<div class="previa">
      <h3 class="pv-t">Prévia dos dados lidos</h3>
      <p class="nota">Confira se os números abaixo são os do relatório aprovado pelo Conselho. É assim que eles aparecerão no painel depois da validação.</p>
      ${falhas.length
        ? `<div class="banner warning" role="note"><b>!</b><div><strong>${falhas.length} soma(s) não conferem.</strong> Se possível, corrija no relatório e escolha o arquivo de novo.<ul class="vfs">${vfItens(falhas)}</ul></div></div>`
        : `<div class="banner info" role="note"><b>✓</b><div><strong>As ${conferidas} somas verificáveis conferem.</strong></div></div>`}
      <div class="kpis k4">
        ${kpi('Rol de membros', fmt.int(T(d.rol_atual)))}
        ${kpi('Comungantes', fmt.int(T(d.comungantes?.ano_atual)))}
        ${kpi('Receita realizada', fmt.brlCurto(fr.total_receita))}
        ${kpi('Despesa realizada', fmt.brlCurto(fr.total_despesa))}
      </div>
      ${sec('Membresia', `${tabelaEvolucao(d.comungantes || {}, d.nao_comungantes || {})}
        <h4>Comungantes</h4>${tabelaMov(d.comungantes, 'comungantes')}<h4>Não comungantes</h4>${tabelaMov(d.nao_comungantes, 'nao_comungantes')}`, true)}
      ${sec('Liderança, Escola Dominical e departamentos', `<div class="mini">${Regras.LIDERANCA.map(([k, l]) => `<div><strong>${fmt.int(d.lideranca?.[k])}</strong><span>${l}</span></div>`).join('')}</div>
        <div class="mini">${[['congregacoes', 'Congregações'], ['pontos_pregacao', 'Pontos de pregação'], ['escolas_dominicais', 'Escolas dominicais'], ['professores_ed', 'Professores da ED'],
          ['alunos_ed_atual', 'Alunos ED (atual)'], ['alunos_ed_anterior', 'Alunos ED (anterior)']].map(([k, l]) => `<div><strong>${fmt.int(e[k])}</strong><span>${l}</span></div>`).join('')}</div>
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Departamento</th><th>Nº deptos.</th><th>Nº membros</th></tr></thead><tbody>${dep}</tbody></table></div>`)}
      ${sec('Finanças (realizado e previsto)', tabelaFin(fr, fp))}
      ${d.conselho ? sec('Vida ministerial (aba do Conselho)', `<div class="mini">${[...MIN_ITENS.ceia, ...MIN_ITENS.evang, ...MIN_ITENS.educ, ...MIN_ITENS.social, ...MIN_ITENS.adm]
        .map(([k, l]) => `<div><strong>${fmt.int(d.conselho[k])}</strong><span>${l}</span></div>`).join('')}</div>`) : ''}
      ${sec(`Campos em branco no relatório (${vazios.length})`, vazios.length
        ? `<p class="nota">Ficam como <strong>não informado</strong> — não viram zero. Se algum deveria ter valor, corrija o relatório antes de enviar.</p><ul class="pv-vazios">${vazios.map((v) => `<li>${esc(v)}</li>`).join('')}</ul>`
        : '<p class="nota">Nenhum campo inteiramente em branco.</p>')}
    </div>`;
  }

  function telaEnviar(cod) {
    const rep = S.perfil.papel === 'representante';
    const igrejas = [...S.igrejas].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    const sel = igrejas.find((i) => i.codigo === cod) ? cod : (rep ? S.perfil.igreja_codigo : '');
    const anos = [S.ano + 1, S.ano, S.ano - 1];
    const envios = S.envios.filter((e) => !sel || e.igrejas?.codigo === sel);
    const local = S.modo === 'local';

    const body = `
      <p class="nota top">Envie o relatório estatístico <strong>já preenchido</strong> no modelo oficial, em PDF ou Excel. O sistema confere o arquivo e lê os números automaticamente (PDF digital); a conferência final é feita pela administração do presbitério.</p>
      ${local ? '<div class="banner warning" role="note"><b>!</b><div><strong>Modo local:</strong> a verificação do arquivo funciona, mas o envio só é possível no site publicado.</div></div>' : ''}
      ${Data.exercicioFechado() ? `<div class="banner warning" role="note"><b>■</b><div><strong>O exercício ${S.ano} está fechado.</strong> Não são aceitos novos relatórios de ${S.ano}. Se for necessário, peça ao administrador do presbitério para reabri-lo.</div></div>` : ''}
      ${card('1. Relatório', `<div class="campos">
          <label class="lbl">Igreja
            ${rep ? `<input type="text" value="${esc(igrejas[0]?.nome || '')}" disabled><input type="hidden" id="env-igreja" value="${esc(sel)}">`
              : `<select id="env-igreja"><option value="">Selecione a igreja…</option>${igrejas.map((i) => `<option value="${esc(i.codigo)}"${i.codigo === sel ? ' selected' : ''}>${esc(i.nome)}</option>`).join('')}</select>`}
          </label>
          <label class="lbl">Exercício
            <select id="env-ano">${anos.map((a) => `<option${a === S.ano ? ' selected' : ''}>${a}</option>`).join('')}</select>
          </label>
        </div>`)}
      ${card('2. Arquivo', `<label class="drop" id="drop">
          <input type="file" id="env-arq" accept=".pdf,.xlsx,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet">
          ${ic('enviar')}<strong id="drop-t">Escolher arquivo</strong><span class="muted small" id="drop-s">PDF ou Excel (.xlsx) · até 10 MB</span>
        </label>`)}
      <section class="card" id="verif" hidden>
        <header class="card-h"><h2>3. Verificação</h2><p id="verif-s">Analisando o arquivo…</p></header>
        <div id="verif-l"></div>
        <div id="previa"></div>
        <label class="conf" id="env-subst-l" hidden><input type="checkbox" id="env-subst"> <span id="env-subst-t"></span></label>
        <label class="conf"><input type="checkbox" id="env-conf"> <span id="env-conf-t">Confirmo que este é o relatório oficial aprovado pelo Conselho da igreja.</span></label>
        <button class="btn primary wide" id="env-btn" disabled>${ic('enviar')}Enviar relatório</button>
      </section>
      ${card('Envios anteriores', listaEnvios(envios, { igreja: !sel }), { sub: sel ? esc(igrejas.find((i) => i.codigo === sel)?.nome || '') : 'Todas as igrejas' })}`;

    return {
      title: 'Enviar relatório', sub: rep ? esc(igrejas[0]?.nome || '') : `${esc(S.presbiterio?.sigla || '')} · envio de relatórios`,
      back: rep ? null : (sel ? `#/igreja/${sel}` : '#/igrejas'),
      body,
      after: () => ligarEnvio(),
    };
  }

  function ligarEnvio() {
    const $ig = document.getElementById('env-igreja'), $ano = document.getElementById('env-ano');
    const $arq = document.getElementById('env-arq'), $conf = document.getElementById('env-conf'), $btn = document.getElementById('env-btn');
    const $verif = document.getElementById('verif'), $lista = document.getElementById('verif-l'), $res = document.getElementById('verif-s');
    const $substL = document.getElementById('env-subst-l'), $subst = document.getElementById('env-subst');
    let analise = null, rodada = 0;

    const anoFechado = () => Data.exercicioFechado() && +$ano.value === S.ano;
    const atualizarBotao = () => {
      $btn.disabled = !(analise && !analise.bloqueia && $ig.value && $conf.checked && !anoFechado() && (!analise.substitui || $subst.checked));
    };

    async function analisar() {
      const file = $arq.files[0];
      if (!file) return;
      document.getElementById('drop-t').textContent = file.name;
      document.getElementById('drop-s').textContent = tamanho(file.size) + ' · toque para trocar';
      $verif.hidden = false; $lista.innerHTML = '<div class="carregando dark"><span class="spin"></span>Analisando…</div>'; $res.textContent = 'Analisando o arquivo…';
      document.getElementById('previa').innerHTML = ''; $conf.checked = false; $subst.checked = false; $substL.hidden = true;
      analise = null; atualizarBotao();
      const minha = ++rodada;
      const igreja = S.igrejas.find((i) => i.codigo === $ig.value) || { nome: '' };
      try {
        const a = await Envio.analisar(file, { igreja, ano: +$ano.value, siglas: { sinodo: S.sinodo?.sigla, presbiterio: S.presbiterio?.sigla } });
        if (minha !== rodada) return;
        if (!$ig.value) { a.checks.unshift({ estado: 'erro', titulo: 'Igreja', detalhe: 'Selecione a igreja do relatório.' }); }
        if (a.sha256 && $ig.value) {
          const dup = await Data.envioExiste($ig.value, +$ano.value, a.sha256);
          if (dup) { a.checks.push({ estado: 'erro', titulo: 'Arquivo já enviado', detalhe: `Este mesmo arquivo foi enviado em ${fmt.dataHora(dup.enviado_em)}.` }); a.bloqueia = true; }
          else a.checks.push({ estado: 'ok', titulo: 'Arquivo novo', detalhe: 'Nenhum envio idêntico para esta igreja e exercício.' });
        }
        if (!a.bloqueia && $ig.value) {
          const atual = await Data.relatorioAtual($ig.value, +$ano.value);
          if (minha !== rodada) return;
          if (atual) {
            const sit = Regras.STATUS[atual.status]?.label.toLowerCase() || atual.status;
            a.substitui = atual;
            a.checks.push({ estado: 'aviso', titulo: 'Já existe relatório deste exercício',
              detalhe: `Esta igreja já tem a versão ${atual.versao} (${sit}). Este envio cria a versão ${atual.versao + 1}, que volta para conferência; a versão ${atual.versao} fica no histórico como substituída.` });
            document.getElementById('env-subst-t').textContent = `Quero substituir a versão ${atual.versao} (${sit}) por este arquivo.`;
            $substL.hidden = false;
          }
        }
        analise = a;
        const erros = a.checks.filter((c) => c.estado === 'erro').length, avisos = a.checks.filter((c) => c.estado === 'aviso').length;
        $res.textContent = erros ? `${erros} problema(s) impedem o envio` : avisos ? `Pode enviar · ${avisos} aviso(s) para a conferência` : 'Tudo certo para enviar';
        $lista.innerHTML = checksHtml(a.checks);
        const temPrevia = !!(a.leitura?.ok && !a.bloqueia);
        document.getElementById('previa').innerHTML = temPrevia ? previaHtml(a.leitura) : '';
        document.getElementById('env-conf-t').textContent = temPrevia
          ? 'Conferi os valores da prévia e confirmo que este é o relatório oficial aprovado pelo Conselho da igreja.'
          : 'Confirmo que este é o relatório oficial aprovado pelo Conselho da igreja.';
      } catch (e) {
        $lista.innerHTML = `<p class="erro">Não foi possível analisar: ${esc(e.message)}</p>`;
      }
      atualizarBotao();
    }

    $arq.addEventListener('change', analisar);
    $ig.addEventListener?.('change', analisar);
    $ano.addEventListener('change', analisar);
    $conf.addEventListener('change', atualizarBotao);
    $subst.addEventListener('change', atualizarBotao);
    $btn.addEventListener('click', async () => {
      if (!analise || analise.bloqueia) return;
      $btn.disabled = true; $btn.innerHTML = '<span class="spin"></span>Enviando…';
      try {
        const { lido } = await Data.enviarRelatorio({ codigo: $ig.value, ano: +$ano.value, file: $arq.files[0], analise });
        toast(lido ? 'Relatório enviado e lido. Os números já aparecem no painel, aguardando conferência.' : 'Relatório enviado. A administração fará a leitura e a conferência.');
        rota();
      } catch (e) {
        toast(e.message); $btn.innerHTML = `${ic('enviar')}Enviar relatório`; atualizarBotao();
      }
    });
  }

  // ---------- Igreja ----------
  const ABAS = [['geral', 'Visão geral'], ['membresia', 'Membresia'], ['educacao', 'Educação'], ['financas', 'Finanças'], ['ministerio', 'Ministério'], ['conferencia', 'Conferência']];
  const formatoTxt = (r) => (r.tipo_pdf ? `PDF ${r.tipo_pdf}` : /\.xlsx$/i.test(r.arquivo || '') ? 'Excel' : 'arquivo');

  // Vida ministerial e administração: aba "Conselho ou Mesa" (só existe em relatórios enviados em Excel)
  const MIN_ITENS = {
    ceia: [['ceia_grupos', 'Ceias em grupo'], ['ceia_individuos', 'Ceias a indivíduos'], ['ceia_total', 'Total']],
    evang: [['atividades_evangelisticas', 'Atividades evangelísticas'], ['biblias', 'Bíblias'], ['novos_testamentos', 'Novos Testamentos'], ['folhetos', 'Folhetos'], ['outras_literaturas', 'Outras literaturas'], ['textos_total', 'Textos (total)']],
    educ: [['grupos_corais', 'Grupos corais'], ['conjuntos_musicais', 'Conjuntos musicais'], ['discipulados', 'Discipulados']],
    social: [['atos_beneficentes_junta', 'Atos da Junta Diaconal'], ['atos_beneficentes_outros', 'Atos de outros deptos.'], ['atos_beneficentes_total', 'Atos (total)'],
      ['visitas_oficiais', 'Visitas de oficiais'], ['visitas_outros', 'Visitas de outros deptos.'], ['visitas_total', 'Visitas (total)']],
    adm: [['reunioes_conselho', 'Reuniões do Conselho'], ['reunioes_junta', 'Reuniões da Junta'], ['reunioes_assembleia', 'Assembleias'], ['reunioes_exame_contas', 'Exame de contas'],
      ['mandato_vencer_presbiteros', 'Presbíteros c/ mandato a vencer'], ['mandato_vencer_diaconos', 'Diáconos c/ mandato a vencer']],
  };
  function telaMinisterio(r) {
    const m = r.dados.conselho;
    if (!m) {
      return card('Vida ministerial e administração', `<p>Estes dados vêm da aba <strong>“Conselho ou Mesa”</strong> do relatório em Excel.
        ${/\.xlsx$/i.test(r.arquivo || '') ? 'Nesta planilha essa aba está vazia.' : 'Este relatório foi recebido em PDF, que traz apenas o Cadastro & Estatística.'}</p>
        <p class="nota">Para ver Santa Ceia, evangelização, visitas, reuniões e planejamento, envie o relatório completo em Excel (.xlsx).</p>`);
    }
    const mini = (bloco, itens, raiz = 'conselho') => `<div class="mini">${itens.map(([k, l]) => `<div><strong>${rv(fmt.int(bloco[k]), `${raiz}.${k}`)}</strong><span>${l}</span></div>`).join('')}</div>`;
    const textos = (bloco, itens) => { const dl = itens.filter(([k]) => bloco[k]).map(([k, l]) => `<dt>${l}</dt><dd>${esc(bloco[k])}</dd>`).join(''); return dl ? `<dl class="dl">${dl}</dl>` : ''; };
    const fonte = `${ic('arquivo')} Fonte: ${esc(r.arquivo)} · aba “Conselho ou Mesa”`;
    const cg = r.dados.congregacao_anexo;
    return `
      <div class="kpis k4">
        ${kpi('Celebrações da Santa Ceia', fmt.int(m.ceia_total))}
        ${kpi('Atividades evangelísticas', fmt.int(m.atividades_evangelisticas))}
        ${kpi('Visitas', fmt.int(m.visitas_total))}
        ${kpi('Atos beneficentes', fmt.int(m.atos_beneficentes_total))}
      </div>
      ${card('Adoração e comunhão', mini(m, MIN_ITENS.ceia), { fonte })}
      ${card('Evangelização e missões', mini(m, MIN_ITENS.evang) + textos(m, [['outra_participacao_missionaria', 'Outra participação missionária']]), { fonte })}
      ${card('Educação e música', mini(m, MIN_ITENS.educ), { fonte })}
      ${card('Ação social e visitação', mini(m, MIN_ITENS.social), { fonte })}
      ${card('Administração', mini(m, MIN_ITENS.adm) + textos(m, [['conselheiros_sociedades', 'Conselheiros das sociedades'], ['causas_extralocais', 'Causas extralocais'],
        ['reforma_projeto', 'Reforma/construção em projeto'], ['reforma_andamento', 'Reforma/construção em andamento']]), { fonte })}
      ${textos(m, [['objetivos_alcancados', 'Objetivos alcançados'], ['objetivos_nao_alcancados', 'Objetivos não alcançados e dificuldades']]) ? card('Planejamento estratégico',
        textos(m, [['objetivos_alcancados', 'Objetivos alcançados'], ['objetivos_nao_alcancados', 'Objetivos não alcançados e dificuldades']]), { fonte }) : ''}
      ${cg ? card(`Congregação${cg.nome ? `: ${esc(cg.nome)}` : ''}`, mini(cg, [...MIN_ITENS.ceia.slice(2), ['atividades_evangelisticas', 'Atividades evangelísticas'], ['visitas_total', 'Visitas'], ['atos_beneficentes_total', 'Atos beneficentes']], 'congregacao_anexo'),
        { sub: 'Anexo “Congregação” — mostrado à parte e não somado aos totais da igreja, para não contar duas vezes' }) : ''}
      <p class="nota">As perguntas Sim/Não do relatório (documentação, previdência, seguro, planejamento) são caixas de seleção no Excel e ainda não são lidas automaticamente.</p>`;
  }

  function telaIgreja(cod, aba = 'geral') {
    const r = relPorCodigo(cod);
    if (!r) {
      // Sem relatório no exercício escolhido (ou sem acesso): oferece trocar de ano ou enviar
      const temOutroAno = S.historico.some((l) => l.codigo === cod);
      return { title: 'Sem relatório', sub: `Exercício ${S.ano}`, back: S.perfil.papel === 'representante' ? null : '#/igrejas',
        body: `${seletorAno()}${card('', `<p>Não há relatório de <strong>${S.ano}</strong> para esta igreja${temOutroAno ? ' — escolha outro exercício acima para ver os anteriores' : ' ou você não tem acesso a ele'}.</p>
          ${Data.podeEnviar() && !Data.exercicioFechado() ? `<a class="btn primary" href="#/enviar/${esc(cod)}">${ic('enviar')}Enviar relatório de ${S.ano}</a>` : ''}`)}` };
    }
    const d = r.dados;
    const v = contaVerif(r);
    const pend = r.alertas.length + v.falhas;
    const abas = ABAS.map(([id, l]) => `<a href="#/igreja/${cod}/${id}" class="${id === aba ? 'on' : ''}"${id === aba ? ' aria-current="page"' : ''}>${l}${id === 'conferencia' && pend ? ` <span class="badge">${pend}</span>` : ''}</a>`).join('');
    const fonte = (sec) => `${ic('arquivo')} Fonte: ${esc(r.arquivo)} · ${r.tipo_pdf || !/\.xlsx$/i.test(r.arquivo || '') ? sec : 'aba “Cadastro & Estatística”'}`;

    let corpo = '';
    if (aba === 'geral') {
      const comV = Regras.variacao([r], () => T(d.comungantes?.ano_anterior), () => T(d.comungantes?.ano_atual));
      const ncV = Regras.variacao([r], () => T(d.nao_comungantes?.ano_anterior), () => T(d.nao_comungantes?.ano_atual));
      const edV = Regras.variacao([r], () => d.estrutura?.alunos_ed_anterior, () => d.estrutura?.alunos_ed_atual);
      const fr = d.financeiro?.realizado || {};
      corpo = `
        <div class="kpis">
          ${kpi('Rol de membros', rv(fmt.int(T(d.rol_atual)), 'rol_atual', 2))}
          ${kpi('Comungantes', rv(fmt.int(T(d.comungantes?.ano_atual)), 'comungantes.ano_atual', 2), delta(comV))}
          ${kpi('Não comungantes', rv(fmt.int(T(d.nao_comungantes?.ano_atual)), 'nao_comungantes.ano_atual', 2), delta(ncV))}
          ${kpi('Alunos na Escola Dominical', rv(fmt.int(d.estrutura?.alunos_ed_atual), 'estrutura.alunos_ed_atual'), delta(edV))}
          ${kpi('Receita anual realizada', rv(fmt.brlCurto(fr.total_receita), 'financeiro.realizado.total_receita'))}
          ${kpi('Despesa anual realizada', rv(fmt.brlCurto(fr.total_despesa), 'financeiro.realizado.total_despesa'))}
        </div>
        ${card('Liderança formal', `<div class="mini">${Regras.LIDERANCA.map(([k, l]) => `<div><strong>${rv(fmt.int(d.lideranca?.[k]), `lideranca.${k}`)}</strong><span>${l}</span></div>`).join('')}</div>`, { fonte: fonte('pág. 1 · seção II') })}
        ${card('Estrutura do trabalho', `<div class="mini">
          <div><strong>${rv(fmt.int(d.estrutura?.congregacoes), 'estrutura.congregacoes')}</strong><span>Congregações</span></div>
          <div><strong>${rv(fmt.int(d.estrutura?.pontos_pregacao), 'estrutura.pontos_pregacao')}</strong><span>Pontos de pregação</span></div>
          <div><strong>${rv(fmt.int(d.estrutura?.escolas_dominicais), 'estrutura.escolas_dominicais')}</strong><span>Escolas dominicais</span></div>
          <div><strong>${rv(fmt.int(d.departamentos?.totais?.[0]), 'departamentos.totais', 0)}</strong><span>Departamentos internos</span></div>
        </div>`, { fonte: fonte('pág. 1 · seção II') })}
        ${cardEvolucao(S.historico.filter((l) => l.codigo === cod), { titulo: 'Evolução da igreja', sub: 'Por exercício (relatórios recebidos)', igreja: true })}
        ${card('Variações no ano', tabelaVariacoes(variacoes(r).map((x) => ({ r, x }))),
          { sub: `Ano anterior × ano atual · relevante a partir de ${Math.round(ui.limiteVar * 100)}% e ${Regras.LIMITES_VARIACAO.minimo} pessoas${variacoes(r).some((x) => x.relevante) ? '' : ' · nenhuma variação relevante'}` })}
        <p class="nota">Toque em um número sublinhado para ver a origem: documento, página ou célula, extração, validação e correções.</p>`;
    } else if (aba === 'membresia') {
      const c = d.comungantes || {}, nc = d.nao_comungantes || {};
      corpo = `
        ${card('Rol atual', `<div class="sexos">${Charts.sexo(c.ano_atual, 'Comungantes')}${Charts.sexo(nc.ano_atual, 'Não comungantes')}${Charts.sexo(d.rol_atual, 'Rol total')}</div>`, { fonte: fonte('pág. 1 · seção III') })}
        ${card('Evolução no exercício', tabelaEvolucao(c, nc))}
        ${card('Movimentação — comungantes', tabelaMov(c, 'comungantes'), { fonte: fonte('pág. 1 · seção III') })}
        ${card('Movimentação — não comungantes', tabelaMov(nc, 'nao_comungantes'), { fonte: fonte('pág. 1 · seção III') })}`;
    } else if (aba === 'educacao') {
      const e = d.estrutura || {};
      const edV = Regras.variacao([r], () => e.alunos_ed_anterior, () => e.alunos_ed_atual);
      const razao = temValor(e.alunos_ed_atual) && e.professores_ed ? e.alunos_ed_atual / e.professores_ed : null;
      const deps = Regras.DEPARTAMENTOS.map(([k, l]) => ({ label: l, value: d.departamentos?.[k]?.[1] ?? null, n: d.departamentos?.[k]?.[0] ?? null }));
      corpo = `
        <div class="kpis k4">
          ${kpi('Alunos (ano atual)', rv(fmt.int(e.alunos_ed_atual), 'estrutura.alunos_ed_atual'), delta(edV))}
          ${kpi('Alunos (ano anterior)', rv(fmt.int(e.alunos_ed_anterior), 'estrutura.alunos_ed_anterior'))}
          ${kpi('Professores', rv(fmt.int(e.professores_ed), 'estrutura.professores_ed'))}
          ${kpi('Alunos por professor', temValor(razao) ? razao.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) : '—')}
        </div>
        ${card('Membros nas sociedades internas', Charts.barras(deps.map((x) => ({ label: x.label, value: x.value, tip: `${x.label}: ${fmt.int(x.value)} membros · ${fmt.int(x.n)} departamento(s)` })), { fmt: fmt.int }),
          { sub: `Total informado: ${fmt.int(d.departamentos?.totais?.[1])} membros em ${fmt.int(d.departamentos?.totais?.[0])} departamentos`, fonte: fonte('pág. 1 · seção II') })}`;
    } else if (aba === 'financas') {
      const fr = d.financeiro?.realizado || {}, fp = d.financeiro?.previsto || {};
      const compo = [...Regras.COMPOSICAO_DESPESA.map(([k, l], i) => ({ label: l, value: fr[k], slot: i + 1 }))];
      const nomeadas = new Set(Regras.COMPOSICAO_DESPESA.map(([k]) => k));
      compo.push({ label: 'Demais despesas', value: Regras.somaCampos(fr, Regras.DESPESAS.filter(([k]) => !nomeadas.has(k))) || 0, slot: null });
      corpo = `
        <div class="kpis k4">
          ${kpi('Receita realizada', fmt.brlCurto(fr.total_receita))}
          ${kpi('Despesa realizada', fmt.brlCurto(fr.total_despesa))}
          ${kpi('Saldo final realizado', fmt.brlCurto(fr.saldo_seguinte))}
          ${kpi('Receita prevista', fmt.brlCurto(fp.total_receita))}
        </div>
        ${card('Composição das despesas realizadas', Charts.composicao(compo, { fmt: fmt.brlCurto, rotuloTotal: 'Total das despesas' }), { fonte: fonte('pág. 2 · seção IV') })}
        ${card('Realizado × previsto', tabelaFin(fr, fp), { sub: 'Realizado = movimento financeiro informado · Previsto = previsão orçamentária do próximo exercício', fonte: fonte('pág. 2 · seção IV') })}`;
    } else if (aba === 'ministerio') {
      corpo = telaMinisterio(r);
    } else {
      corpo = telaConferencia(r);
    }

    const head = `<section class="card ig-head">
        <div class="ig-top">${chip(r.status)}${seletorAno()}</div>
        <p class="muted">${esc(r.igreja.cidade)} · ${esc(r.igreja.uf)} · organizada em ${fmt.data(r.igreja.organizacao)}</p>
        <p class="muted small">${ic('arquivo')} ${esc(r.arquivo)} · ${esc(formatoTxt(r))} · ${esc(r.modelo || 'modelo não identificado')}</p>
        <div class="btns ig-acoes">
          ${Data.podeEnviar() && !Data.exercicioFechado() ? `<a class="btn" href="#/enviar/${esc(cod)}">${ic('enviar')}Enviar novo relatório</a>` : ''}
          <button class="btn" id="pdf-igreja">${ic('baixar')}Relatório em PDF</button>
        </div>
      </section>
      <nav class="tabs" aria-label="Seções">${abas}</nav>`;

    return {
      title: esc(r.igreja.nome), sub: `Relatório ${r.ano}`,
      back: S.perfil.papel === 'representante' ? null : '#/igrejas',
      body: head + corpo,
      after: () => {
        ligarConferencia(r);
        const b = document.getElementById('pdf-igreja');
        b.addEventListener('click', async () => {
          const html = b.innerHTML;
          b.disabled = true; b.innerHTML = '<span class="spin"></span>Gerando…';
          try { await Exportar.pdfIgreja(r, { presbiterio: S.presbiterio, sinodo: S.sinodo, exercicio: S.exercicio, limiteVar: ui.limiteVar }); }
          catch (e) { toast('Não foi possível gerar o PDF: ' + e.message); }
          b.disabled = false; b.innerHTML = html;
        });
      },
    };
  }

  const cel = (v) => (temValor(v) ? fmt.int(v) : '<span class="na" title="Não informado">—</span>');

  // Célula tocável (rastreabilidade): mostra "—" quando não informado
  const celRv = (v, caminho, i) => rv(cel(v), caminho, i);

  function tabelaMov(bloco, sec) {
    const trio = (v, caminho) => [0, 1, 2].map((i) => `<td>${i === 2 ? '<strong>' : ''}${celRv(v[i], caminho, i)}${i === 2 ? '</strong>' : ''}</td>`).join('');
    const linhas = (grupo, titulo) => {
      const ent = Object.entries(bloco?.[grupo] || {}).filter(([, v]) => Array.isArray(v));
      if (!ent.length) return '';
      return `<tr class="grp"><th colspan="4">${titulo}</th></tr>` + ent.map(([k, v]) => `<tr${Regras.DETALHE.has(k) ? ' class="det"' : ''}><td>${esc(Regras.ROTULOS[k] || k)}</td>${trio(v, `${sec}.${grupo}.${k}`)}</tr>`).join('');
    };
    return `<div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>Movimento</th><th>Masc.</th><th>Fem.</th><th>Total</th></tr></thead>
      <tbody>${linhas('admissao', 'Admissões')}${linhas('demissao', 'Demissões')}
        ${bloco?.rol_separado ? `<tr class="grp"><th colspan="4">Outros</th></tr><tr><td>Rol separado</td>${trio(bloco.rol_separado, `${sec}.rol_separado`)}</tr>` : ''}
      </tbody></table></div>
      <p class="legenda"><span class="na">—</span> não informado no relatório · 0 informado como zero · toque em um número para ver a origem</p>`;
  }

  function tabelaEvolucao(c, nc) {
    const linha = (nome, b, sec) => `<tr><td>${nome}</td><td>${celRv(T(b.ano_anterior), `${sec}.ano_anterior`, 2)}</td><td>${celRv(T(b.diferenca), `${sec}.diferenca`, 2)}</td><td><strong>${celRv(T(b.ano_atual), `${sec}.ano_atual`, 2)}</strong></td></tr>`;
    return `<div class="tbl-wrap"><table class="tbl">
      <thead><tr><th></th><th>Ano anterior</th><th>Diferença</th><th>Ano atual</th></tr></thead>
      <tbody>${linha('Comungantes', c, 'comungantes')}${linha('Não comungantes', nc, 'nao_comungantes')}</tbody></table></div>`;
  }

  function tabelaFin(fr, fp) {
    const brl = (v, caminho) => rv(temValor(v) ? fmt.brl(v) : '<span class="na" title="Não informado">—</span>', caminho);
    const linha = (l, k, forte) => `<tr${forte ? ' class="tot"' : ''}><td>${l}</td><td>${brl(fr[k], `financeiro.realizado.${k}`)}</td><td>${brl(fp[k], `financeiro.previsto.${k}`)}</td></tr>`;
    return `<div class="tbl-wrap"><table class="tbl fin">
      <thead><tr><th>Item</th><th>Realizado</th><th>Previsto</th></tr></thead>
      <tbody>
        ${linha('Saldo anterior', 'saldo_anterior', true)}
        <tr class="grp"><th colspan="3">Receitas</th></tr>
        ${Regras.RECEITAS.map(([k, l]) => linha(l, k)).join('')}
        ${linha('Total da receita anual', 'total_receita', true)}
        ${linha('Grande total', 'grande_total', true)}
        <tr class="grp"><th colspan="3">Despesas</th></tr>
        ${Regras.DESPESAS.map(([k, l]) => linha(l, k)).join('')}
        ${linha('Total da despesa anual', 'total_despesa', true)}
        ${linha('Saldo para o ano seguinte', 'saldo_seguinte', true)}
      </tbody></table></div>`;
  }

  // ---------- Digitação / correção manual ----------
  const ESTRUTURA_ED = [['congregacoes', 'Congregações'], ['pontos_pregacao', 'Pontos de pregação'], ['escolas_dominicais', 'Escolas dominicais'],
    ['professores_ed', 'Professores da ED'], ['alunos_ed_atual', 'Alunos da ED (ano atual)'], ['alunos_ed_anterior', 'Alunos da ED (ano anterior)']];
  const MOV_ED = {
    comungantes: {
      admissao: ['profissao_fe', 'profissao_fe_batismo', 'transferencia', 'jurisdicao', 'restauracao', 'designacao_presbiterio'],
      demissao: ['transferencia', 'falecimento', 'exclusao', 'ordenacao'],
      totais: [['rol_separado', 'Rol separado'], ['diferenca', 'Diferença (admissões − demissões)'], ['ano_anterior', 'Ano anterior'], ['ano_atual', 'Ano atual']],
    },
    nao_comungantes: {
      admissao: ['batismo', 'transferencia', 'jurisdicao_ex_officio'],
      demissao: ['profissao_fe', 'transferencia', 'falecimento', 'exclusao'],
      totais: [['diferenca', 'Diferença (admissões − demissões)'], ['ano_anterior', 'Ano anterior'], ['ano_atual', 'Ano atual']],
    },
  };
  const DADOS_VAZIOS = () => ({ lideranca: {}, estrutura: {}, departamentos: {}, comungantes: { admissao: {}, demissao: {} },
    nao_comungantes: { admissao: {}, demissao: {} }, financeiro: { realizado: {}, previsto: {} } });
  const obter = (o, path) => path.reduce((x, k) => (x == null ? undefined : x[k]), o);
  const definir = (o, path, v) => { const pai = path.slice(0, -1).reduce((x, k) => (x[k] && typeof x[k] === 'object' ? x[k] : (x[k] = {})), o); pai[path[path.length - 1]] = v; };

  function campoEd(path, i, v, rot, tipo = 'int') {
    const txt = temValor(v) ? (tipo === 'int' ? String(v) : v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })) : '';
    // Diferenças e saldos podem ser negativos: teclado completo (o numérico do celular não tem "−")
    const neg = /diferenca|saldo/.test(path);
    return `<input class="ed-in${tipo === 'brl' ? ' brl' : ''}" data-p="${path}"${i != null ? ` data-i="${i}"` : ''} data-r="${esc(rot)}" value="${txt}"
      inputmode="${neg ? 'text' : tipo === 'brl' ? 'decimal' : 'numeric'}" autocomplete="off" aria-label="${esc(rot)}">`;
  }

  function edLista(sec, lista, d) {
    return `<div class="tbl-wrap"><table class="tbl ed"><tbody>${lista.map(([k, l]) => `<tr><td>${l}</td><td>${campoEd(`${sec}.${k}`, null, d?.[k], l)}</td></tr>`).join('')}</tbody></table></div>`;
  }

  function edDepartamentos(d) {
    const linhas = [...Regras.DEPARTAMENTOS, ['totais', 'Totais']];
    return `<div class="tbl-wrap"><table class="tbl ed"><thead><tr><th>Departamento</th><th>Nº deptos.</th><th>Nº membros</th></tr></thead><tbody>
      ${linhas.map(([k, l]) => `<tr${k === 'totais' ? ' class="tot"' : ''}><td>${l}</td>${[0, 1].map((i) => `<td>${campoEd(`departamentos.${k}`, i, d?.[k]?.[i], `${l} · ${i ? 'membros' : 'deptos.'}`)}</td>`).join('')}</tr>`).join('')}
      </tbody></table></div>`;
  }

  function edTrio(sec, d, rol) {
    const nome = sec === 'comungantes' ? 'Comungantes' : 'Não comungantes';
    const linha = (path, l, v, cls = '') => `<tr${cls ? ` class="${cls}"` : ''}><td>${esc(l)}</td>${[0, 1, 2].map((i) => `<td>${campoEd(path, i, v?.[i], `${nome} · ${l} · ${['masc.', 'fem.', 'total'][i]}`)}</td>`).join('')}</tr>`;
    const grupo = (g, titulo) => {
      // linhas do modelo + linhas extras que o documento trouxe (formulários alterados)
      const chaves = [...new Set([...MOV_ED[sec][g], ...Object.keys(d?.[g] || {}).filter((k) => Array.isArray(d[g][k]))])];
      return `<tr class="grp"><th colspan="4">${titulo}</th></tr>` + chaves.map((k) => linha(`${sec}.${g}.${k}`, Regras.ROTULOS[k] || k, d?.[g]?.[k], Regras.DETALHE.has(k) ? 'det' : '')).join('');
    };
    return `<div class="tbl-wrap"><table class="tbl ed"><thead><tr><th>Movimento</th><th>Masc.</th><th>Fem.</th><th>Total</th></tr></thead><tbody>
      ${grupo('admissao', 'Admissões')}${grupo('demissao', 'Demissões')}
      <tr class="grp"><th colspan="4">Totais</th></tr>${MOV_ED[sec].totais.map(([k, l]) => linha(`${sec}.${k}`, l, d?.[k], k === 'ano_atual' ? 'tot' : '')).join('')}
      ${sec === 'nao_comungantes' ? `<tr class="grp"><th colspan="4">Rol atual (comungantes + não comungantes)</th></tr>${linha('rol_atual', 'Rol atual', rol, 'tot')}` : ''}
      </tbody></table></div>`;
  }

  function edFinancas(fin) {
    const linha = (k, l, forte) => `<tr${forte ? ' class="tot"' : ''}><td>${l}</td>${['realizado', 'previsto'].map((lado) => `<td>${campoEd(`financeiro.${lado}.${k}`, null, fin?.[lado]?.[k], `${l} · ${lado}`, 'brl')}</td>`).join('')}</tr>`;
    return `<div class="tbl-wrap"><table class="tbl ed fin"><thead><tr><th>Item (R$)</th><th>Realizado</th><th>Previsto</th></tr></thead><tbody>
      ${linha('saldo_anterior', 'Saldo anterior', true)}
      <tr class="grp"><th colspan="3">Receitas</th></tr>${Regras.RECEITAS.map(([k, l]) => linha(k, l)).join('')}
      ${linha('total_receita', 'Total da receita anual', true)}${linha('grande_total', 'Grande total', true)}
      <tr class="grp"><th colspan="3">Despesas</th></tr>${Regras.DESPESAS.map(([k, l]) => linha(k, l)).join('')}
      ${linha('total_despesa', 'Total da despesa anual', true)}${linha('saldo_seguinte', 'Saldo para o ano seguinte', true)}
      </tbody></table></div>`;
  }

  // Lê o formulário: devolve os dados novos, as alterações (de → para) e os campos inválidos
  function coletarEd(base) {
    const d = JSON.parse(JSON.stringify(base));
    const alteracoes = [], invalidos = [], arrays = new Map();
    let preenchidos = 0;
    $app.querySelectorAll('.ed-in').forEach((el) => {
      const txt = el.value.trim();
      const v = txt === '' ? null : Leitura.numero(txt);
      const valido = txt === '' || v !== null;
      el.classList.toggle('inv', !valido);
      if (!valido) { invalidos.push(el.dataset.r); return; }
      if (v !== null) preenchidos++;
      const path = el.dataset.p.split('.');
      const orig = obter(base, path);
      const antes = el.dataset.i != null ? (Array.isArray(orig) ? orig[+el.dataset.i] : undefined) : orig;
      const mudou = (antes ?? null) === null ? v !== null : v === null || Math.abs(antes - v) > 0.004;
      el.classList.toggle('mud', mudou);
      if (mudou) alteracoes.push({ campo: el.dataset.r, caminho: el.dataset.p + (el.dataset.i != null ? `[${el.dataset.i}]` : ''), de: antes ?? null, para: v });
      if (el.dataset.i != null) {
        if (!arrays.has(el.dataset.p)) arrays.set(el.dataset.p, { path, orig, vals: [], els: [] });
        const a = arrays.get(el.dataset.p); a.vals[+el.dataset.i] = v; a.els[+el.dataset.i] = el;
      } else if (orig !== undefined || v !== null) definir(d, path, v);
    });
    for (const a of arrays.values()) {
      const n = a.path[0] === 'departamentos' ? 2 : 3;
      const vals = Array.from({ length: n }, (_, i) => a.vals[i] ?? null);
      if (a.orig !== undefined || vals.some((x) => x !== null)) definir(d, a.path, vals);
      // masc. + fem. ≠ total: destaca o total para conferência
      if (n === 3 && a.els[2]) a.els[2].classList.toggle('inc', vals.every((x) => x !== null) && vals[0] + vals[1] !== vals[2]);
    }
    return { dados: d, alteracoes, invalidos, preenchidos };
  }

  function telaEditar({ r = null, envio = null }) {
    const igreja = r ? r.igreja : (S.igrejas.find((i) => i.codigo === envio.igrejas?.codigo) || envio.igrejas);
    const base = r ? r.dados : DADOS_VAZIOS();
    const arquivo = envio || S.envios.find((e) => e.relatorio_id === r.id) || S.envios.find((e) => e.igrejas?.codigo === igreja.codigo);
    const voltar = r ? `#/igreja/${igreja.codigo}/conferencia` : '#/pendencias';
    const body = `
      <p class="nota top">${r ? 'Corrija os valores que foram lidos errado.' : `Digite os valores do relatório a partir do arquivo <strong>${esc(envio.arquivo_nome)}</strong>.`}
        Campo vazio significa <strong>não informado</strong> (diferente de zero). As somas são refeitas enquanto você digita; ${r ? 'a correção fica registrada no histórico, com o valor anterior, e' : ''} o relatório vai para conferência.</p>
      ${arquivo ? `<button class="btn wide" data-baixar="${esc(arquivo.caminho)}">${ic('arquivo')}Abrir o arquivo enviado (${esc(arquivo.arquivo_nome)})</button>` : ''}
      <div class="ed-bar" role="status"><span id="ed-st">—</span><button class="btn primary" id="ed-salvar" disabled>Salvar</button></div>
      ${card('Liderança formal', edLista('lideranca', Regras.LIDERANCA, base.lideranca))}
      ${card('Estrutura do trabalho', edLista('estrutura', ESTRUTURA_ED, base.estrutura))}
      ${card('Departamentos internos', edDepartamentos(base.departamentos))}
      ${card('Comungantes', edTrio('comungantes', base.comungantes))}
      ${card('Não comungantes', edTrio('nao_comungantes', base.nao_comungantes, base.rol_atual))}
      ${card('Informações financeiras', edFinancas(base.financeiro), { sub: 'Valores em reais, no formato 1.234,56' })}
      <section class="card" id="ed-verif"></section>
      ${r ? card('Motivo da correção', '<label class="lbl">Comentário (opcional)<textarea id="ed-coment" rows="2" placeholder="Ex.: valor de dízimos lido errado; conferido no PDF"></textarea></label>') : ''}`;

    return {
      title: r ? 'Corrigir dados' : 'Digitar dados', sub: esc(igreja?.nome || ''), back: voltar, body,
      after: () => {
        const $st = document.getElementById('ed-st'), $btn = document.getElementById('ed-salvar');
        let atual = null;
        const atualizar = () => {
          atual = coletarEd(base);
          const verif = Regras.verificacoes(atual.dados);
          const falhas = verif.filter((x) => x.ok === false).length, conferidas = verif.filter((x) => x.ok !== null).length;
          document.getElementById('ed-verif').innerHTML = `<header class="card-h"><h2>Verificações</h2><p>${falhas ? `${falhas} divergência(s)` : conferidas ? 'Todas as somas verificáveis conferem' : 'Preencha os campos para conferir as somas'}</p></header><ul class="vfs">${vfItens(verif)}</ul>`;
          const n = r ? atual.alteracoes.length : atual.preenchidos;
          $st.innerHTML = atual.invalidos.length ? `<b class="ed-err">${atual.invalidos.length} valor(es) inválido(s)</b>`
            : `${r ? `${n} alteração(ões)` : `${n} campo(s) preenchido(s)`} · ${falhas ? `<b class="ed-err">${falhas} soma(s) com divergência</b>` : `${conferidas} soma(s) conferem`}`;
          $btn.disabled = !!atual.invalidos.length || !n;
        };
        $app.querySelectorAll('.ed-in').forEach((el) => el.addEventListener('input', atualizar));
        atualizar();
        $btn.addEventListener('click', async () => {
          atualizar();
          if ($btn.disabled) return;
          $btn.disabled = true; $btn.innerHTML = '<span class="spin"></span>Salvando…';
          try {
            if (r) await Data.corrigirRelatorio(r.id, atual.dados, atual.alteracoes, document.getElementById('ed-coment')?.value.trim());
            else await Data.digitarEnvio(envio, atual.dados);
            toast(r ? 'Correção salva. O relatório voltou para conferência.' : 'Dados salvos. O relatório está aguardando conferência.');
            location.hash = `#/igreja/${igreja.codigo}/conferencia`;
          } catch (e) { toast('Não foi possível salvar: ' + e.message); $btn.textContent = 'Salvar'; $btn.disabled = false; }
        });
      },
    };
  }

  // ---------- Conferência de um relatório ----------
  const vfItens = (verif) => {
    const val = (x, v) => (x.moeda ? fmt.brl(v) : fmt.int(v));
    return verif.map((x) => `<li class="vf ${x.ok === true ? 'ok' : x.ok === false ? 'falha' : 'na'}">
        <b aria-hidden="true">${x.ok === true ? '✓' : x.ok === false ? '✕' : '–'}</b>
        <div><span>${esc(x.titulo)}</span>
        ${x.ok === false ? `<small>Calculado: <strong>${val(x, x.esperado)}</strong> · Informado: <strong>${val(x, x.informado)}</strong></small>` : ''}
        ${x.ok === null ? '<small>Não verificável — campo não informado</small>' : ''}</div></li>`).join('');
  };

  function telaConferencia(r) {
    const verif = Regras.verificacoes(r.dados);
    const falhas = verif.filter((x) => x.ok === false);
    const linhasVerif = vfItens(verif);
    const alertas = r.alertas.length
      ? r.alertas.map((a) => `<li class="al al-${a.nivel}"><span class="chip ${a.nivel === 'erro' ? 'critical' : 'warning'}"><b aria-hidden="true">${a.nivel === 'erro' ? '!' : 'i'}</b>${a.nivel === 'erro' ? 'Erro' : 'Aviso'}</span><p>${esc(a.msg)}</p><code>${esc(a.campo)}</code></li>`).join('')
      : '<p class="vazio">Nenhum alerta registrado na leitura do documento.</p>';
    const hist = r.historico.slice().reverse().map((h) => `<li><span>${chip(h.status)}</span><div>${h.comentario ? esc(h.comentario) : ''}<small>${fmt.dataHora(h.criado_em)}</small></div></li>`).join('');
    const acoes = Data.podeValidar() && Data.exercicioFechado()
      ? `<div class="banner info" role="note"><b>■</b><div><strong>Exercício ${r.ano} fechado.</strong> A situação e os dados deste relatório não podem mais ser alterados. Para mudar algo, reabra o exercício na tela Conferência.</div></div>`
      : Data.podeValidar() ? `<section class="card acoes">
        <header class="card-h"><h2>Decisão da administração</h2><p>A decisão fica registrada no histórico do relatório.</p></header>
        <label class="lbl">Comentário (obrigatório para solicitar correção)<textarea id="coment" rows="3" placeholder="Ex.: conferir o rol de não comungantes"></textarea></label>
        <div class="btns">
          ${r.status !== 'validado' ? `<button class="btn primary" data-acao="validado">Validar relatório</button>` : ''}
          ${r.status !== 'aguardando_correcao' ? `<button class="btn danger" data-acao="aguardando_correcao">Solicitar correção</button>` : ''}
          ${r.status !== 'aguardando_conferencia' ? `<button class="btn" data-acao="aguardando_conferencia">Voltar para conferência</button>` : ''}
          <a class="btn" href="#/editar/${esc(r.igreja.codigo)}">Corrigir dados</a>
        </div>
        ${falhas.length && r.status !== 'validado' ? `<p class="small muted">Atenção: há ${falhas.length} verificação(ões) com divergência.</p>` : ''}
      </section>` : '';
    return `${acoes}
      ${card('Verificações automáticas', `<ul class="vfs">${linhasVerif}</ul>`, { sub: `${falhas.length ? `${falhas.length} divergência(s) encontrada(s)` : 'Todas as somas verificáveis conferem'} · recalculado a partir dos valores extraídos` })}
      ${card('Alertas da leitura do documento', `<ul class="als">${alertas}</ul>`)}
      ${card('Origem dos dados', `<dl class="dl">
          <dt>Documento</dt><dd>${esc(r.arquivo)}</dd>
          <dt>Formato</dt><dd>${esc(formatoTxt(r))}${r.tipo_pdf === 'digitalizado' ? ' (imagem — dados digitados/conferidos manualmente)' : r.tipo_pdf ? ' (texto selecionável)' : ''}</dd>
          <dt>Modelo</dt><dd>${esc(r.modelo || 'não identificado')}</dd>
          ${r.versao ? `<dt>Versão</dt><dd>${r.versao}${r.versao > 1 ? ' (as anteriores ficam no histórico como substituídas)' : ''}</dd>` : ''}
          ${r.tipo_pdf ? `<dt>Página 1</dt><dd>I Identificação · II Estrutura · III Rol de membros</dd>
          <dt>Página 2</dt><dd>IV Informações financeiras · VI Informações finais</dd>`
            : `<dt>Abas lidas</dt><dd>Cadastro & Estatística${r.dados.conselho ? ' · Conselho ou Mesa' : ''}${r.dados.congregacao_anexo ? ' · Congregação' : ''} (células conforme o Dicionário de dados)</dd>`}
          <dt>Extração</dt><dd>${r.extraido_em ? `${fmt.dataHora(r.extraido_em)} · leitura automática` : 'importação inicial'}</dd>
        </dl>`)}
      ${card('Arquivos enviados pelo site', listaEnvios(S.envios.filter((e) => e.igrejas?.codigo === r.igreja.codigo), { igreja: false }))}
      ${card('Histórico', `<ul class="hist">${hist}</ul>`)}`;
  }

  function ligarConferencia(r) {
    $app.querySelectorAll('[data-acao]').forEach((b) => b.addEventListener('click', async () => {
      const status = b.dataset.acao;
      const coment = document.getElementById('coment').value.trim();
      if (status === 'aguardando_correcao' && !coment) { toast('Escreva o que precisa ser corrigido.'); document.getElementById('coment').focus(); return; }
      b.disabled = true;
      try { await Data.definirStatus(r.id, status, coment); toast(`Relatório: ${STATUS[status].label.toLowerCase()}.`); rota(); } catch (e) { b.disabled = false; toast('Não foi possível salvar: ' + e.message); }
    }));
  }

  // ---------- Pendências ----------
  function telaPendencias() {
    const grupos = ORDEM_STATUS.map((s) => [s, S.relatorios.filter((r) => r.status === s)]).filter(([, l]) => l.length);
    const body = grupos.map(([s, lista]) => `<section class="grupo">
        <h2 class="grupo-h">${chip(s)}<span>${lista.length}</span></h2>
        <div class="lista">${lista.map((r) => {
          const v = contaVerif(r);
          const e = r.alertas.filter((a) => a.nivel === 'erro').length, w = r.alertas.length - e;
          return `<a class="item" href="#/igreja/${r.igreja.codigo}/conferencia">
            <div class="item-m"><strong>${esc(r.igreja.nome)}</strong>
              <div class="item-s">
                ${v.falhas ? `<span class="flag crit">${v.falhas} divergência(s) de soma</span>` : `<span class="flag ok">somas conferem</span>`}
                ${e ? `<span class="flag crit">${e} erro(s)</span>` : ''}${w ? `<span class="flag">${w} aviso(s)</span>` : ''}
                ${r.tipo_pdf === 'digitalizado' ? '<span class="flag">PDF digitalizado</span>' : ''}
              </div></div>${ic('seta', 'chev')}</a>`;
        }).join('')}</div></section>`).join('');
    const novos = S.envios.filter((e) => e.status === 'recebido' || e.status === 'em_processamento');
    const blocoEnvios = novos.length ? `<section class="grupo"><h2 class="grupo-h">${chipEnvio('recebido')}<span>${novos.length}</span></h2>
        <div class="card">${listaEnvios(novos)}</div></section>` : '';
    const faltam = Data.naoEnviadas();
    const blocoFaltam = faltam.length ? `<section class="grupo"><h2 class="grupo-h">${chip('nao_enviado')}<span>${faltam.length}</span></h2>
        <div class="lista">${faltam.map((i) => `<a class="item" href="#/enviar/${esc(i.codigo)}"><div class="item-m"><strong>${esc(i.nome)}</strong>
          <span class="muted">${esc(i.cidade || '')}${i.uf ? ` · ${esc(i.uf)}` : ''} · nenhum relatório recebido</span></div>${ic('seta', 'chev')}</a>`).join('')}</div></section>` : '';
    return {
      title: 'Conferência', sub: `Relatórios ${S.ano}`,
      body: `${seletorAno()}${quadroExercicio()}<p class="nota top">O sistema recalcula as somas de cada relatório e aponta divergências. A validação final é sempre de um responsável autorizado.</p>${blocoEnvios}${body}${blocoFaltam}`,
      after: ligarExercicio,
    };
  }

  // ---------- Exercício: fechamento oficial ----------
  function quadroExercicio() {
    const fechado = Data.exercicioFechado();
    const todos = S.relatorios, validados = todos.filter((r) => r.status === 'validado').length;
    const cadastradas = Math.max(Data.enviamRelatorio().length, todos.length), faltam = Data.naoEnviadas().length;
    const eventos = S.eventosExercicio.slice().reverse().map((e) => `<li><span class="chip ${e.acao === 'fechado' ? 'good' : 'warning'}"><b aria-hidden="true">${e.acao === 'fechado' ? '■' : '↺'}</b>${e.acao === 'fechado' ? 'Fechado' : 'Reaberto'}</span>
      <div>${e.comentario ? esc(e.comentario) : ''}<small>${fmt.dataHora(e.criado_em)}</small></div></li>`).join('');
    const pode = Data.podeValidar() && S.perfil.papel === 'admin_presbiterial';
    return `<section class="card exercicio${fechado ? ' fechado' : ''}">
      <header class="card-h"><h2>Exercício ${S.ano}</h2><p>${fechado
        ? `<strong>Fechado</strong>${S.exercicio.fechado_em ? ` em ${fmt.dataHora(S.exercicio.fechado_em)}` : ''} — resultado oficial. Envios, correções e mudanças de situação estão travados.`
        : '<strong>Aberto</strong> — recebendo e conferindo relatórios. O resultado é parcial até o fechamento.'}</p></header>
      <div class="mini">
        <div><strong>${cadastradas}</strong><span>Igrejas cadastradas</span></div>
        <div><strong>${todos.length}</strong><span>Relatórios recebidos</span></div>
        <div><strong>${validados}</strong><span>Validados</span></div>
        <div><strong>${todos.length - validados}</strong><span>Pendentes de validação</span></div>
        <div><strong>${faltam}</strong><span>Não enviados</span></div>
      </div>
      ${S.exercicio.comentario && fechado ? `<p class="nota">Comentário do fechamento: ${esc(S.exercicio.comentario)}</p>` : ''}
      ${pode ? `<div class="btns">${fechado ? '<button class="btn" id="ex-reabrir">Reabrir exercício</button>' : `<button class="btn primary" id="ex-fechar">Fechar exercício ${S.ano}</button>`}</div>` : ''}
      ${eventos ? `<details class="pv"><summary>Histórico do exercício</summary><div class="pv-c"><ul class="hist">${eventos}</ul></div></details>` : ''}
    </section>`;
  }

  function ligarExercicio() {
    document.getElementById('ex-fechar')?.addEventListener('click', () => {
      const pend = S.relatorios.filter((r) => r.status !== 'validado'), faltam = Data.naoEnviadas();
      const validados = S.relatorios.length - pend.length, cadastradas = Math.max(Data.enviamRelatorio().length, S.relatorios.length);
      const el = abrirPainel(`Fechar o exercício ${S.ano}`, `
        <p>Ao fechar, os números <strong>validados</strong> passam a ser o <strong>resultado oficial</strong> do exercício: ${validados} de ${cadastradas} igrejas.</p>
        ${pend.length || faltam.length ? `<div class="banner warning" role="note"><b>!</b><div><strong>Ficarão fora do resultado oficial:</strong>
          <ul>${pend.map((r) => `<li>${esc(r.igreja.nome)} — ${esc(STATUS[r.status].label.toLowerCase())}</li>`).join('')}${faltam.map((i) => `<li>${esc(i.nome)} — não enviou</li>`).join('')}</ul></div></div>`
          : '<div class="banner info" role="note"><b>✓</b><div><strong>Todas as igrejas estão validadas.</strong></div></div>'}
        <p>Depois do fechamento, nenhum relatório pode ser enviado, lido, corrigido ou ter a situação alterada. Se necessário, o exercício pode ser reaberto, informando o motivo.</p>
        <label class="lbl">Comentário (opcional)<textarea id="ex-coment" rows="2" placeholder="Ex.: aprovado na reunião ordinária do presbitério"></textarea></label>
        <button class="btn primary wide" id="ex-ok">Confirmar fechamento</button>`);
      el.querySelector('#ex-ok').addEventListener('click', async (e) => {
        e.target.disabled = true; e.target.innerHTML = '<span class="spin"></span>Fechando…';
        try { await Data.fecharExercicio(el.querySelector('#ex-coment').value.trim()); fecharPainel(); toast(`Exercício ${S.ano} fechado.`); rota(); }
        catch (err) { toast(err.message); e.target.disabled = false; e.target.textContent = 'Confirmar fechamento'; }
      });
    });
    document.getElementById('ex-reabrir')?.addEventListener('click', () => {
      const el = abrirPainel(`Reabrir o exercício ${S.ano}`, `
        <p>Reabrir permite de novo envios, leituras, correções e mudanças de situação. O resultado volta a ser <strong>parcial</strong> até um novo fechamento.</p>
        <label class="lbl">Motivo da reabertura (obrigatório)<textarea id="ex-motivo" rows="3" placeholder="Ex.: correção do relatório da IP Central aprovada pelo presbitério"></textarea></label>
        <button class="btn danger wide" id="ex-ok">Reabrir exercício</button>`);
      el.querySelector('#ex-ok').addEventListener('click', async (e) => {
        const motivo = el.querySelector('#ex-motivo').value.trim();
        if (!motivo) { toast('Informe o motivo da reabertura.'); return; }
        e.target.disabled = true;
        try { await Data.reabrirExercicio(motivo); fecharPainel(); toast(`Exercício ${S.ano} reaberto.`); rota(); }
        catch (err) { toast(err.message); e.target.disabled = false; }
      });
    });
  }

  // ---------- Nacional e Sínodo (totais agregados, só de relatórios validados) ----------
  const CAMPOS_NAC = [['rol', 'n_rol'], ['comungantes', 'n_comungantes'], ['nao_comungantes', 'n_nao_comungantes'], ['alunos_ed', 'n_alunos_ed'], ['receita', 'n_receita']];
  function agregar(linhas) {
    const t = { igrejas: 0, recebidos: 0, validados: 0, admissoes: 0, demissoes: 0, n_movimento: 0 };
    for (const [c, n] of CAMPOS_NAC) { t[c] = null; t[n] = 0; }
    for (const l of linhas) {
      t.igrejas += l.igrejas; t.recebidos += l.recebidos; t.validados += l.validados;
      for (const [c, n] of CAMPOS_NAC) if (l[n]) { t[c] = (t[c] || 0) + Number(l[c]); t[n] += l[n]; }
      if (l.n_movimento) { t.admissoes += Number(l.admissoes || 0); t.demissoes += Number(l.demissoes || 0); t.n_movimento += l.n_movimento; }
    }
    return t;
  }
  const agruparPor = (linhas, chave) => linhas.reduce((m, l) => { (m[l[chave]] = m[l[chave]] || []).push(l); return m; }, {});
  const cob = (n, de) => `<span class="kpi-f">${n} de ${de} ${de === 1 ? 'igreja' : 'igrejas'}</span>`;

  // Bloco comum: indicadores, cobertura e distribuição por UF
  function blocoAgregado(linhas, t) {
    const naoEnv = t.igrejas - t.recebidos, pendentes = t.recebidos - t.validados;
    const porUf = Object.entries(agruparPor(linhas, 'uf')).map(([uf, ls]) => { const a = agregar(ls); return { label: uf, value: a.rol, tip: `${uf}: ${fmt.int(a.rol)} membros em ${a.n_rol} igreja(s) validada(s) · ${a.igrejas} cadastrada(s)` }; })
      .sort((a, b) => (b.value ?? -1) - (a.value ?? -1));
    // Sigilo (014_sigilo.sql): grupos de outros presbitérios com menos de 3 relatórios validados vêm sem números
    const sigilo = linhas.filter((l) => l.validados > 0 && !l.n_rol && !l.n_comungantes && !l.n_receita && !l.n_alunos_ed);
    return `
      ${sigilo.length ? `<p class="aviso-sigilo">${ic('cadeado')}Os números de ${sigilo.length} ${sigilo.length === 1 ? 'grupo' : 'grupos'} (${sigilo.map((l) => esc(`${l.presbiterio_sigla}/${l.uf}`)).join(', ')}) estão ocultos: têm menos de 3 relatórios validados e, por sigilo, só quem tem jurisdição sobre o presbitério vê totais tão pequenos.</p>` : ''}
      <div class="kpis k4">
        ${kpi('Rol de membros', fmt.int(t.rol), '', cob(t.n_rol, t.igrejas))}
        ${kpi('Comungantes', fmt.int(t.comungantes), '', cob(t.n_comungantes, t.igrejas))}
        ${kpi('Não comungantes', fmt.int(t.nao_comungantes), '', cob(t.n_nao_comungantes, t.igrejas))}
        ${kpi('Alunos na Escola Dominical', fmt.int(t.alunos_ed), '', cob(t.n_alunos_ed, t.igrejas))}
      </div>
      <div class="kpis k4">
        ${kpi('Admissões de comungantes', fmt.int(t.n_movimento ? t.admissoes : null), '', cob(t.n_movimento, t.igrejas))}
        ${kpi('Demissões de comungantes', fmt.int(t.n_movimento ? t.demissoes : null), '', cob(t.n_movimento, t.igrejas))}
        ${kpi('Receita anual realizada', fmt.brlCurto(t.receita), '', cob(t.n_receita, t.igrejas))}
        ${kpi('Saldo de comungantes', t.n_movimento ? fmt.sinal(t.admissoes - t.demissoes) : '—', '', cob(t.n_movimento, t.igrejas))}
      </div>
      ${card('Cobertura estatística', `<div class="cs-bar">
          ${t.validados ? `<span class="cs-seg st-good" style="flex:${t.validados}" data-tip="Validados: ${t.validados}"></span>` : ''}
          ${pendentes ? `<span class="cs-seg st-warning" style="flex:${pendentes}" data-tip="Recebidos, não validados: ${pendentes}"></span>` : ''}
          ${naoEnv ? `<span class="cs-seg st-neutral" style="flex:${naoEnv}" data-tip="Não enviados: ${naoEnv}"></span>` : ''}</div>
        <div class="cob">${chip('validado')}<strong>${t.validados}</strong>${pendentes ? `<span class="chip warning"><b aria-hidden="true">◔</b>Pendentes de validação</span><strong>${pendentes}</strong>` : ''}${naoEnv ? `${chip('nao_enviado')}<strong>${naoEnv}</strong>` : ''}</div>`,
        { sub: `${t.recebidos} de ${t.igrejas} igrejas enviaram · somente os ${t.validados} relatórios validados entram nos totais` })}
      ${cardMapa(linhas)}
      ${card('Distribuição geográfica (por UF)', Charts.barras(porUf, { fmt: fmt.int }), { sub: 'Rol de membros dos relatórios validados, pela UF da igreja' })}`;
  }

  // Resumo executivo em texto (regras fixas), com botão para copiar
  const cardResumo = (paragrafos) => card('Resumo executivo', `<div class="resumo">${paragrafos.map((t) => `<p>${esc(t)}</p>`).join('')}</div>
      <div class="btns"><button class="btn" data-copiar-texto="${esc(paragrafos.join('\n\n'))}">Copiar texto</button></div>
      <p class="nota">${esc(Resumo.NOTA)}</p>`, { sub: 'Síntese dos números do painel, em linguagem simples' });
  document.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-copiar-texto]');
    if (!b) return;
    try { await navigator.clipboard.writeText(b.dataset.copiarTexto); toast('Resumo copiado.'); } catch (err) { window.prompt('Copie o resumo:', b.dataset.copiarTexto); }
  });

  // Mapa em grade por UF, com escolha do indicador
  function cardMapa(linhas) {
    const ufs = Object.entries(agruparPor(linhas, 'uf')).map(([uf, ls]) => ({ uf, a: agregar(ls) }));
    const dica = (uf, a) => `${uf}: ${a.igrejas} igreja(s) cadastrada(s) · ${a.validados} com relatório validado · rol ${fmt.int(a.n_rol ? a.rol : null)}`;
    const mapa = (valor, f, rotulo) => Charts.mapaUF(ufs.map(({ uf, a }) => ({ uf, valor: valor(a), tip: dica(uf, a) })), { fmt: f, rotulo });
    return card('Mapa por UF', `<label class="lim mapa-sel">Mostrar <select class="mapa-ind" aria-label="Indicador do mapa">
          <option value="rol">Rol de membros (validados)</option><option value="igrejas">Igrejas cadastradas</option><option value="cob">% de relatórios validados</option></select></label>
        <div data-mapa="rol">${mapa((a) => (a.n_rol ? a.rol : null), fmt.int, 'Rol de membros')}</div>
        <div data-mapa="igrejas" hidden>${mapa((a) => a.igrejas, fmt.int, 'Igrejas cadastradas')}</div>
        <div data-mapa="cob" hidden>${mapa((a) => (a.igrejas ? a.validados / a.igrejas : null), (v) => fmt.pct(v, 0), '% de relatórios validados')}</div>`,
    { sub: 'Cor mais escura = valor maior; estados em bege não têm dados. Toque em um estado para ver os números. Os estados pequenos têm o rótulo do lado de fora, com uma linha.' });
  }
  document.addEventListener('change', (e) => {
    if (!e.target.classList.contains('mapa-ind')) return;
    e.target.closest('.card').querySelectorAll('[data-mapa]').forEach((d) => { d.hidden = d.dataset.mapa !== e.target.value; });
  });

  // Exportação dos totais agregados (sínodo ou nacional)
  function ctxAgregado(linhas, abrangencia, sigla, parcial) {
    const porPresb = Object.values(agruparPor(linhas, 'presbiterio_sigla')).map((ls) => ({ ...agregar(ls), sigla: ls[0].presbiterio_sigla, nome: ls[0].presbiterio_nome, sinodo: ls[0].sinodo_sigla }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    const porUf = Object.entries(agruparPor(linhas, 'uf')).map(([uf, ls]) => ({ ...agregar(ls), uf })).sort((a, b) => a.uf.localeCompare(b.uf));
    return { abrangencia, sigla, ano: S.ano, total: agregar(linhas), porPresb, porUf, parcial };
  }
  const cardExportarAgregado = () => card('Exportar', `<div class="btns">
      <button class="btn" data-exp-agr="agregadoExcel">${ic('baixar')}Planilha Excel</button>
      <button class="btn" data-exp-agr="agregadoPdf">${ic('arquivo')}Resumo em PDF</button></div>`,
    { sub: 'Somente totais agregados de relatórios validados, por presbitério e por UF' });
  function ligarExportarAgregado(ctx) {
    $app.querySelectorAll('[data-exp-agr]').forEach((b) => b.addEventListener('click', async () => {
      const html = b.innerHTML; b.disabled = true; b.innerHTML = '<span class="spin"></span>Gerando…';
      try { await Exportar[b.dataset.expAgr](ctx); } catch (e) { toast('Não foi possível exportar: ' + e.message); }
      b.disabled = false; b.innerHTML = html;
    }));
  }

  function telaNacional() {
    return {
      title: 'Igreja Presbiteriana do Brasil', sub: `Visão nacional · ${S.ano}`,
      body: `<nav class="trilha" aria-label="Hierarquia"><span>Igreja Presbiteriana do Brasil</span></nav>${seletorAno()}<div id="nac"><div class="carregando dark"><span class="spin"></span>Consolidando…</div></div>`,
      after: async () => {
        const el = document.getElementById('nac');
        try {
          const [{ linhas, estrutura }, evo] = await Promise.all([Data.painelNacional(), Data.evolucaoNacional().catch((e) => e)]);
          const t = agregar(linhas);
          const sinodos = [...new Set(estrutura.map((e) => e.sinodo_sigla))];
          const presbs = [...new Set(estrutura.map((e) => e.presbiterio_sigla).filter(Boolean))];
          const porSinodo = agruparPor(linhas, 'sinodo_sigla');
          const porPresb = Object.entries(agruparPor(linhas, 'presbiterio_sigla')).map(([sg, ls]) => ({ label: sg, value: agregar(ls).rol, tip: `${ls[0].presbiterio_nome}: ${fmt.int(agregar(ls).rol)} membros` }));
          const ctxA = ctxAgregado(linhas, 'Visão nacional (unidades cadastradas na plataforma)', 'nacional', true);
          el.innerHTML = `
            <div class="banner info" role="note"><b>i</b><div><strong>Visão nacional da plataforma — dados parciais.</strong> Estão cadastrados ${sinodos.length} sínodo(s), ${presbs.length} presbitério(s) e ${t.igrejas} igreja(s).
              Os totais somam apenas os relatórios validados dessas unidades e <strong>não representam o total da IPB</strong>. Total oficial conhecido da IPB: <em>não informado</em> (será exibido quando houver fonte institucional).</div></div>
            <div class="kpis k4">
              ${kpi('Sínodos cadastrados', fmt.int(sinodos.length))}
              ${kpi('Presbitérios cadastrados', fmt.int(presbs.length))}
              ${kpi('Igrejas cadastradas', fmt.int(t.igrejas))}
              ${kpi('Relatórios validados', fmt.int(t.validados), '', `<span class="kpi-f">${t.recebidos} recebidos</span>`)}
            </div>
            ${cardResumo(Resumo.agregado(ctxA))}
            ${blocoAgregado(linhas, t)}
            ${!Array.isArray(evo) ? card('Evolução histórica', `<p class="nota">${esc(evo?.message || 'Indisponível.')}</p>`) : cardEvolucao(evo, { agregado: true, sub: 'Por exercício · somente relatórios validados · totais por presbitério' })}
            ${card('Sínodos', `<div class="lista">${sinodos.map((sg) => {
              const ls = porSinodo[sg] || [], a = agregar(ls), e = estrutura.find((x) => x.sinodo_sigla === sg);
              const np = new Set(estrutura.filter((x) => x.sinodo_sigla === sg && x.presbiterio_sigla).map((x) => x.presbiterio_sigla)).size;
              return `<a class="item" href="#/sinodo/${esc(sg)}"><div class="item-m"><strong>${esc(e?.sinodo_nome || sg)}</strong>
                <span class="muted">${esc(sg)} · ${np} presbitério(s) · ${a.validados} de ${a.igrejas} igrejas validadas</span></div>
                <div class="item-n"><strong>${fmt.int(a.rol)}</strong><span>membros</span></div>${ic('seta', 'chev')}</a>`;
            }).join('')}</div>`, { sub: 'Navegação: Nacional → Sínodo → Presbitério → Igreja' })}
            ${card('Comparação entre presbitérios', Charts.barras(porPresb.sort((a, b) => (b.value ?? -1) - (a.value ?? -1)), { fmt: fmt.int }), { sub: 'Rol de membros (relatórios validados)' })}
            ${cardExportarAgregado()}
            <p class="nota">Somente totais agregados aparecem aqui. O detalhe de cada igreja fica restrito a quem tem jurisdição sobre ela.</p>`;
          ligarExportarAgregado(ctxA);
        } catch (e) { el.innerHTML = card('', `<p class="erro">${esc(e.message)}</p>`); }
      },
    };
  }

  function telaSinodo(sigla) {
    const sg = sigla || S.sinodo?.sigla;
    return {
      title: 'Sínodo', sub: `Visão sinodal · ${S.ano}`,
      body: `<div id="sin"><div class="carregando dark"><span class="spin"></span>Consolidando…</div></div>`,
      after: async () => {
        const el = document.getElementById('sin');
        try {
          const [{ linhas: todas, estrutura }, evoTodas] = await Promise.all([Data.painelNacional(), Data.evolucaoNacional().catch((e) => e)]);
          const evo = Array.isArray(evoTodas) ? evoTodas.filter((l) => l.sinodo_sigla === sg) : evoTodas;
          const linhas = todas.filter((l) => l.sinodo_sigla === sg);
          const presbs = estrutura.filter((e) => e.sinodo_sigla === sg && e.presbiterio_sigla);
          const nome = estrutura.find((e) => e.sinodo_sigla === sg)?.sinodo_nome || sg;
          document.querySelector('.ab-t h1').textContent = nome;
          const t = agregar(linhas);
          const porPresb = agruparPor(linhas, 'presbiterio_sigla');
          const comPresb = Object.entries(porPresb).map(([p, ls]) => ({ p, ls, a: agregar(ls) }));
          const ctxA = ctxAgregado(linhas, nome, sg, comPresb.length < presbs.length || t.validados < t.igrejas);
          el.innerHTML = `
            <nav class="trilha" aria-label="Hierarquia"><a href="#/nacional">Igreja Presbiteriana do Brasil</a>${ic('seta')}<span>${esc(nome)}</span></nav>${seletorAno()}
            ${comPresb.length < presbs.length || t.validados < t.igrejas ? `<div class="banner info" role="note"><b>i</b><div><strong>Dados parciais do sínodo.</strong> ${comPresb.length} de ${presbs.length} presbitério(s) com igrejas na plataforma; ${t.validados} de ${t.igrejas} igrejas com relatório validado. Os totais não representam o sínodo inteiro.</div></div>` : ''}
            <div class="kpis k4">
              ${kpi('Presbitérios cadastrados', fmt.int(presbs.length))}
              ${kpi('Igrejas cadastradas', fmt.int(t.igrejas))}
              ${kpi('Relatórios recebidos', fmt.int(t.recebidos))}
              ${kpi('Relatórios validados', fmt.int(t.validados))}
            </div>
            ${cardResumo(Resumo.agregado(ctxA))}
            ${blocoAgregado(linhas, t)}
            ${!Array.isArray(evo) ? card('Evolução histórica', `<p class="nota">${esc(evo?.message || 'Indisponível.')}</p>`) : cardEvolucao(evo, { agregado: true, sub: 'Por exercício · somente relatórios validados · totais por presbitério' })}
            ${card('Presbitérios', `<div class="lista">${presbs.map((e) => {
              const a = agregar(porPresb[e.presbiterio_sigla] || []);
              const meu = e.presbiterio_sigla === S.presbiterio?.sigla;
              const dentro = `<div class="item-m"><strong>${esc(e.presbiterio_nome)}</strong><span class="muted">${esc(e.presbiterio_sigla)} · ${a.validados} de ${a.igrejas} igrejas validadas${meu ? '' : ' · detalhe das igrejas restrito ao presbitério'}</span></div>
                <div class="item-n"><strong>${fmt.int(a.rol)}</strong><span>membros</span></div>`;
              return meu ? `<a class="item" href="#/">${dentro}${ic('seta', 'chev')}</a>` : `<div class="item">${dentro}</div>`;
            }).join('')}</div>`, { sub: 'Navegação: Sínodo → Presbitério → Igreja' })}
            ${comPresb.length > 1 ? card('Comparação entre presbitérios', Charts.barras(comPresb.map(({ p, ls, a }) => ({ label: p, value: a.rol, tip: `${ls[0].presbiterio_nome}: ${fmt.int(a.rol)} membros` })), { fmt: fmt.int })) : ''}
            ${cardExportarAgregado()}`;
          ligarExportarAgregado(ctxA);
        } catch (e) { el.innerHTML = card('', `<p class="erro">${esc(e.message)}</p>`); }
      },
    };
  }

  // ---------- Dicionário de dados ----------
  function telaDicionario() {
    const campos = Dicionario.campos;
    const grupos = [...new Set(campos.map((c) => c.grupo))];
    const linha = (c) => `<tr class="dic-l${c.pendente ? ' pend' : ''}">
        <td><strong>${esc(c.rotulo)}</strong><code>${esc(c.id)}</code>${c.obs ? `<small>${esc(c.obs)}</small>` : ''}</td>
        <td>${esc(c.aba)}<br><strong>${c.celulas.length ? esc(c.celulas.join(' · ')) : 'caixa de seleção'}</strong></td>
        <td>${esc(c.tipo)}<br><span class="muted">${esc(c.unidade)} · ${esc(c.periodo)}</span></td>
        <td>${esc(c.validacao)}${c.formula ? `<br><span class="muted">Fórmula: ${esc(c.formula)}</span>` : ''}</td>
        <td>${esc(c.consolida)}<br><span class="muted">${esc(c.painel)}</span></td></tr>`;
    const body = `
      <p class="nota top">Base lógica da plataforma (seção 4 do projeto): cada informação do modelo oficial <strong>CSM-IPB 2021 v8.0</strong>, com a célula de origem no Excel, tipo, unidade, período, regras de validação, fórmulas, consolidação e o painel onde aparece. O leitor de Excel usa exatamente estas células; o de PDF produz os mesmos campos.</p>
      <div class="kpis k4">
        ${kpi('Campos no dicionário', fmt.int(campos.length))}
        ${kpi('Lidos automaticamente', fmt.int(campos.filter((c) => !c.pendente).length))}
        ${kpi('Com fórmula no modelo', fmt.int(campos.filter((c) => c.formula).length))}
        ${kpi('Pendentes (caixas Sim/Não)', fmt.int(campos.filter((c) => c.pendente).length))}
      </div>
      <div class="btns"><button class="btn" id="dic-xlsx">${ic('baixar')}Baixar dicionário (Excel)</button></div>
      <div class="busca"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${ICON.busca}</svg><input type="search" id="dic-q" placeholder="Buscar campo, célula ou regra (ex.: H47, dízimos, fórmula)" aria-label="Buscar no dicionário"></div>
      ${grupos.map((g) => `<section class="card dic-g"><header class="card-h"><h2>${esc(g)}</h2></header>
        <div class="tbl-wrap"><table class="tbl dic"><thead><tr><th>Campo</th><th>Origem</th><th>Tipo</th><th>Validação</th><th>Consolidação e painel</th></tr></thead>
        <tbody>${campos.filter((c) => c.grupo === g).map(linha).join('')}</tbody></table></div></section>`).join('')}`;
    return {
      title: 'Dicionário de dados', sub: 'Modelo CSM-IPB 2021 v8.0', back: '#/ajuda', body,
      after: () => {
        const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
        document.getElementById('dic-q').addEventListener('input', (e) => {
          const q = norm(e.target.value.trim());
          $app.querySelectorAll('.dic-g').forEach((sec) => {
            let n = 0;
            sec.querySelectorAll('.dic-l').forEach((tr) => { const ok = !q || norm(tr.textContent).includes(q); tr.hidden = !ok; if (ok) n++; });
            sec.hidden = n === 0;
          });
        });
        document.getElementById('dic-xlsx').addEventListener('click', async () => {
          try {
            await Envio.carregarScript('SHEETJS');
            const X = window.XLSX;
            const ws = X.utils.aoa_to_sheet([['Identificador', 'Campo', 'Grupo', 'Aba', 'Células', 'Tipo', 'Unidade', 'Período', 'Validação', 'Fórmula', 'Consolidação', 'Painel', 'Observação', 'Situação'],
              ...campos.map((c) => [c.id, c.rotulo, c.grupo, c.aba, c.celulas.join(', '), c.tipo, c.unidade, c.periodo, c.validacao, c.formula || '', c.consolida, c.painel, c.obs || '', c.pendente ? 'pendente' : 'lido'])]);
            ws['!cols'] = [30, 44, 26, 22, 14, 18, 18, 24, 50, 44, 34, 40, 50, 10].map((wch) => ({ wch }));
            const wb = X.utils.book_new(); X.utils.book_append_sheet(wb, ws, 'Dicionário');
            X.writeFile(wb, 'dicionario-dados-CSM-IPB-v8.xlsx');
          } catch (err) { toast('Não foi possível gerar: ' + err.message); }
        });
      },
    };
  }

  // Data de hoje no fuso do aparelho (toISOString usa UTC e, à noite no Brasil, já seria amanhã)
  const hojeLocal = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };

  // ---------- Estrutura conciliar (superadministrador): sínodos e presbitérios ----------
  function telaEstrutura() {
    if (S.modo === 'local') return { title: 'Estrutura', body: card('', '<p>O cadastro de sínodos e presbitérios funciona apenas no site publicado.</p>') };
    return {
      title: 'Estrutura conciliar', sub: 'Sínodos e presbitérios',
      body: `<p class="nota top">Cadastro dos concílios que usam a plataforma. Cada presbitério pertence a um sínodo; a mudança de sínodo é registrada com data, sem alterar os anos anteriores. Sínodos e presbitérios não são apagados, apenas inativados.</p>
        <div class="btns"><button class="btn primary" id="est-sin">+ Novo sínodo</button><button class="btn" id="est-presb">+ Novo presbitério</button></div>
        <div id="est"><div class="carregando dark"><span class="spin"></span>Carregando…</div></div>`,
      after: () => carregarEstrutura(),
    };
  }

  async function carregarEstrutura() {
    const el = document.getElementById('est');
    let e;
    try { e = await Data.listarEstrutura(); } catch (err) { el.innerHTML = card('', `<p class="erro">${esc(err.message)}</p>`); return; }
    const flag = (s) => (s === 'inativo' ? '<span class="flag">inativo</span>' : '<span class="flag ok">ativo</span>');
    const historico = (p) => e.vinculos.filter((v) => v.presbiterio_id === p.id && v.inicio > '1900-01-01')
      .map((v) => `${esc(v.sinodos?.sigla || '')} desde ${fmt.data(v.inicio)}${v.fim ? ` até ${fmt.data(v.fim)}` : ''}`).join(' · ');
    el.innerHTML = e.sinodos.map((s) => {
      const ps = e.presbiterios.filter((p) => p.sinodo_id === s.id);
      return card(`${esc(s.nome)} <small class="muted">${esc(s.sigla)}</small>`, `
        <div class="item-s">${flag(s.situacao)}<span class="flag">${ps.length} presbitério(s)</span></div>
        <div class="btns"><button class="btn" data-ed-sin="${esc(s.sigla)}">Editar sínodo</button></div>
        ${ps.length ? `<ul class="envios">${ps.map((p) => `<li><div class="env-m"><strong>${esc(p.nome)}</strong>
            <span class="muted small">${esc(p.sigla)} · ${e.igrejas[p.id] || 0} igreja(s) vinculada(s)${historico(p) ? ` · vínculos: ${historico(p)}` : ''}</span>
            <div class="item-s">${flag(p.situacao)}</div>
            <div class="btns"><button class="btn" data-ed-presb="${esc(p.sigla)}">Editar</button><button class="btn" data-mov-presb="${esc(p.sigla)}">Mudar de sínodo</button><button class="btn" data-adm-presb="${esc(p.sigla)}">Convidar administrador</button></div>
          </div></li>`).join('')}</ul>` : '<p class="vazio">Nenhum presbitério neste sínodo.</p>'}`);
    }).join('') + card('Registro de alterações da estrutura', e.auditoria.length
      ? `<ul class="hist">${e.auditoria.map((a) => `<li><span class="chip neutral"><b aria-hidden="true">•</b>Estrutura</span><div><strong>${esc(a.alvo || '')}</strong> ${esc(a.detalhe || '')}<small>${fmt.dataHora(a.criado_em)}</small></div></li>`).join('')}</ul>`
      : '<p class="vazio">Nenhuma alteração registrada ainda.</p>');

    const sinodoPor = (sg) => e.sinodos.find((s) => s.sigla === sg);
    const presbPor = (sg) => e.presbiterios.find((p) => p.sigla === sg);
    const opcoesSinodo = (atual) => e.sinodos.filter((s) => s.situacao === 'ativo').map((s) => `<option value="${esc(s.sigla)}"${s.sigla === atual ? ' selected' : ''}>${esc(s.nome)} (${esc(s.sigla)})</option>`).join('');
    const enviar = (form, acao, msg) => form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const f = Object.fromEntries(new FormData(form));
      const btn = form.querySelector('button[type=submit]'); btn.disabled = true;
      try { const r = await acao(f); if (r !== 'manter') { fecharPainel(); toast(msg); carregarEstrutura(); } } catch (err) { toast(err.message); btn.disabled = false; }
    });
    const formSinodo = (s) => {
      const el2 = abrirPainel(s ? `Editar ${esc(s.nome)}` : 'Novo sínodo', `<form class="campos conv">
          <label class="lbl">Sigla<input type="text" name="sigla" value="${esc(s?.sigla || '')}" ${s ? 'readonly' : 'required placeholder="Ex.: STG"'} maxlength="12" autocapitalize="characters"></label>
          <label class="lbl">Nome oficial<input type="text" name="nome" value="${esc(s?.nome || '')}" required placeholder="Ex.: Sínodo de Taguatinga"></label>
          <label class="lbl">Situação<select name="situacao"><option value="ativo">Ativo</option><option value="inativo"${s?.situacao === 'inativo' ? ' selected' : ''}>Inativo</option></select></label>
          <button class="btn primary" type="submit">${s ? 'Salvar' : 'Cadastrar'}</button></form>`);
      enviar(el2.querySelector('form'), (f) => Data.salvarSinodo(f, !s), s ? 'Sínodo atualizado.' : 'Sínodo cadastrado.');
    };
    const formPresb = (p) => {
      const sin = p ? e.sinodos.find((s) => s.id === p.sinodo_id) : null;
      const el2 = abrirPainel(p ? `Editar ${esc(p.nome)}` : 'Novo presbitério', `<form class="campos conv">
          <label class="lbl">Sigla<input type="text" name="sigla" value="${esc(p?.sigla || '')}" ${p ? 'readonly' : 'required placeholder="Ex.: PTAN"'} maxlength="12" autocapitalize="characters"></label>
          <label class="lbl">Nome oficial<input type="text" name="nome" value="${esc(p?.nome || '')}" required placeholder="Ex.: Presbitério de Taguatinga Norte"></label>
          ${p ? `<label class="lbl">Sínodo<input type="text" value="${esc(sin?.nome || '')}" readonly></label>` : `<label class="lbl">Sínodo<select name="sinodo" required><option value="">Selecione…</option>${opcoesSinodo()}</select></label>`}
          <label class="lbl">Situação<select name="situacao"><option value="ativo">Ativo</option><option value="inativo"${p?.situacao === 'inativo' ? ' selected' : ''}>Inativo</option></select></label>
          <button class="btn primary" type="submit">${p ? 'Salvar' : 'Cadastrar'}</button></form>
        ${p ? '<p class="nota">Para mudar o sínodo, use “Mudar de sínodo” (fica registrado com data).</p>' : ''}`);
      enviar(el2.querySelector('form'), (f) => Data.salvarPresbiterio(f, !p), p ? 'Presbitério atualizado.' : 'Presbitério cadastrado.');
    };
    const formMover = (p) => {
      const atual = e.sinodos.find((s) => s.id === p.sinodo_id);
      const el2 = abrirPainel(`Mudar ${esc(p.nome)} de sínodo`, `<p>Hoje pertence ao <strong>${esc(atual?.nome || '')}</strong>. A partir da data informada passa ao novo sínodo; os exercícios anteriores continuam somados ao sínodo da época.</p>
        <form class="campos conv"><input type="hidden" name="sigla" value="${esc(p.sigla)}">
          <label class="lbl">Novo sínodo<select name="sinodo" required><option value="">Selecione…</option>${opcoesSinodo().replace(`value="${atual?.sigla}"`, `value="${atual?.sigla}" disabled`)}</select></label>
          <label class="lbl">Data<input type="date" name="data" value="${hojeLocal()}" required></label>
          <label class="lbl">Motivo / ato que aprovou (obrigatório)<textarea name="motivo" rows="2" required placeholder="Ex.: resolução do Supremo Concílio"></textarea></label>
          <button class="btn danger" type="submit">Confirmar mudança</button></form>`);
      enviar(el2.querySelector('form'), (f) => Data.moverPresbiterio({ ...f, motivo: f.motivo.trim() }), 'Mudança de sínodo registrada.');
    };
    const formAdmin = (p) => {
      const el2 = abrirPainel(`Administrador do ${esc(p.nome)}`, `<p>O administrador do presbitério cadastra as igrejas, convida os representantes e valida os relatórios.</p>
        <form class="campos conv"><input type="hidden" name="presbiterio" value="${esc(p.sigla)}">
          <label class="lbl">Nome<input type="text" name="nome" placeholder="Ex.: Pb. João da Silva"></label>
          <label class="lbl">E-mail<input type="email" name="email" required autocapitalize="none" autocorrect="off" spellcheck="false"></label>
          <button class="btn primary" type="submit">Criar convite</button></form><div id="adm-ok"></div>`);
      enviar(el2.querySelector('form'), async (f) => {
        const codigo = await Data.convidarAdmin(f);
        const cv = { ...f, email: f.email.trim().toLowerCase(), codigo, papel: 'admin_presbiterial' };
        el2.querySelector('#adm-ok').innerHTML = `<div class="banner info conv-ok" role="status"><b>✓</b><div><strong>Convite criado para ${esc(cv.email)}.</strong> Envie o link:
          <code class="link">${esc(linkConvite(codigo))}</code><div class="btns">${botoesConvite({ ...cv, igreja: null, presbSigla: p.sigla })}</div></div></div>`;
        el2.querySelector('form button[type=submit]').disabled = false;
        return 'manter';
      }, '');
    };
    document.getElementById('est-sin').onclick = () => formSinodo(null);
    document.getElementById('est-presb').onclick = () => formPresb(null);
    el.querySelectorAll('[data-ed-sin]').forEach((b) => { b.onclick = () => formSinodo(sinodoPor(b.dataset.edSin)); });
    el.querySelectorAll('[data-ed-presb]').forEach((b) => { b.onclick = () => formPresb(presbPor(b.dataset.edPresb)); });
    el.querySelectorAll('[data-mov-presb]').forEach((b) => { b.onclick = () => formMover(presbPor(b.dataset.movPresb)); });
    el.querySelectorAll('[data-adm-presb]').forEach((b) => { b.onclick = () => formAdmin(presbPor(b.dataset.admPresb)); });
  }

  // ---------- Cadastro institucional ----------
  const tipoUnidade = (i, porId) => (i.tipo === 'congregacao'
    ? (i.igreja_mae_id ? `Congregação de ${nomeCurto(porId[i.igreja_mae_id]?.nome || '—')}` : 'Congregação presbiterial')
    : 'Igreja organizada');

  function telaCadastro() {
    if (S.modo === 'local') return { title: 'Cadastro de igrejas', back: '#/igrejas', body: card('', '<p>O cadastro institucional funciona apenas no site publicado.</p>') };
    const porId = Object.fromEntries(S.cadastradas.map((i) => [i.id, i]));
    const ordem = [...S.cadastradas].sort((a, b) => (a.situacao === 'inativa') - (b.situacao === 'inativa') || a.nome.localeCompare(b.nome, 'pt-BR'));
    const itens = ordem.map((i) => `<li>
        <div class="env-m"><strong>${esc(i.nome)}</strong>
          <span class="muted small">${esc(tipoUnidade(i, porId))} · ${esc(i.cidade || '—')}${i.uf ? ` · ${esc(i.uf)}` : ''} · código ${esc(i.codigo)}</span>
          <span class="muted small">No presbitério desde ${fmt.data(i.vinculo_inicio)}${i.organizacao ? ` · organizada em ${fmt.data(i.organizacao)}` : ''}</span>
          <div class="item-s">${i.situacao === 'inativa' ? '<span class="flag">inativa</span>' : '<span class="flag ok">ativa</span>'}</div>
          <div class="btns"><button class="btn" data-editar="${esc(i.codigo)}">Editar</button><button class="btn" data-transferir="${esc(i.codigo)}">Transferir</button></div>
        </div></li>`).join('');
    const body = `
      <p class="nota top">Igrejas e congregações sob a jurisdição deste presbitério. Congregações de uma igreja entram no relatório da igreja-mãe; congregações presbiteriais (ligadas direto ao presbitério) enviam relatório próprio. Toda alteração fica registrada.</p>
      <button class="btn primary" id="cad-nova">+ Nova igreja ou congregação</button>
      ${card(`Unidades cadastradas (${S.cadastradas.length})`, itens ? `<ul class="envios">${itens}</ul>` : '<p class="vazio">Nenhuma unidade cadastrada.</p>')}
      <section class="card"><header class="card-h"><h2>Registro de alterações</h2><p>Cadastros, alterações e transferências</p></header><div id="aud"><div class="carregando dark"><span class="spin"></span>Carregando…</div></div></section>`;

    return {
      title: 'Cadastro de igrejas', sub: esc(S.presbiterio?.nome || ''), back: '#/igrejas', body,
      after: async () => {
        document.getElementById('cad-nova').addEventListener('click', () => formUnidade(null, porId));
        $app.querySelectorAll('[data-editar]').forEach((b) => b.addEventListener('click', () => formUnidade(S.cadastradas.find((i) => i.codigo === b.dataset.editar), porId)));
        $app.querySelectorAll('[data-transferir]').forEach((b) => b.addEventListener('click', () => formTransferir(S.cadastradas.find((i) => i.codigo === b.dataset.transferir))));
        const aud = await Data.listarAuditoria();
        const rotulo = { cadastro: 'Cadastro', alteracao: 'Alteração', transferencia: 'Transferência' };
        const el = document.getElementById('aud');
        if (el) el.innerHTML = aud.length ? `<ul class="hist">${aud.map((a) => `<li><span class="chip neutral"><b aria-hidden="true">•</b>${rotulo[a.acao] || esc(a.acao)}</span>
            <div><strong>${esc(a.alvo || '')}</strong> ${esc(a.detalhe || '')}<small>${fmt.dataHora(a.criado_em)}</small></div></li>`).join('')}</ul>` : '<p class="vazio">Nenhuma alteração registrada ainda.</p>';
      },
    };
  }

  function formUnidade(i, porId) {
    const novo = !i;
    const maes = S.cadastradas.filter((x) => x.tipo !== 'congregacao' && x.situacao !== 'inativa' && x.codigo !== i?.codigo).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    const mae = i?.igreja_mae_id ? porId[i.igreja_mae_id]?.codigo : '';
    const el = abrirPainel(novo ? 'Nova igreja ou congregação' : `Editar ${esc(i.nome)}`, `
      <form id="f-uni" class="campos conv">
        <label class="lbl">Tipo<select name="tipo" id="uni-tipo"><option value="igreja"${i?.tipo !== 'congregacao' ? ' selected' : ''}>Igreja organizada</option><option value="congregacao"${i?.tipo === 'congregacao' ? ' selected' : ''}>Congregação</option></select></label>
        <label class="lbl" id="uni-mae">Vinculada a<select name="igreja_mae"><option value="">Direto ao presbitério (congregação presbiterial)</option>${maes.map((m) => `<option value="${esc(m.codigo)}"${m.codigo === mae ? ' selected' : ''}>${esc(m.nome)}</option>`).join('')}</select></label>
        <label class="lbl">Código (sigla única)<input type="text" name="codigo" value="${esc(i?.codigo || '')}" ${novo ? 'required placeholder="Ex.: 4IPC"' : 'readonly'} autocapitalize="characters" maxlength="20"></label>
        <label class="lbl">Nome oficial<input type="text" name="nome" value="${esc(i?.nome || '')}" required placeholder="Ex.: 4ª Igreja Presbiteriana de Ceilândia"></label>
        <label class="lbl">Cidade<input type="text" name="cidade" value="${esc(i?.cidade || '')}"></label>
        <label class="lbl">UF<input type="text" name="uf" value="${esc(i?.uf || '')}" maxlength="2" autocapitalize="characters"></label>
        <label class="lbl">Data de organização<input type="date" name="organizacao" value="${esc(i?.organizacao || '')}"></label>
        <label class="lbl">Situação<select name="situacao"><option value="ativa">Ativa</option><option value="inativa"${i?.situacao === 'inativa' ? ' selected' : ''}>Inativa</option></select></label>
        <button class="btn primary" type="submit">${novo ? 'Cadastrar' : 'Salvar alterações'}</button>
      </form>
      <p class="nota">${novo ? 'A unidade entra no presbitério a partir de hoje. Se for igreja ou congregação presbiterial, passa a aparecer como “Não enviado” até mandar o relatório.' : 'O código não muda, para preservar o histórico. Unidades inativas deixam de ser cobradas no envio, mas o histórico permanece.'}</p>`);
    const $tipo = el.querySelector('#uni-tipo'), $mae = el.querySelector('#uni-mae');
    const ajustar = () => { $mae.hidden = $tipo.value !== 'congregacao'; };
    $tipo.addEventListener('change', ajustar); ajustar();
    el.querySelector('#f-uni').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.target));
      const btn = e.target.querySelector('button[type=submit]'); btn.disabled = true; btn.innerHTML = '<span class="spin"></span>Salvando…';
      try {
        await Data.salvarIgreja({ ...f, igreja_mae: f.tipo === 'congregacao' ? f.igreja_mae : null }, novo);
        fecharPainel(); toast(novo ? 'Unidade cadastrada.' : 'Cadastro atualizado.'); ui.carregado = true; rota();
      } catch (err) { toast(err.message); btn.disabled = false; btn.textContent = novo ? 'Cadastrar' : 'Salvar alterações'; }
    });
  }

  async function formTransferir(i) {
    const el = abrirPainel(`Transferir ${esc(i.nome)}`, '<div class="carregando dark"><span class="spin"></span>Carregando presbitérios…</div>');
    let presbs = [];
    try { presbs = (await Data.listarPresbiterios()).filter((p) => p.sigla !== S.presbiterio?.sigla); } catch (e) { /* lista vazia */ }
    const hoje = hojeLocal();
    el.querySelector('.sheet-c').innerHTML = presbs.length ? `
      <p>A igreja passa para outro presbitério a partir da data informada. <strong>Os relatórios já existentes continuam ligados a este presbitério</strong> (jurisdição de cada exercício); os próximos irão para o novo.${S.cadastradas.some((c) => c.igreja_mae_id === i.id) ? ' As congregações desta igreja vão junto.' : ''}</p>
      <form id="f-tr" class="campos conv">
        <label class="lbl">Presbitério de destino<select name="destino" required><option value="">Selecione…</option>${presbs.map((p) => `<option value="${esc(p.sigla)}">${esc(p.nome)} (${esc(p.sigla)}${p.sinodos ? ` · ${esc(p.sinodos.sigla)}` : ''})</option>`).join('')}</select></label>
        <label class="lbl">Data da transferência<input type="date" name="data" value="${hoje}" required></label>
        <label class="lbl">Motivo / ato que aprovou (obrigatório)<textarea name="motivo" rows="2" required placeholder="Ex.: resolução do Sínodo, reunião de 10/03/2026"></textarea></label>
        <button class="btn danger" type="submit">Confirmar transferência</button>
      </form>`
      : '<p>Não há outro presbitério cadastrado na plataforma para receber a igreja. Novos presbitérios e sínodos são cadastrados pelo responsável técnico.</p>';
    el.querySelector('#f-tr')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.target));
      if (!window.confirm(`Transferir ${i.nome} para ${f.destino}? Depois disso ela sai da lista deste presbitério.`)) return;
      const btn = e.target.querySelector('button[type=submit]'); btn.disabled = true;
      try { await Data.transferirIgreja({ codigo: i.codigo, destino: f.destino, data: f.data, motivo: f.motivo.trim() }); fecharPainel(); toast('Transferência registrada.'); rota(); }
      catch (err) { toast(err.message); btn.disabled = false; }
    });
  }

  // ---------- Registro de ações (auditoria) ----------
  const CAT_AUD = {
    relatorios: ['Relatórios', ['situacao', 'envio']],
    usuarios: ['Usuários', ['convite', 'acesso']],
    cadastro: ['Cadastro', ['cadastro', 'alteracao', 'transferencia']],
    exercicio: ['Exercício', ['exercicio']],
    backup: ['Backup', ['backup']],
  };
  const ROT_AUD = { situacao: 'Situação', envio: 'Envio', convite: 'Convite', acesso: 'Acesso', cadastro: 'Cadastro', alteracao: 'Alteração', transferencia: 'Transferência', exercicio: 'Exercício', backup: 'Backup' };

  function telaAuditoria() {
    if (S.modo === 'local') return { title: 'Registro de ações', back: '#/perfil', body: card('', '<p>O registro de ações funciona apenas no site publicado.</p>') };
    const body = `
      <p class="nota top">Tudo o que acontece no presbitério fica registrado pelo próprio banco de dados: envios, leituras, validações, pedidos de correção, correções, convites, acessos, cadastro, transferências, fechamento do exercício e cópias de segurança. O registro não pode ser editado nem apagado pelo site.</p>
      <div class="seg claro" role="group" aria-label="Filtrar por tipo">
        <button class="on" data-cat="">Tudo</button>${Object.entries(CAT_AUD).map(([k, [l]]) => `<button data-cat="${k}">${l}</button>`).join('')}
      </div>
      <label class="busca">${ic('busca')}<input type="search" id="aud-q" placeholder="Buscar igreja, e-mail, pessoa ou texto" autocomplete="off"></label>
      <section class="card"><div id="aud-l"><div class="carregando dark"><span class="spin"></span>Carregando…</div></div></section>
      <button class="btn" id="aud-xlsx">${ic('baixar')}Baixar registro (Excel)</button>`;
    return {
      title: 'Registro de ações', sub: esc(S.presbiterio?.nome || ''), back: '#/perfil', body,
      after: async () => {
        const [lista, usuarios] = await Promise.all([Data.listarAuditoria(500), Data.listarUsuarios().catch(() => [])]);
        const quem = Object.fromEntries(usuarios.map((u) => [u.user_id, u.nome || u.email]));
        const linhas = lista.map((a) => ({ ...a, pessoa: a.usuario_id ? (quem[a.usuario_id] || 'usuário removido') : 'sistema' }));
        let cat = '';
        const desenhar = () => {
          const q = document.getElementById('aud-q').value.trim().toLowerCase();
          const acoes = cat ? CAT_AUD[cat][1] : null;
          const vis = linhas.filter((a) => (!acoes || acoes.includes(a.acao)) && (!q || `${a.alvo} ${a.detalhe} ${a.pessoa}`.toLowerCase().includes(q)));
          document.getElementById('aud-l').innerHTML = vis.length ? `<ul class="hist">${vis.map((a) => `<li><span class="chip neutral"><b aria-hidden="true">•</b>${ROT_AUD[a.acao] || esc(a.acao)}</span>
              <div><strong>${esc(a.alvo || '')}</strong> ${esc(a.detalhe || '')}<small>${fmt.dataHora(a.criado_em)} · por ${esc(a.pessoa)}</small></div></li>`).join('')}</ul>`
            : '<p class="vazio">Nenhuma ação encontrada.</p>';
        };
        $app.querySelectorAll('[data-cat]').forEach((b) => b.addEventListener('click', () => {
          cat = b.dataset.cat; $app.querySelectorAll('[data-cat]').forEach((x) => x.classList.toggle('on', x === b)); desenhar();
        }));
        document.getElementById('aud-q').addEventListener('input', desenhar);
        desenhar();
        document.getElementById('aud-xlsx').addEventListener('click', async () => {
          await Envio.carregarScript('SHEETJS');
          const X = window.XLSX;
          const ws = X.utils.aoa_to_sheet([['Data e hora', 'Tipo', 'Alvo', 'Detalhe', 'Feito por'],
            ...linhas.map((a) => [new Date(a.criado_em).toLocaleString('pt-BR'), ROT_AUD[a.acao] || a.acao, a.alvo || '', a.detalhe || '', a.pessoa])]);
          ws['!cols'] = [18, 14, 30, 90, 28].map((wch) => ({ wch }));
          const wb = X.utils.book_new(); X.utils.book_append_sheet(wb, ws, 'Registro');
          X.writeFile(wb, `registro-acoes-${S.presbiterio?.sigla || ''}-${hojeLocal()}.xlsx`);
        });
      },
    };
  }

  // ---------- Cópia de segurança ----------
  function telaBackup() {
    if (S.modo === 'local') return { title: 'Cópia de segurança', back: '#/perfil', body: card('', '<p>A cópia de segurança funciona apenas no site publicado.</p>') };
    const body = `
      ${card('Por que fazer', `<p>O plano gratuito do Supabase não guarda cópias de segurança que possam ser restauradas. Por isso o presbitério deve baixar e guardar a sua própria cópia, fora do Supabase.</p>
        <ul class="passos">
          <li><strong>Quando:</strong> uma vez por mês durante o recebimento e <strong>sempre depois de fechar o exercício</strong>.</li>
          <li><strong>Onde guardar:</strong> em dois lugares diferentes (ex.: computador da secretaria e um drive da igreja), com acesso restrito.</li>
          <li><strong>Atenção:</strong> a cópia contém dados dos relatórios e os e-mails dos usuários. Trate como documento confidencial (LGPD).</li>
        </ul>`)}
      ${card('Baixar cópia', `<div class="btns">
          <button class="btn primary" data-backup="json">${ic('baixar')}Dados (JSON)</button>
          <button class="btn" data-backup="zip">${ic('baixar')}Dados + arquivos originais (ZIP)</button>
        </div><div id="bk-st" class="nota"></div>`, { sub: 'Todas as tabelas do presbitério, todos os anos e todas as versões dos relatórios (inclusive as substituídas), correções, histórico, envios, usuários e registro de ações' })}
      ${card('Como recuperar', `<ul class="passos">
          <li>O arquivo JSON tem uma seção por tabela do banco, com os mesmos nomes de colunas — pode ser reimportado pelo responsável técnico no Supabase (Table Editor → Import, ou SQL).</li>
          <li>O ZIP traz também os PDFs e planilhas originais, na mesma organização de pastas do armazenamento (código da igreja / ano / arquivo).</li>
          <li>As estatísticas podem ser reconstruídas só a partir dos relatórios: cada valor guarda a origem no documento.</li>
        </ul>`)}
      <section class="card"><header class="card-h"><h2>Cópias anteriores</h2></header><div id="bk-h"><div class="carregando dark"><span class="spin"></span>Carregando…</div></div></section>`;
    return {
      title: 'Cópia de segurança', sub: esc(S.presbiterio?.nome || ''), back: '#/perfil', body,
      after: async () => {
        const historico = async () => {
          const l = await Data.listarAuditoria(20, ['backup']);
          const el = document.getElementById('bk-h');
          if (el) el.innerHTML = l.length ? `<ul class="hist">${l.map((a) => `<li><span class="chip good"><b aria-hidden="true">✓</b>Backup</span><div>${esc(a.detalhe || '')}<small>${fmt.dataHora(a.criado_em)}</small></div></li>`).join('')}</ul>`
            : '<p class="vazio">Nenhuma cópia registrada ainda.</p>';
        };
        historico();
        $app.querySelectorAll('[data-backup]').forEach((b) => b.addEventListener('click', async () => {
          const st = document.getElementById('bk-st'), html = b.innerHTML;
          $app.querySelectorAll('[data-backup]').forEach((x) => { x.disabled = true; });
          b.innerHTML = '<span class="spin"></span>Preparando…';
          try {
            st.textContent = 'Lendo as tabelas…';
            const dados = await Data.coletarBackup();
            const contagem = Object.fromEntries(Object.entries(dados).map(([k, v]) => [k, v.length]));
            const pacote = { sistema: 'Estatística IPB', versao: 1, gerado_em: new Date().toISOString(), gerado_por: S.usuario.email,
              presbiterio: S.presbiterio, sinodo: S.sinodo, contagem, tabelas: dados };
            const json = JSON.stringify(pacote, null, 1);
            const nome = `backup-${S.presbiterio?.sigla || 'presbiterio'}-${hojeLocal()}`;
            let resumo = `${dados.relatorios.length} relatórios (todas as versões), ${dados.igrejas.length} igrejas, ${dados.auditoria.length} registros de ações`;
            if (b.dataset.backup === 'zip') {
              await Envio.carregarScript('JSZIP');
              const zip = new window.JSZip();
              zip.file(`${nome}.json`, json);
              let ok = 0, falhas = 0;
              for (const [i, e] of dados.envios.entries()) {
                st.textContent = `Baixando arquivos originais… ${i + 1} de ${dados.envios.length}`;
                try { zip.file(`arquivos/${e.caminho}`, await Data.baixarArquivo(e.caminho)); ok++; } catch (err) { falhas++; }
              }
              st.textContent = 'Compactando…';
              const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
              baixarBlob(blob, `${nome}.zip`);
              resumo += ` e ${ok} arquivo(s) original(is)${falhas ? ` (${falhas} não baixado(s))` : ''} — ZIP`;
            } else {
              baixarBlob(new Blob([json], { type: 'application/json' }), `${nome}.json`);
              resumo += ' — JSON';
            }
            await Data.registrarBackup(resumo).catch(() => {});
            st.textContent = `Cópia gerada: ${resumo}. Guarde o arquivo em local seguro.`;
            historico();
          } catch (err) { st.textContent = 'Não foi possível gerar a cópia: ' + err.message; }
          $app.querySelectorAll('[data-backup]').forEach((x) => { x.disabled = false; });
          b.innerHTML = html;
        }));
      },
    };
  }
  function baixarBlob(blob, nome) {
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = nome; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  // ---------- Usuários e convites ----------
  const PAPEL_CONVITE = { representante: 'Representante de igreja', admin_presbiterial: 'Administrador do presbitério' };
  const linkConvite = (codigo) => `${location.origin}${location.pathname}#/convite/${codigo}`;
  const textoConvite = (c) => `Olá${c.nome ? `, ${c.nome}` : ''}! Você recebeu um convite para acessar o sistema de estatística da Igreja Presbiteriana do Brasil (${c.presbSigla || S.presbiterio?.sigla || ''}) como ${(PAPEL_CONVITE[c.papel] || '').toLowerCase()}${c.igreja ? ` da ${c.igreja}` : ''}. Abra o link para criar sua senha: ${linkConvite(c.codigo)}`;
  const botoesConvite = (c) => `<button class="btn" data-copiar="${esc(linkConvite(c.codigo))}">Copiar link</button>
    <a class="btn" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(textoConvite(c))}">WhatsApp</a>`;
  async function copiar(txt) {
    try { await navigator.clipboard.writeText(txt); toast('Link copiado.'); } catch (e) { window.prompt('Copie o link:', txt); }
  }

  function telaUsuarios() {
    const igrejas = [...S.igrejas].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    const body = S.modo === 'local' ? card('', '<p>O cadastro de usuários funciona apenas no site publicado.</p>') : `
      <p class="nota top">Convide pelo link: a pessoa abre, cria a própria senha e já entra com o acesso certo. Envie o link por WhatsApp ou e-mail. Cada convite vale por 14 dias e só pode ser usado com o e-mail cadastrado.</p>
      ${card('Convidar usuário', `<form id="f-conv" class="campos conv">
          <label class="lbl">Nome<input type="text" name="nome" autocomplete="off" placeholder="Ex.: Pb. João da Silva"></label>
          <label class="lbl">E-mail<input type="email" name="email" required autocapitalize="none" autocorrect="off" spellcheck="false" inputmode="email"></label>
          <label class="lbl">Acesso<select name="papel" id="conv-papel">
            <option value="representante">Representante de igreja</option>
            <option value="admin_presbiterial">Administrador do ${esc(S.presbiterio?.nome || 'presbitério')}</option></select></label>
          <label class="lbl" id="conv-ig">Igreja<select name="igreja"><option value="">Selecione a igreja…</option>${igrejas.map((i) => `<option value="${esc(i.codigo)}">${esc(i.nome)}</option>`).join('')}</select></label>
          <button class="btn primary" type="submit">Criar convite</button>
        </form><p class="nota">Os convites valem sempre para o <strong>${esc(S.presbiterio?.nome || 'seu presbitério')}${S.presbiterio?.sigla ? ` (${esc(S.presbiterio.sigla)})` : ''}</strong>, que é o presbitério do seu acesso. Administradores de outros presbitérios são convidados pelo superadministrador.</p>
        <div id="conv-ok"></div>`, { sub: 'Representante vê e envia só a própria igreja; administrador vê o presbitério inteiro e valida relatórios' })}
      <section class="card"><header class="card-h"><h2>Convites pendentes</h2></header><div id="l-conv"><div class="carregando dark"><span class="spin"></span>Carregando…</div></div></section>
      <section class="card"><header class="card-h"><h2>Usuários com acesso</h2></header><div id="l-usu"><div class="carregando dark"><span class="spin"></span>Carregando…</div></div></section>
      <section class="card"><header class="card-h"><h2>Outros acessos a este presbitério</h2>
        <p>Contas de nível superior que, pelas regras da plataforma, também podem consultar os relatórios das igrejas deste presbitério. São gerenciadas pelo superadministrador.</p></header>
        <div id="l-sup"><div class="carregando dark"><span class="spin"></span>Carregando…</div></div></section>`;

    async function carregarListas() {
      try {
        const convites = await Data.listarConvites();
        document.getElementById('l-conv').innerHTML = convites.length ? `<ul class="envios">${convites.map((c) => {
          const cv = { ...c, igreja: c.igrejas?.nome };
          const expirado = new Date(c.expira_em) < new Date();
          return `<li><div class="env-m"><strong>${esc(c.nome || c.email)}</strong>
              <span class="muted small">${esc(c.email)} · ${PAPEL_CONVITE[c.papel]}${c.igrejas ? ` · ${esc(c.igrejas.nome)}` : ''}</span>
              <div class="item-s"><span class="flag${expirado ? ' crit' : ''}">${expirado ? 'expirado' : `vale até ${fmt.data(c.expira_em.slice(0, 10))}`}</span></div>
              <div class="btns">${expirado ? '' : botoesConvite(cv)}<button class="btn danger" data-cancelar="${esc(c.id)}">Cancelar</button></div></div></li>`;
        }).join('')}</ul>` : '<p class="vazio">Nenhum convite pendente.</p>';
      } catch (e) { document.getElementById('l-conv').innerHTML = `<p class="erro">${esc(e.message)}</p>`; }
      try {
        const usuarios = await Data.listarUsuarios();
        document.getElementById('l-usu').innerHTML = usuarios.length ? `<ul class="envios">${usuarios.map((u) => `<li>
            <div class="env-m"><strong>${esc(u.nome || u.email)}</strong>
              <span class="muted small">${esc(u.email)} · ${PAPEIS[u.papel] || u.papel}${u.igreja_nome ? ` · ${esc(u.igreja_nome)}` : ''}</span>
              <span class="muted small">Último acesso: ${u.ultimo_acesso ? fmt.dataHora(u.ultimo_acesso) : 'nunca'}</span></div>
            ${u.email === S.usuario.email ? '<span class="flag">você</span>' : `<button class="btn danger" data-remover="${esc(u.user_id)}" data-nome="${esc(u.nome || u.email)}">Remover</button>`}
          </li>`).join('')}</ul>` : '<p class="vazio">Nenhum usuário.</p>';
      } catch (e) { document.getElementById('l-usu').innerHTML = `<p class="erro">${esc(e.message)}</p>`; }
      const $sup = document.getElementById('l-sup');
      try {
        const sup = await Data.listarAcessosSuperiores();
        if ($sup) $sup.innerHTML = sup.length ? `<ul class="envios">${sup.map((u) => `<li>
            <div class="env-m"><strong>${esc(u.nome || u.email)}</strong>
              <span class="muted small">${esc(u.email)} · ${PAPEIS[u.papel] || u.papel} · abrangência: ${esc(u.abrangencia)}</span>
              <span class="muted small">Último acesso: ${u.ultimo_acesso ? fmt.dataHora(u.ultimo_acesso) : 'nunca'}</span></div>
            <span class="flag">somente leitura</span></li>`).join('')}</ul>` : '<p class="vazio">Nenhuma conta de nível superior tem acesso a este presbitério.</p>';
      } catch (e) {
        if ($sup) $sup.innerHTML = `<p class="nota">${/listar_acessos_superiores/.test(e.message) ? 'Lista indisponível: o responsável técnico precisa aplicar o script 012 no banco.' : esc(e.message)}</p>`;
      }
    }

    return {
      title: 'Usuários e convites', sub: esc(S.presbiterio?.nome || ''), back: '#/perfil', body,
      after: () => {
        if (S.modo === 'local') return;
        const $f = document.getElementById('f-conv'), $papel = document.getElementById('conv-papel'), $ig = document.getElementById('conv-ig');
        const ajustar = () => { $ig.hidden = $papel.value !== 'representante'; };
        $papel.addEventListener('change', ajustar); ajustar();
        $f.addEventListener('submit', async (e) => {
          e.preventDefault();
          const f = new FormData($f), btn = $f.querySelector('button[type=submit]');
          const dados = { nome: String(f.get('nome') || '').trim(), email: String(f.get('email') || '').trim().toLowerCase(), papel: f.get('papel'), igreja: f.get('igreja') };
          if (dados.papel === 'representante' && !dados.igreja) { toast('Selecione a igreja.'); return; }
          btn.disabled = true; btn.innerHTML = '<span class="spin"></span>Criando…';
          try {
            const codigo = await Data.criarConvite(dados);
            const cv = { ...dados, codigo, igreja: igrejas.find((i) => i.codigo === dados.igreja)?.nome };
            document.getElementById('conv-ok').innerHTML = `<div class="banner info conv-ok" role="status"><b>✓</b><div><strong>Convite criado para ${esc(dados.email)}</strong> — ${dados.papel === 'representante' ? `representante da ${esc(cv.igreja || '')}` : `administrador do ${esc(S.presbiterio?.nome || 'presbitério')}`}.
              Envie o link abaixo para a pessoa:<code class="link">${esc(linkConvite(codigo))}</code><div class="btns">${botoesConvite(cv)}</div></div></div>`;
            $f.reset(); ajustar();
            carregarListas();
          } catch (err) { toast(err.message); }
          btn.disabled = false; btn.textContent = 'Criar convite';
        });
        $app.querySelector('.content').addEventListener('click', async (e) => {
          const ca = e.target.closest('[data-cancelar]'), rm = e.target.closest('[data-remover]');
          if (ca) { try { await Data.cancelarConvite(ca.dataset.cancelar); toast('Convite cancelado.'); carregarListas(); } catch (err) { toast(err.message); } }
          if (rm && window.confirm(`Remover o acesso de ${rm.dataset.nome}? A pessoa não verá mais nenhum dado.`)) {
            try { await Data.removerAcesso(rm.dataset.remover); toast('Acesso removido.'); carregarListas(); } catch (err) { toast(err.message); }
          }
        });
        carregarListas();
      },
    };
  }

  // Página aberta pela pessoa convidada (funciona sem estar logada)
  async function telaConvite(codigo) {
    if (S.modo === 'local') return renderSimples('<div class="login"><p>Convites funcionam apenas no site publicado.</p></div>');
    renderSimples('<div class="carregando"><span class="spin"></span>Abrindo convite…</div>');
    let c;
    try { c = await Data.verConvite(codigo); } catch (e) { c = null; }
    const topo = '<h1 class="login-logo"><img src="icons/logo_ipb.png" alt="Igreja Presbiteriana do Brasil"></h1>';
    if (!c || c.situacao !== 'valido') {
      const msg = !c ? 'Convite não encontrado. Confira se o link está completo.' : c.situacao === 'usado' ? 'Este convite já foi usado. Entre com seu e-mail e senha.' : 'Este convite expirou. Peça um novo ao administrador do presbitério.';
      return renderSimples(`<div class="login">${topo}<p class="erro">${msg}</p><a class="btn primary" href="#/">Ir para o login</a></div>`);
    }
    let novaConta = true;
    const desenhar = (erro = '') => {
      renderSimples(`<div class="login">${topo}
        <h2 class="login-t">Convite de acesso</h2>
        <p class="muted">Você recebeu um convite de acesso como <strong>${esc(PAPEL_CONVITE[c.papel])}</strong>${c.igreja ? ` da <strong>${esc(c.igreja)}</strong>` : ''} — ${esc(c.presbiterio)}.</p>
        ${erro ? `<p class="erro" role="alert">${esc(erro)}</p>` : ''}
        <form id="f-convite" class="form">
          ${novaConta ? `<label>Seu nome<input type="text" name="nome" value="${esc(c.nome || '')}" autocomplete="name"></label>` : ''}
          <label>E-mail<input type="email" name="email" value="${esc(c.email)}" readonly></label>
          <label>${novaConta ? 'Crie uma senha (mínimo 8 caracteres)' : 'Sua senha'}<input type="password" name="senha" id="senha" minlength="${novaConta ? 8 : 1}" autocomplete="${novaConta ? 'new-password' : 'current-password'}" autocapitalize="none" autocorrect="off" spellcheck="false" required></label>
          ${novaConta ? '<label>Repita a senha<input type="password" name="senha2" id="senha2" autocomplete="new-password" autocapitalize="none" autocorrect="off" spellcheck="false" required></label>' : ''}
          <label class="conf"><input type="checkbox" id="ver-senha"> Mostrar senha</label>
          <label class="conf"><input type="checkbox" id="aceite" required> <span>Li o <a href="#" id="ver-priv">aviso de privacidade</a> e estou ciente de como meus dados são tratados.</span></label>
          <button class="btn primary" type="submit">${novaConta ? 'Criar conta e entrar' : 'Entrar e aceitar convite'}</button>
        </form>
        <button class="btn" id="alternar">${novaConta ? 'Já tenho conta com este e-mail' : 'Ainda não tenho conta'}</button>
      </div>`);
      document.getElementById('alternar').addEventListener('click', () => { novaConta = !novaConta; desenhar(); });
      document.getElementById('ver-priv').addEventListener('click', (e) => { e.preventDefault(); abrirPainel('Aviso de privacidade', Privacidade.html()); });
      document.getElementById('ver-senha').addEventListener('change', (e) => { ['senha', 'senha2'].forEach((id) => { const el = document.getElementById(id); if (el) el.type = e.target.checked ? 'text' : 'password'; }); });
      document.getElementById('f-convite').addEventListener('submit', async (e) => {
        e.preventDefault();
        const f = new FormData(e.target);
        if (novaConta && f.get('senha') !== f.get('senha2')) { desenhar('As duas senhas não são iguais.'); return; }
        const btn = e.target.querySelector('button[type=submit]'); btn.disabled = true; btn.textContent = 'Entrando…';
        try {
          await Data.usarConvite({ codigo, email: c.email, senha: f.get('senha'), nome: String(f.get('nome') || '').trim(), novaConta });
          iniciou = true; ui.carregado = false;
          toast('Bem-vindo! Seu acesso está pronto.');
          location.hash = '#/';
        } catch (err) { desenhar(err.message); }
      });
    };
    desenhar();
  }

  // ---------- Perfil ----------
  function telaPerfil() {
    const local = S.modo === 'local';
    return {
      title: 'Perfil', sub: esc(S.usuario?.email || ''),
      body: `${card('', `<div class="perfil">
          <div class="avatar">${ic('perfil')}</div>
          <div><strong>${esc(S.usuario?.nome || '')}</strong><span class="muted">${PAPEIS[S.perfil.papel] || S.perfil.papel}</span>
          ${S.perfil.igreja_codigo ? `<span class="muted">Igreja: ${esc(relPorCodigo(S.perfil.igreja_codigo)?.igreja.nome || S.perfil.igreja_codigo)}</span>` : ''}</div></div>`)}
        <div class="lista">
          ${S.perfil.papel === 'admin_presbiterial' ? `<a class="item" href="#/usuarios">
            <div class="item-m"><strong>Usuários e convites</strong><span class="muted">Convidar representantes e administradores, remover acessos</span></div>${ic('seta', 'chev')}</a>
          <a class="item" href="#/cadastro">
            <div class="item-m"><strong>Cadastro de igrejas</strong><span class="muted">Igrejas, congregações, transferências de presbitério</span></div>${ic('seta', 'chev')}</a>
          <a class="item" href="#/auditoria">
            <div class="item-m"><strong>Registro de ações</strong><span class="muted">Quem fez o quê e quando: envios, validações, acessos, cadastro</span></div>${ic('seta', 'chev')}</a>
          <a class="item" href="#/backup">
            <div class="item-m"><strong>Cópia de segurança</strong><span class="muted">Baixar todos os dados e arquivos do presbitério</span></div>${ic('seta', 'chev')}</a>` : ''}
          <a class="item" href="#/ajuda">
            <div class="item-m"><strong>Ajuda</strong><span class="muted">Tudo o que o aplicativo faz, passo a passo e configurações</span></div>${ic('seta', 'chev')}</a>
          <a class="item" href="#/dicionario">
            <div class="item-m"><strong>Dicionário de dados</strong><span class="muted">Cada campo do relatório oficial: célula, tipo, regras e onde aparece</span></div>${ic('seta', 'chev')}</a>
          <a class="item" href="#/privacidade">
            <div class="item-m"><strong>Aviso de privacidade</strong><span class="muted">Quais dados são tratados, quem acessa e os seus direitos (LGPD)</span></div>${ic('seta', 'chev')}</a>
        </div>
        ${local ? card('Simular outro perfil', `<div class="perfis">
            ${['admin_presbiterial', 'admin_sinodal', 'representante'].map((p) => `<button class="btn${S.perfil.papel === p ? ' primary' : ''}" data-papel="${p}">${PAPEIS[p]}</button>`).join('')}
          </div>`, { sub: 'Disponível apenas no modo local' }) : ''}
        ${card('Instalar como aplicativo', `<ul class="passos">
            <li><strong>Android (Chrome):</strong> menu ⋮ → <em>Instalar app</em> ou <em>Adicionar à tela inicial</em>.</li>
            <li><strong>iPhone (Safari):</strong> botão Compartilhar → <em>Adicionar à Tela de Início</em>.</li>
          </ul>`)}
        <button class="btn danger wide" id="sair">Sair</button>`,
      after: () => {
        document.getElementById('sair').addEventListener('click', async () => { await Data.sair(); ui.carregado = false; location.hash = ''; rota(); });
        $app.querySelectorAll('[data-papel]').forEach((b) => b.addEventListener('click', () => {
          Data.entrarLocal(b.dataset.papel); ui.carregado = false;
          location.hash = b.dataset.papel === 'representante' ? `#/igreja/${Data.state.perfil.igreja_codigo}` : b.dataset.papel === 'admin_sinodal' ? '#/sinodo' : '#/';
          rota();
        }));
      },
    };
  }

  // ---------- Roteador ----------
  let iniciou = false;
  async function rota() {
    // Convite: abre mesmo sem login (a pessoa ainda não tem conta)
    const convite = location.hash.match(/^#\/convite\/([0-9a-f]+)/i);
    if (convite) return telaConvite(convite[1]);
    if (!iniciou) {
      iniciou = true;
      renderSimples('<div class="carregando"><span class="spin"></span>Carregando…</div>');
      try { await Data.sessaoAtual(); } catch (e) { return telaLogin(e.message); }
    }
    if (!S.perfil && /^#\/(ajuda|privacidade)/.test(location.hash)) {
      // Ajuda e aviso de privacidade abertos da tela de login (sem usuário)
      const priv = location.hash.startsWith('#/privacidade');
      $app.innerHTML = `<div class="aj-solo"><header class="aj-solo-h"><a href="#/" class="btn">${ic('voltar')}Voltar ao login</a>
        <img src="icons/logo_ipb.png" alt="Igreja Presbiteriana do Brasil"></header><h1>${priv ? 'Aviso de privacidade' : 'Ajuda'}</h1>${priv ? Privacidade.html() : Ajuda.html(null)}</div>`;
      window.scrollTo(0, 0);
      return priv ? undefined : Ajuda.ligar($app);
    }
    if (!S.perfil) return telaLogin();
    if (!ui.carregado) {
      renderSimples('<div class="carregando"><span class="spin"></span>Carregando relatórios…</div>');
      try { await Data.carregar(); ui.carregado = true; } catch (e) {
        return renderSimples(`<div class="login"><h1>Não foi possível carregar</h1><p class="erro">${esc(e.message)}</p><button class="btn" data-recarregar>Tentar de novo</button></div>`);
      }
    }
    const [p0 = '', p1, p2] = location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
    const rep = S.perfil.papel === 'representante';
    if (rep && !(p0 === 'igreja' || p0 === 'perfil' || p0 === 'enviar' || p0 === 'ajuda' || p0 === 'dicionario' || p0 === 'privacidade')) { location.replace(`#/igreja/${S.perfil.igreja_codigo}`); return; }
    if (p0 === 'igreja' && rep && p1 !== S.perfil.igreja_codigo) { location.replace(`#/igreja/${S.perfil.igreja_codigo}`); return; }
    const nacional = S.perfil.papel === 'superadmin' || S.perfil.papel === 'admin_nacional';
    if (nacional && ['', 'igrejas', 'pendencias', 'cadastro', 'usuarios', 'auditoria', 'backup'].includes(p0)) { location.replace('#/nacional'); return; }
    switch (p0) {
      case '': return render(telaPresbiterio(), 'inicio');
      case 'estrutura':
        if (S.perfil.papel !== 'superadmin') { location.replace('#/'); return; }
        return render(telaEstrutura(), 'estrutura');
      case 'igrejas': return render(telaIgrejas(), 'igrejas');
      case 'igreja': return render(telaIgreja(p1, p2), rep ? 'igreja' : 'igrejas');
      case 'pendencias': return render(telaPendencias(), 'pendencias');
      case 'enviar': return render(telaEnviar(rep ? S.perfil.igreja_codigo : p1), rep ? 'enviar' : 'igrejas');
      case 'editar': {
        const r = relPorCodigo(p1);
        if (!r || !Data.podeValidar() || Data.exercicioFechado()) { location.replace(r ? `#/igreja/${p1}/conferencia` : '#/'); return; }
        return render(telaEditar({ r }), 'igrejas');
      }
      case 'digitar': {
        const envio = S.envios.find((e) => e.id === p1);
        if (!envio || !Data.podeValidar() || Data.exercicioFechado()) { location.replace('#/pendencias'); return; }
        return render(telaEditar({ envio }), 'pendencias');
      }
      case 'sinodo': return render(telaSinodo(p1), 'sinodo');
      case 'nacional': return render(telaNacional(), nacional ? 'nacional' : 'sinodo');
      case 'perfil': return render(telaPerfil(), 'perfil');
      case 'ajuda':
        return render({ title: 'Ajuda', sub: 'Como usar o sistema', body: Ajuda.html(S.perfil.papel), after: () => Ajuda.ligar($app) }, 'ajuda');
      case 'dicionario': return render(telaDicionario(), 'perfil');
      case 'privacidade': return render({ title: 'Aviso de privacidade', sub: `LGPD · versão de ${Privacidade.VERSAO}`, back: '#/perfil', body: Privacidade.html() }, 'perfil');
      case 'auditoria':
      case 'backup':
        if (S.perfil.papel !== 'admin_presbiterial') { location.replace('#/perfil'); return; }
        return render(p0 === 'auditoria' ? telaAuditoria() : telaBackup(), 'perfil');
      case 'cadastro':
        if (S.perfil.papel !== 'admin_presbiterial') { location.replace('#/igrejas'); return; }
        return render(telaCadastro(), 'igrejas');
      case 'usuarios':
        if (S.perfil.papel !== 'admin_presbiterial') { location.replace('#/perfil'); return; }
        return render(telaUsuarios(), 'perfil');
      default: location.replace('#/');
    }
  }

  window.addEventListener('hashchange', rota);
  Charts.ligarTooltip();
  document.addEventListener('click', (e) => { if (e.target.closest('[data-recarregar]')) location.reload(); });
  // Baixar arquivo original (link assinado, válido por 10 minutos)
  document.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-baixar]');
    if (!b) return;
    if (S.modo === 'local') { toast('Disponível apenas no site publicado.'); return; }
    const janela = window.open('', '_blank');
    try { janela.location = await Data.urlArquivo(b.dataset.baixar); } catch (err) { janela?.close(); toast('Não foi possível abrir o arquivo: ' + err.message); }
  });
  // Copiar link de convite (vale também dentro dos painéis)
  document.addEventListener('click', (e) => { const b = e.target.closest('[data-copiar]'); if (b) copiar(b.dataset.copiar); });
  // Ler agora: lê os números de um arquivo recebido e cria a versão para conferência
  document.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-ler]');
    const envio = b && S.envios.find((x) => x.id === b.dataset.ler);
    if (!envio) return;
    b.disabled = true; b.innerHTML = '<span class="spin"></span>Lendo…';
    try {
      await Data.processarEnvio(envio);
      toast('Relatório lido. A nova versão está aguardando conferência.');
      rota();
    } catch (err) { b.disabled = false; b.textContent = 'Ler agora'; toast(err.message); }
  });
  rota();

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
