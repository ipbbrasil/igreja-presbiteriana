// Dicionário de dados do modelo oficial CSM-IPB 2021 v8.0 (igreja.xlsx).
// Fonte única: o leitor de Excel usa as células daqui, e a página "Dicionário de dados" mostra tudo.
// Campos com fórmula no modelo são calculados pelo Excel; o sistema lê o valor e refaz a conta na conferência.
window.Dicionario = (() => {
  const CE = 'Cadastro & Estatística', CM = 'Conselho ou Mesa';
  const campos = [];
  // campo: { id, rotulo, grupo, aba, celulas[], tipo, unidade, periodo, formula, validacao, consolida, painel, obs }
  const add = (o) => campos.push({ aba: CE, consolida: 'Soma (só valores informados)', ...o });

  // ---------- Identificação ----------
  const ident = [
    ['ano', 'Ano do exercício', 'R3', 'inteiro', 'Deve ser o exercício escolhido no envio'],
    ['sinodo_nome', 'Sínodo (nome)', 'L4', 'texto', 'Conferido com o cadastro'],
    ['sinodo_sigla', 'Sínodo (sigla)', 'AC4', 'texto', 'Deve ser a sigla cadastrada (ex.: STG)'],
    ['presbiterio_nome', 'Presbitério (nome)', 'L5', 'texto', 'Conferido com o cadastro'],
    ['presbiterio_sigla', 'Presbitério (sigla)', 'AC5', 'texto', 'Deve ser a sigla cadastrada (ex.: PTAN)'],
    ['nome_no_documento', 'Nome da igreja / congregação', 'F8', 'texto', 'Conferido com o nome cadastrado (aviso se divergir ou vazio)'],
    ['data_organizacao', 'Data de organização', 'E12', 'data', 'dd/mm/aaaa'],
  ];
  ident.forEach(([k, r, c, t, v]) => add({ id: `identificacao.${k}`, rotulo: r, grupo: 'Identificação', celulas: [c], tipo: t, unidade: '—', periodo: 'Exercício', validacao: v, consolida: 'Não se aplica', painel: 'Conferência' }));

  // ---------- Liderança e estrutura ----------
  Regras.LIDERANCA.forEach(([k, r], i) => add({ id: `lideranca.${k}`, rotulo: r, grupo: 'Liderança formal', celulas: [`E${15 + i}`], tipo: 'inteiro', unidade: 'pessoas',
    periodo: 'Fim do exercício', validacao: 'Inteiro ≥ 0', painel: 'Igreja › Visão geral; Presbitério › Liderança' }));
  [['congregacoes', 'Congregações da Igreja'], ['pontos_pregacao', 'Pontos de pregação'], ['escolas_dominicais', 'Escolas dominicais'],
    ['professores_ed', 'Professores da Escola Dominical'], ['alunos_ed_atual', 'Alunos da Escola Dominical (ano atual)'], ['alunos_ed_anterior', 'Alunos da Escola Dominical (ano anterior)']]
    .forEach(([k, r], i) => add({ id: `estrutura.${k}`, rotulo: r, grupo: 'Estrutura do trabalho', celulas: [`Q${15 + i}`], tipo: 'inteiro',
      unidade: k.startsWith('alunos') || k === 'professores_ed' ? 'pessoas' : 'unidades', periodo: k === 'alunos_ed_anterior' ? 'Exercício anterior' : 'Fim do exercício',
      validacao: 'Inteiro ≥ 0', painel: 'Igreja › Educação; Presbitério › Escola Dominical' }));
  [...Regras.DEPARTAMENTOS, ['totais', 'Totais']].forEach(([k, r], i) => add({ id: `departamentos.${k}`, rotulo: `${r} (nº deptos. · nº membros)`, grupo: 'Departamentos internos',
    celulas: k === 'totais' ? ['Y22', 'AB22'] : [`Y${16 + i}`, `AB${16 + i}`], tipo: 'par', unidade: 'departamentos · pessoas', periodo: 'Fim do exercício',
    formula: k === 'totais' ? 'Y22 = SUM(Y16:AA21) · AB22 = SUM(AB16:AD21)' : '', validacao: k === 'totais' ? 'Totais = soma das linhas' : 'Inteiros ≥ 0', painel: 'Igreja › Educação' }));

  // ---------- Rol de membros (masc., fem., total) ----------
  const trio = (bloco, k, r, linha, cols, f, extra = {}) => add({
    id: `${bloco}.${k}`, rotulo: r, grupo: bloco.startsWith('nao') ? 'Não comungantes' : 'Comungantes', celulas: cols.map((c) => `${c}${linha}`),
    tipo: 'masc. · fem. · total', unidade: 'pessoas', periodo: 'Exercício', formula: f, validacao: 'Inteiros ≥ 0; masc. + fem. = total', painel: 'Igreja › Membresia; Presbitério › Movimentação', ...extra,
  });
  const C = ['I', 'K', 'M'], N = ['X', 'Z', 'AB'];
  [['profissao_fe', 25], ['profissao_fe_batismo', 26], ['transferencia', 27], ['jurisdicao', 28], ['restauracao', 29], ['designacao_presbiterio', 30]]
    .forEach(([k, l]) => trio('comungantes.admissao', k, `Admissão · ${Regras.ROTULOS[k]}`, l, C, `M${l} = SUM(I${l}:L${l})`));
  [['transferencia', 31], ['falecimento', 32], ['exclusao', 33], ['ordenacao', 34]]
    .forEach(([k, l]) => trio('comungantes.demissao', k, `Demissão · ${Regras.ROTULOS[k]}`, l, C, `M${l} = SUM(I${l}:L${l})`));
  trio('comungantes', 'rol_separado', 'Rol separado', 35, C, 'M35 = SUM(I35:L35)', { consolida: 'Soma' });
  trio('comungantes', 'diferenca', 'Diferença (admissões − demissões)', 36, C, 'I36 = (I25+…+I30) − (I31+…+I34); idem K; M36 = I36 + K36',
    { validacao: 'Pode ser negativa; deve ser admissões − demissões', unidade: 'pessoas (saldo)' });
  trio('comungantes', 'ano_anterior', 'Comungantes no ano anterior', 37, C, 'M37 = SUM(I37:L37)', { periodo: 'Fim do exercício anterior' });
  trio('comungantes', 'ano_atual', 'Comungantes no ano atual', 38, C, 'I38 = I37 + I36; K38 = K37 + K36; M38 = I38 + K38',
    { periodo: 'Fim do exercício', validacao: 'Calculado pelo modelo: ano anterior + diferença. Valor digitado por cima da fórmula gera divergência' });
  [['batismo', 25], ['transferencia', 26], ['jurisdicao_ex_officio', 27]]
    .forEach(([k, l]) => trio('nao_comungantes.admissao', k, `Admissão · ${Regras.ROTULOS[k]}`, l, N, `AB${l} = X${l} + Z${l}`));
  [['profissao_fe', 31], ['transferencia', 32], ['falecimento', 33], ['exclusao', 34]]
    .forEach(([k, l]) => trio('nao_comungantes.demissao', k, `Demissão · ${Regras.ROTULOS[k]}`, l, N, `AB${l} = X${l} + Z${l}`));
  trio('nao_comungantes', 'diferenca', 'Diferença (admissões − demissões)', 35, N, 'X35 = (X25+X26+X27) − (X31+…+X34); idem Z; AB35 = X35 + Z35',
    { validacao: 'Pode ser negativa; deve ser admissões − demissões', unidade: 'pessoas (saldo)' });
  trio('nao_comungantes', 'ano_anterior', 'Não comungantes no ano anterior', 36, N, 'AB36 = X36 + Z36', { periodo: 'Fim do exercício anterior' });
  trio('nao_comungantes', 'ano_atual', 'Não comungantes no ano atual', 37, N, 'X37 = X35 + X36; Z37 = Z35 + Z36; AB37 = X37 + Z37', { periodo: 'Fim do exercício' });
  add({ id: 'rol_atual', rotulo: 'Rol atual (comungantes + não comungantes)', grupo: 'Não comungantes', celulas: ['X38', 'Z38', 'AB38'], tipo: 'masc. · fem. · total',
    unidade: 'pessoas', periodo: 'Fim do exercício', formula: 'X38 = I38 + X37; Z38 = K38 + Z37; AB38 = X38 + Z38',
    validacao: 'Deve ser comungantes atuais + não comungantes atuais', painel: 'Igreja › Visão geral; Presbitério › total de membros' });

  // ---------- Finanças (realizado H, previsto W) ----------
  const FIN = [['saldo_anterior', 'Saldo do ano anterior', 45], ...Regras.RECEITAS.map(([k, r], i) => [k, `Receita · ${r}`, 47 + i]),
    ['total_receita', 'Total da receita anual', 55, 'SUM(linhas 47 a 54)'], ['grande_total', 'Grande total (saldo + receita)', 56, 'Total da receita + saldo anterior'],
    ...Regras.DESPESAS.map(([k, r], i) => [k, `Despesa · ${r}`, 59 + i]),
    ['total_despesa', 'Total da despesa anual', 69, 'SUM(linhas 59 a 68)'], ['saldo_seguinte', 'Saldo para o ano seguinte', 70, 'Grande total − total da despesa']];
  const OBS_FIN = { parcerias: 'Valores de parceria com PMC, JMN, Projeto Capela e outros (nota do modelo)', causas_locais: 'Inclui as demais despesas administrativas em geral (nota do modelo)' };
  for (const [lado, col, nome, periodo] of [['realizado', 'H', 'Realizado', 'Exercício (movimento do ano)'], ['previsto', 'W', 'Previsto', 'Próximo exercício (orçamento)']]) {
    for (const [k, r, l, f] of FIN) {
      add({ id: `financeiro.${lado}.${k}`, rotulo: `${r} — ${nome.toLowerCase()}`, grupo: `Finanças — ${nome}`, celulas: [`${col}${l}`], tipo: 'moeda', unidade: 'R$',
        periodo, formula: f ? `${col}${l} = ${f}` : '', validacao: k.startsWith('saldo') ? 'Pode ser negativo' : 'Valor ≥ 0', obs: OBS_FIN[k] || '',
        consolida: 'Soma (só valores informados); realizado e previsto nunca se misturam', painel: 'Igreja › Finanças; Presbitério › Receita/Despesa' });
    }
  }

  // ---------- Conselho ou Mesa (vida ministerial e administração) ----------
  const cm = (k, r, grupo, cels, tipo = 'inteiro', extra = {}) => add({ id: `conselho.${k}`, rotulo: r, grupo, aba: CM, celulas: cels, tipo,
    unidade: tipo === 'texto' ? '—' : 'quantidade', periodo: 'Exercício', validacao: tipo === 'texto' ? 'Texto livre' : 'Inteiro ≥ 0',
    consolida: tipo === 'texto' ? 'Não se aplica' : 'Soma (só valores informados)', painel: 'Igreja › Ministério' + (tipo === 'texto' ? '' : '; Presbitério › Vida ministerial'), ...extra });
  cm('congregacoes', '1.6 Quantas congregações da igreja', 'Organização', ['U17'], 'inteiro', { obs: 'Repete o campo da aba Cadastro; não é somado duas vezes', consolida: 'Não somado (usa Estrutura › Congregações)' });
  cm('ceia_grupos', '2.1.1 Celebrações da Santa Ceia em grupos', 'Adoração e comunhão', ['K20']);
  cm('ceia_individuos', 'Ministrações da Ceia a indivíduos', 'Adoração e comunhão', ['X20']);
  cm('ceia_total', 'Santa Ceia — total geral', 'Adoração e comunhão', ['AC20'], 'inteiro', { formula: 'AC20 = K20 + X20', validacao: 'Deve ser grupos + indivíduos' });
  cm('atividades_evangelisticas', '2.2.1 Atividades evangelísticas', 'Evangelização e missões', ['I22'], 'inteiro', { obs: 'Em templos, residências, recintos públicos, ao ar livre e pela imprensa, rádio e TV' });
  cm('biblias', '2.2.2 Bíblias distribuídas', 'Evangelização e missões', ['I23']);
  cm('novos_testamentos', 'Novos Testamentos distribuídos', 'Evangelização e missões', ['O23']);
  cm('folhetos', 'Folhetos distribuídos', 'Evangelização e missões', ['R23']);
  cm('outras_literaturas', 'Outras literaturas distribuídas', 'Evangelização e missões', ['X23']);
  cm('textos_total', 'Textos distribuídos — total geral', 'Evangelização e missões', ['AC23'], 'inteiro', { formula: 'AC23 = I23 + O23 + R23 + X23', validacao: 'Deve ser a soma dos textos' });
  cm('outra_participacao_missionaria', '2.2.4 Outra participação missionária', 'Evangelização e missões', ['H25'], 'texto');
  cm('grupos_corais', '2.3.5 Grupos corais', 'Educação e aperfeiçoamento', ['Y27']);
  cm('conjuntos_musicais', '2.3.6 Conjuntos musicais', 'Educação e aperfeiçoamento', ['Y28']);
  cm('discipulados', '2.3.7 Discipulados realizados', 'Educação e aperfeiçoamento', ['Y29']);
  cm('atos_beneficentes_junta', '2.4.1 Atos beneficentes da Junta Diaconal', 'Ação social e visitação', ['M32']);
  cm('atos_beneficentes_outros', 'Atos beneficentes de outros departamentos', 'Ação social e visitação', ['V32']);
  cm('atos_beneficentes_total', 'Atos beneficentes — total geral', 'Ação social e visitação', ['AB32'], 'inteiro', { formula: 'AB32 = M32 + V32', validacao: 'Deve ser junta + outros' });
  cm('visitas_oficiais', '2.4.2 Visitas de presbíteros e diáconos', 'Ação social e visitação', ['M33']);
  cm('visitas_outros', 'Visitas de outros departamentos', 'Ação social e visitação', ['V33']);
  cm('visitas_total', 'Visitas — total geral', 'Ação social e visitação', ['AB33'], 'inteiro', { formula: 'AB33 = M33 + V33', validacao: 'Deve ser oficiais + outros' });
  [['reunioes_conselho', '3.2 Reuniões do Conselho'], ['reunioes_junta', '3.3 Reuniões da Junta Diaconal'], ['reunioes_assembleia', '3.4 Assembleias gerais'],
    ['reunioes_mesa_congregacao', '3.5 Reuniões da Mesa Administrativa da congregação'], ['reunioes_exame_contas', '3.6 Reuniões da Comissão de Exame de Contas']]
    .forEach(([k, r], i) => cm(k, r, 'Supervisão administrativa', [`M${36 + i}`]));
  cm('mandato_vencer_presbiteros', '3.8 Presbíteros com mandato a vencer', 'Supervisão administrativa', ['T42'], 'inteiro', { periodo: 'Próximo exercício' });
  cm('mandato_vencer_diaconos', '3.8 Diáconos com mandato a vencer', 'Supervisão administrativa', ['Z42'], 'inteiro', { periodo: 'Próximo exercício' });
  cm('conselheiros_sociedades', '3.10 Conselheiros nomeados às sociedades (quais)', 'Supervisão administrativa', ['P43'], 'texto');
  cm('causas_extralocais', '3.11 Causas extralocais apoiadas (quais)', 'Supervisão administrativa', ['R44'], 'texto');
  cm('reforma_projeto', '3.13 Reforma/construção em projeto', 'Supervisão administrativa', ['I46', 'A47'], 'texto');
  cm('reforma_andamento', '3.14 Reforma/construção em andamento', 'Supervisão administrativa', ['Y46', 'P47'], 'texto');
  cm('objetivos_alcancados', '4.2 Objetivos propostos e alcançados', 'Planejamento estratégico', ['A53'], 'texto');
  cm('objetivos_nao_alcancados', '4.3 Objetivos não alcançados e dificuldades', 'Planejamento estratégico', ['A57'], 'texto');

  // Perguntas Sim/Não: no modelo são caixas de seleção soltas (sem célula ligada) — ainda não lidas
  const SIM_NAO = [
    ['1.1 Os imóveis estão documentados?', 'Organização'], ['1.2 Há inventário dos móveis e utensílios?', 'Organização'], ['1.3 Os róis de membros estão atualizados?', 'Organização'],
    ['1.4 Apresentou declarações do ano anterior (IRenda, RAIS, DIRF)?', 'Organização'], ['1.5 Inventário atualizado?', 'Organização'],
    ['2.2.3 Trabalho missionário com JMN, APMT, PMC, plantação de igrejas', 'Evangelização e missões'],
    ['2.3.1 a 2.3.4 Treinamento para professores, música, oficiais e liderança', 'Educação e aperfeiçoamento'],
    ['3.1 Enviou fielmente os dízimos à Tesouraria IPB?', 'Supervisão administrativa'], ['3.7 Exame dos balancetes da tesouraria', 'Supervisão administrativa'],
    ['3.8 Há oficiais com mandato a vencer?', 'Supervisão administrativa'], ['3.9 Exame dos livros das sociedades', 'Supervisão administrativa'],
    ['3.10 Nomeação de conselheiros às sociedades', 'Supervisão administrativa'], ['3.11 Contribuição para causas extralocais', 'Supervisão administrativa'],
    ['3.12 Previdência do(s) pastor(es) (INSS, FAP, IPB-PREV)', 'Supervisão administrativa'], ['4.1 Tem planejamento estratégico?', 'Planejamento estratégico'],
    ['5.1 a 5.4 Seguro, alvará, licença dos bombeiros, certificado digital', 'Patrimônio'],
  ];
  SIM_NAO.forEach(([r, g], i) => add({ id: `conselho.sim_nao_${i + 1}`, rotulo: r, grupo: g, aba: CM, celulas: [], tipo: 'sim/não', unidade: '—', periodo: 'Exercício',
    validacao: 'Caixa de seleção do Excel', consolida: 'Contagem de igrejas (quando lido)', painel: 'Igreja › Ministério', pendente: true,
    obs: 'Pendente: as caixas do modelo não têm célula ligada. Para mapear, é preciso um Excel preenchido com as caixas marcadas.' }));

  // Rótulos que confirmam o modelo v8.0 antes de ler por posição
  const CONFERIR = {
    [CE]: { A15: 'PASTORES', K15: 'CONGREGACOES DA IGREJA', B27: 'TRANSFERENCIA', A38: 'COMUNGANTES ANO ATUAL', P37: 'NAO-COMUNGANTES ANO ATUAL', A47: 'DIZIMOS', P47: 'DIZIMOS', A69: 'TOTAL DA DESPESA ANUAL' },
    [CM]: { A20: '2.1.1', A22: '2.2.1', A32: '2.4.1', B36: '3.2' },
  };

  // Células que no modelo são fórmulas: se chegarem sem fórmula, a igreja digitou um valor por cima
  const faixa = (cols, de, ate) => cols.flatMap((c) => Array.from({ length: ate - de + 1 }, (_, i) => `${c}${de + i}`));
  const FORMULAS = {
    [CE]: new Set([...faixa(['M'], 25, 38), 'I36', 'K36', 'I38', 'K38', ...faixa(['AB'], 25, 27), ...faixa(['AB'], 31, 38), 'X35', 'Z35', 'X37', 'Z37', 'X38', 'Z38',
      'Y22', 'AB22', ...['H', 'W'].flatMap((c) => [55, 56, 69, 70, 71].map((l) => `${c}${l}`))]),
    [CM]: new Set(['AC20', 'AC23', 'AB32', 'AB33']),
  };

  return { campos, CONFERIR, FORMULAS, ABAS: { CE, CM, CG: 'Congregação' } };
})();
