// Interface: roteamento por hash, telas e ações.
(() => {
  const S = Data.state;
  const { T, fmt, STATUS, ORDEM_STATUS, PAPEIS, temValor } = Regras;
  const esc = Charts.esc;
  const $app = document.getElementById('app');
  const ui = { escopo: 'validados', carregado: false };

  // ---------- Ícones ----------
  const ICON = {
    home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
    igrejas: '<path d="M12 2v4M10 4h4M5 21V11l7-5 7 5v10M9.5 21v-5h5v5M3 21h18"/>',
    conferencia: '<path d="M9 11l2 2 4-4"/><path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5"/>',
    sinodo: '<path d="M12 3 2 8l10 5 10-5-10-5z"/><path d="M2 13l10 5 10-5"/><path d="M2 18l10 5 10-5"/>',
    perfil: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
    voltar: '<path d="M15 5l-7 7 7 7"/>',
    seta: '<path d="M9 5l7 7-7 7"/>',
    arquivo: '<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5"/>',
    busca: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
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

  // ---------- Navegação por perfil ----------
  function itensNav() {
    const p = S.perfil?.papel;
    const pend = S.relatorios.filter((r) => r.status !== 'validado').length;
    if (p === 'representante') {
      return [
        { id: 'igreja', href: `#/igreja/${S.perfil.igreja_codigo}`, label: 'Minha igreja', icon: 'igrejas' },
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
        <div class="brand"><img src="icons/icon.svg" alt=""><div><strong>Painel Estatístico</strong><small>${esc(S.presbiterio?.sigla || '')} · ${S.ano}</small></div></div>
        ${nav}
      </nav>
      <header class="appbar">
        ${v.back ? `<a class="ab-back" href="${v.back}" aria-label="Voltar">${ic('voltar')}</a>` : ''}
        <div class="ab-t">${v.sub ? `<small>${v.sub}</small>` : ''}<h1>${v.title}</h1></div>
        ${S.modo === 'local' ? '<span class="modo" title="Dados lidos do arquivo local">local</span>' : ''}
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
      <img class="login-logo" src="icons/icon.svg" alt="">
      <h1>Painel Estatístico</h1>
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
          <label>E-mail<input type="email" name="email" autocomplete="username" required></label>
          <label>Senha<input type="password" name="senha" autocomplete="current-password" required></label>
          <button class="btn primary" type="submit">Entrar</button>
        </form>`}
    </div>`);
    if (local) {
      $app.querySelectorAll('[data-papel]').forEach((b) => b.addEventListener('click', () => {
        Data.entrarLocal(b.dataset.papel); ui.carregado = false;
        location.hash = b.dataset.papel === 'admin_sinodal' ? '#/sinodo' : '#/';
        rota();
      }));
    } else {
      document.getElementById('f-login').addEventListener('submit', async (e) => {
        e.preventDefault();
        const f = new FormData(e.target);
        const btn = e.target.querySelector('button'); btn.disabled = true; btn.textContent = 'Entrando…';
        try { await Data.entrar(f.get('email'), f.get('senha')); ui.carregado = false; location.hash = '#/'; rota(); } catch (err) { telaLogin(err.message); }
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
        <h2>${fmt.int(rol.total)} <small>membros</small></h2>
        <div class="metric-row">
          <div class="metric-pill"><span class="num">${fmt.int(com.total)}</span><span class="label">Comungantes</span><span class="d">${dTxt(comV)}</span></div>
          <div class="metric-pill"><span class="num">${fmt.int(nc.total)}</span><span class="label">Não comungantes</span><span class="d">${dTxt(ncV)}</span></div>
          <div class="metric-pill"><span class="num">${base.length} <small>de ${todos.length}</small></span><span class="label">Igrejas consideradas</span><span class="d">${validados.length} relatórios validados</span></div>
        </div>
        <div class="seg" role="group" aria-label="Relatórios considerados">
          <button class="${ui.escopo === 'validados' ? 'on' : ''}" data-escopo="validados">Somente validados (${validados.length})</button>
          <button class="${ui.escopo === 'todos' ? 'on' : ''}" data-escopo="todos">Todos recebidos (${todos.length})</button>
        </div>
      </section>

      ${ui.escopo === 'todos'
        ? `<div class="banner warning" role="note"><b>!</b><div><strong>Inclui relatórios não validados.</strong> Use apenas para acompanhamento — ${todos.length - validados.length} relatórios ainda têm pendências.</div></div>`
        : parcial ? `<div class="banner info" role="note"><b>i</b><div><strong>Resultado parcial:</strong> ${validados.length} de ${todos.length} relatórios recebidos estão validados. Os números abaixo consideram somente estes.</div></div>` : ''}

      ${card('Recebimento dos relatórios', `<div class="cs-bar">${segs}</div><div class="cob">${chipsStatus}</div>`, { sub: `Exercício ${S.ano} · ${todos.length} relatórios recebidos` })}

      <div class="kpis k4">
        ${kpi('Alunos na Escola Dominical', fmt.int(ed.total), delta(edV), cobertura(ed))}
        ${kpi('Professores da Escola Dominical', fmt.int(prof.total), '', cobertura(prof))}
        ${kpi('Receita anual realizada', fmt.brlCurto(rec.total), '', cobertura(rec))}
        ${kpi('Despesa anual realizada', fmt.brlCurto(desp.total), '', cobertura(desp))}
      </div>

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

      ${card('Liderança formal', `<div class="mini">${Regras.LIDERANCA.map(([k, l]) => { const c = lid(k); return `<div><strong>${fmt.int(c.total)}</strong><span>${l}</span></div>`; }).join('')}</div>`)}

      <p class="nota">Campos vazios nos relatórios contam como <em>não informado</em>, não como zero. Cada indicador mostra quantas igrejas contribuíram para o total.</p>`;

    return {
      title: esc(S.presbiterio?.nome || 'Presbitério'), sub: `Exercício ${S.ano}`, body,
      after: () => $app.querySelectorAll('[data-escopo]').forEach((b) => b.addEventListener('click', () => { ui.escopo = b.dataset.escopo; rota(); })),
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
          <div class="item-s">${chip(r.status)}${erros || v.falhas ? `<span class="flag">${erros + v.falhas} ${erros + v.falhas === 1 ? 'pendência' : 'pendências'}</span>` : ''}</div>
        </div>
        <div class="item-n"><strong>${fmt.int(T(r.dados.rol_atual))}</strong><span>membros</span></div>
        ${ic('seta', 'chev')}
      </a>`;
    }).join('');
    return {
      title: 'Igrejas', sub: `${rels.length} relatórios · ${S.ano}`,
      body: `<label class="busca">${ic('busca')}<input type="search" id="q" placeholder="Buscar igreja ou cidade" autocomplete="off"></label>
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

  // ---------- Igreja ----------
  const ABAS = [['geral', 'Visão geral'], ['membresia', 'Membresia'], ['educacao', 'Educação'], ['financas', 'Finanças'], ['conferencia', 'Conferência']];

  function telaIgreja(cod, aba = 'geral') {
    const r = relPorCodigo(cod);
    if (!r) return { title: 'Igreja não encontrada', body: card('', '<p>Este relatório não existe ou você não tem acesso a ele.</p>'), back: '#/igrejas' };
    const d = r.dados;
    const v = contaVerif(r);
    const pend = r.alertas.length + v.falhas;
    const abas = ABAS.map(([id, l]) => `<a href="#/igreja/${cod}/${id}" class="${id === aba ? 'on' : ''}"${id === aba ? ' aria-current="page"' : ''}>${l}${id === 'conferencia' && pend ? ` <span class="badge">${pend}</span>` : ''}</a>`).join('');
    const fonte = (sec) => `${ic('arquivo')} Fonte: ${esc(r.arquivo)} · ${sec}`;

    let corpo = '';
    if (aba === 'geral') {
      const comV = Regras.variacao([r], () => T(d.comungantes?.ano_anterior), () => T(d.comungantes?.ano_atual));
      const ncV = Regras.variacao([r], () => T(d.nao_comungantes?.ano_anterior), () => T(d.nao_comungantes?.ano_atual));
      const edV = Regras.variacao([r], () => d.estrutura?.alunos_ed_anterior, () => d.estrutura?.alunos_ed_atual);
      const fr = d.financeiro?.realizado || {};
      corpo = `
        <div class="kpis">
          ${kpi('Rol de membros', fmt.int(T(d.rol_atual)))}
          ${kpi('Comungantes', fmt.int(T(d.comungantes?.ano_atual)), delta(comV))}
          ${kpi('Não comungantes', fmt.int(T(d.nao_comungantes?.ano_atual)), delta(ncV))}
          ${kpi('Alunos na Escola Dominical', fmt.int(d.estrutura?.alunos_ed_atual), delta(edV))}
          ${kpi('Receita anual realizada', fmt.brlCurto(fr.total_receita))}
          ${kpi('Despesa anual realizada', fmt.brlCurto(fr.total_despesa))}
        </div>
        ${card('Liderança formal', `<div class="mini">${Regras.LIDERANCA.map(([k, l]) => `<div><strong>${fmt.int(d.lideranca?.[k])}</strong><span>${l}</span></div>`).join('')}</div>`, { fonte: fonte('pág. 1 · seção II') })}
        ${card('Estrutura do trabalho', `<div class="mini">
          <div><strong>${fmt.int(d.estrutura?.congregacoes)}</strong><span>Congregações</span></div>
          <div><strong>${fmt.int(d.estrutura?.pontos_pregacao)}</strong><span>Pontos de pregação</span></div>
          <div><strong>${fmt.int(d.estrutura?.escolas_dominicais)}</strong><span>Escolas dominicais</span></div>
          <div><strong>${fmt.int(d.departamentos?.totais?.[0])}</strong><span>Departamentos internos</span></div>
        </div>`, { fonte: fonte('pág. 1 · seção II') })}`;
    } else if (aba === 'membresia') {
      const c = d.comungantes || {}, nc = d.nao_comungantes || {};
      corpo = `
        ${card('Rol atual', `<div class="sexos">${Charts.sexo(c.ano_atual, 'Comungantes')}${Charts.sexo(nc.ano_atual, 'Não comungantes')}${Charts.sexo(d.rol_atual, 'Rol total')}</div>`, { fonte: fonte('pág. 1 · seção III') })}
        ${card('Evolução no exercício', tabelaEvolucao(c, nc))}
        ${card('Movimentação — comungantes', tabelaMov(c), { fonte: fonte('pág. 1 · seção III') })}
        ${card('Movimentação — não comungantes', tabelaMov(nc), { fonte: fonte('pág. 1 · seção III') })}`;
    } else if (aba === 'educacao') {
      const e = d.estrutura || {};
      const edV = Regras.variacao([r], () => e.alunos_ed_anterior, () => e.alunos_ed_atual);
      const razao = temValor(e.alunos_ed_atual) && e.professores_ed ? e.alunos_ed_atual / e.professores_ed : null;
      const deps = Regras.DEPARTAMENTOS.map(([k, l]) => ({ label: l, value: d.departamentos?.[k]?.[1] ?? null, n: d.departamentos?.[k]?.[0] ?? null }));
      corpo = `
        <div class="kpis k4">
          ${kpi('Alunos (ano atual)', fmt.int(e.alunos_ed_atual), delta(edV))}
          ${kpi('Alunos (ano anterior)', fmt.int(e.alunos_ed_anterior))}
          ${kpi('Professores', fmt.int(e.professores_ed))}
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
    } else {
      corpo = telaConferencia(r);
    }

    const head = `<section class="card ig-head">
        <div class="ig-top">${chip(r.status)}<span class="muted">${esc(r.igreja.codigo)}</span></div>
        <p class="muted">${esc(r.igreja.cidade)} · ${esc(r.igreja.uf)} · organizada em ${fmt.data(r.igreja.organizacao)}</p>
        <p class="muted small">${ic('arquivo')} ${esc(r.arquivo)} · PDF ${esc(r.tipo_pdf)} · ${esc(r.modelo)}</p>
      </section>
      <nav class="tabs" aria-label="Seções">${abas}</nav>`;

    return {
      title: esc(r.igreja.nome), sub: `Relatório ${r.ano}`,
      back: S.perfil.papel === 'representante' ? null : '#/igrejas',
      body: head + corpo,
      after: () => ligarConferencia(r),
    };
  }

  const cel = (v) => (temValor(v) ? fmt.int(v) : '<span class="na" title="Não informado">—</span>');

  function tabelaMov(bloco) {
    const linhas = (grupo, titulo) => {
      const ent = Object.entries(bloco?.[grupo] || {}).filter(([, v]) => Array.isArray(v));
      if (!ent.length) return '';
      return `<tr class="grp"><th colspan="4">${titulo}</th></tr>` + ent.map(([k, v]) => `<tr${Regras.DETALHE.has(k) ? ' class="det"' : ''}><td>${esc(Regras.ROTULOS[k] || k)}</td><td>${cel(v[0])}</td><td>${cel(v[1])}</td><td><strong>${cel(v[2])}</strong></td></tr>`).join('');
    };
    return `<div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>Movimento</th><th>Masc.</th><th>Fem.</th><th>Total</th></tr></thead>
      <tbody>${linhas('admissao', 'Admissões')}${linhas('demissao', 'Demissões')}
        ${bloco?.rol_separado ? `<tr class="grp"><th colspan="4">Outros</th></tr><tr><td>Rol separado</td><td>${cel(bloco.rol_separado[0])}</td><td>${cel(bloco.rol_separado[1])}</td><td><strong>${cel(bloco.rol_separado[2])}</strong></td></tr>` : ''}
      </tbody></table></div>
      <p class="legenda"><span class="na">—</span> não informado no relatório · 0 informado como zero</p>`;
  }

  function tabelaEvolucao(c, nc) {
    const linha = (nome, b) => `<tr><td>${nome}</td><td>${cel(T(b.ano_anterior))}</td><td>${cel(T(b.diferenca))}</td><td><strong>${cel(T(b.ano_atual))}</strong></td></tr>`;
    return `<div class="tbl-wrap"><table class="tbl">
      <thead><tr><th></th><th>Ano anterior</th><th>Diferença</th><th>Ano atual</th></tr></thead>
      <tbody>${linha('Comungantes', c)}${linha('Não comungantes', nc)}</tbody></table></div>`;
  }

  function tabelaFin(fr, fp) {
    const brl = (v) => (temValor(v) ? fmt.brl(v) : '<span class="na" title="Não informado">—</span>');
    const linha = (l, k, forte) => `<tr${forte ? ' class="tot"' : ''}><td>${l}</td><td>${brl(fr[k])}</td><td>${brl(fp[k])}</td></tr>`;
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

  // ---------- Conferência de um relatório ----------
  function telaConferencia(r) {
    const verif = Regras.verificacoes(r.dados);
    const falhas = verif.filter((x) => x.ok === false);
    const val = (x, v) => (x.moeda ? fmt.brl(v) : fmt.int(v));
    const linhasVerif = verif.map((x) => `<li class="vf ${x.ok === true ? 'ok' : x.ok === false ? 'falha' : 'na'}">
        <b aria-hidden="true">${x.ok === true ? '✓' : x.ok === false ? '✕' : '–'}</b>
        <div><span>${esc(x.titulo)}</span>
        ${x.ok === false ? `<small>Calculado: <strong>${val(x, x.esperado)}</strong> · Informado: <strong>${val(x, x.informado)}</strong></small>` : ''}
        ${x.ok === null ? '<small>Não verificável — campo não informado</small>' : ''}</div></li>`).join('');
    const alertas = r.alertas.length
      ? r.alertas.map((a) => `<li class="al al-${a.nivel}"><span class="chip ${a.nivel === 'erro' ? 'critical' : 'warning'}"><b aria-hidden="true">${a.nivel === 'erro' ? '!' : 'i'}</b>${a.nivel === 'erro' ? 'Erro' : 'Aviso'}</span><p>${esc(a.msg)}</p><code>${esc(a.campo)}</code></li>`).join('')
      : '<p class="vazio">Nenhum alerta registrado na leitura do documento.</p>';
    const hist = r.historico.slice().reverse().map((h) => `<li><span>${chip(h.status)}</span><div>${h.comentario ? esc(h.comentario) : ''}<small>${fmt.dataHora(h.criado_em)}</small></div></li>`).join('');
    const acoes = Data.podeValidar() ? `<section class="card acoes">
        <header class="card-h"><h2>Decisão da administração</h2><p>A decisão fica registrada no histórico do relatório.</p></header>
        <label class="lbl">Comentário (obrigatório para solicitar correção)<textarea id="coment" rows="3" placeholder="Ex.: conferir o rol de não comungantes"></textarea></label>
        <div class="btns">
          ${r.status !== 'validado' ? `<button class="btn primary" data-acao="validado">Validar relatório</button>` : ''}
          ${r.status !== 'aguardando_correcao' ? `<button class="btn danger" data-acao="aguardando_correcao">Solicitar correção</button>` : ''}
          ${r.status !== 'aguardando_conferencia' ? `<button class="btn" data-acao="aguardando_conferencia">Voltar para conferência</button>` : ''}
        </div>
        ${falhas.length && r.status !== 'validado' ? `<p class="small muted">Atenção: há ${falhas.length} verificação(ões) com divergência.</p>` : ''}
      </section>` : '';
    return `${acoes}
      ${card('Verificações automáticas', `<ul class="vfs">${linhasVerif}</ul>`, { sub: `${falhas.length ? `${falhas.length} divergência(s) encontrada(s)` : 'Todas as somas verificáveis conferem'} · recalculado a partir dos valores extraídos` })}
      ${card('Alertas da leitura do documento', `<ul class="als">${alertas}</ul>`)}
      ${card('Origem dos dados', `<dl class="dl">
          <dt>Documento</dt><dd>${esc(r.arquivo)}</dd>
          <dt>Formato</dt><dd>PDF ${esc(r.tipo_pdf)}${r.tipo_pdf === 'digitalizado' ? ' (imagem — leitura visual/OCR)' : ' (texto selecionável)'}</dd>
          <dt>Modelo</dt><dd>${esc(r.modelo)}</dd>
          <dt>Página 1</dt><dd>I Identificação · II Estrutura · III Rol de membros</dd>
          <dt>Página 2</dt><dd>IV Informações financeiras · VI Informações finais</dd>
          <dt>Extração</dt><dd>${r.extraido_em ? fmt.dataHora(r.extraido_em) : 'importação inicial'}</dd>
        </dl>`)}
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
    return { title: 'Conferência', sub: `Relatórios ${S.ano}`, body: `<p class="nota top">O sistema recalcula as somas de cada relatório e aponta divergências. A validação final é sempre de um responsável autorizado.</p>${body}` };
  }

  // ---------- Sínodo ----------
  function telaSinodo() {
    const todos = S.relatorios;
    const val = todos.filter((r) => r.status === 'validado');
    const com = Regras.consolidar(val, (r) => T(r.dados.comungantes?.ano_atual));
    const rol = Regras.consolidar(val, (r) => T(r.dados.rol_atual));
    return {
      title: esc(S.sinodo?.nome || 'Sínodo'), sub: `Visão sinodal · ${S.ano}`,
      body: `<nav class="trilha" aria-label="Hierarquia"><span>Igreja Presbiteriana do Brasil</span>${ic('seta')}<span>${esc(S.sinodo?.nome || '')}</span></nav>
        <div class="banner info" role="note"><b>i</b><div><strong>Dados parciais do sínodo.</strong> Apenas 1 presbitério está cadastrado na plataforma. Os totais não representam o sínodo inteiro.</div></div>
        <div class="kpis">
          ${kpi('Presbitérios cadastrados', '1')}
          ${kpi('Relatórios recebidos', fmt.int(todos.length))}
          ${kpi('Relatórios validados', fmt.int(val.length))}
          ${kpi('Comungantes (validados)', fmt.int(com.total), '', cobertura(com))}
          ${kpi('Rol de membros (validados)', fmt.int(rol.total), '', cobertura(rol))}
        </div>
        ${card('Presbitérios', `<div class="lista"><a class="item" href="#/">
            <div class="item-m"><strong>${esc(S.presbiterio?.nome || '')}</strong><span class="muted">${esc(S.presbiterio?.sigla || '')} · ${todos.length} relatórios · ${val.length} validados</span></div>
            <div class="item-n"><strong>${fmt.int(com.total)}</strong><span>comungantes</span></div>${ic('seta', 'chev')}</a></div>`, { sub: 'Navegação: Sínodo → Presbitério → Igreja' })}`,
    };
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
    if (!iniciou) {
      iniciou = true;
      renderSimples('<div class="carregando"><span class="spin"></span>Carregando…</div>');
      try { await Data.sessaoAtual(); } catch (e) { return telaLogin(e.message); }
    }
    if (!S.perfil) return telaLogin();
    if (!ui.carregado) {
      renderSimples('<div class="carregando"><span class="spin"></span>Carregando relatórios…</div>');
      try { await Data.carregar(); ui.carregado = true; } catch (e) {
        return renderSimples(`<div class="login"><h1>Não foi possível carregar</h1><p class="erro">${esc(e.message)}</p><button class="btn" onclick="location.reload()">Tentar de novo</button></div>`);
      }
    }
    const [p0 = '', p1, p2] = location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
    const rep = S.perfil.papel === 'representante';
    if (rep && !(p0 === 'igreja' || p0 === 'perfil')) { location.replace(`#/igreja/${S.perfil.igreja_codigo}`); return; }
    if (p0 === 'igreja' && rep && p1 !== S.perfil.igreja_codigo) { location.replace(`#/igreja/${S.perfil.igreja_codigo}`); return; }
    switch (p0) {
      case '': return render(telaPresbiterio(), 'inicio');
      case 'igrejas': return render(telaIgrejas(), 'igrejas');
      case 'igreja': return render(telaIgreja(p1, p2), rep ? 'igreja' : 'igrejas');
      case 'pendencias': return render(telaPendencias(), 'pendencias');
      case 'sinodo': return render(telaSinodo(), 'sinodo');
      case 'perfil': return render(telaPerfil(), 'perfil');
      default: location.replace('#/');
    }
  }

  window.addEventListener('hashchange', rota);
  Charts.ligarTooltip();
  rota();

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
