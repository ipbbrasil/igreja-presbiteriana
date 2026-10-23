// Central de ajuda: o que o aplicativo faz, passo a passo de cada função e todas as configurações.
// Cada tópico indica para quem vale; a busca filtra pelo texto.
window.Ajuda = (() => {
  const chip = (s) => { const x = Regras.STATUS[s]; return `<span class="chip ${x.cls}"><b aria-hidden="true">${x.icon}</b>${x.label}</span>`; };
  const PARA = { todos: 'Todos', admin: 'Administrador', rep: 'Representante', tec: 'Superadministrador / técnico' };

  const TOPICOS = [
    {
      id: 'visao', titulo: 'O que é o sistema', para: ['todos'], html: `
      <p>Plataforma para <strong>receber, conferir e consolidar</strong> os relatórios estatísticos anuais das igrejas (modelo oficial CSM-IPB “Informações Cadastrais e Estatísticas de Comunidade Presbiteriana”). É uma ferramenta de apoio: <strong>não substitui as atribuições dos concílios</strong> nem a validação oficial dos relatórios.</p>
      <p>A organização segue a estrutura da IPB: <strong>Igrejas → Presbitério → Sínodo → Nacional</strong>. Cada pessoa só vê o que corresponde ao seu acesso.</p>
      <h4>O ciclo de um relatório</h4>
      <ol class="aj-passos">
        <li><strong>Convite:</strong> o administrador do presbitério convida o representante da igreja.</li>
        <li><strong>Envio:</strong> o representante envia o relatório (PDF ou Excel). O arquivo é conferido no próprio aparelho e o representante vê a <strong>prévia dos números</strong> antes de enviar.</li>
        <li><strong>Leitura:</strong> PDF digital e Excel do modelo oficial são lidos automaticamente; PDF escaneado é digitado pelo administrador.</li>
        <li><strong>Conferência:</strong> o sistema refaz 14 somas, aponta problemas do documento e variações relevantes no ano.</li>
        <li><strong>Decisão:</strong> o administrador valida, pede correção ou corrige os dados. Tudo fica no histórico e no registro de ações.</li>
        <li><strong>Consolidação:</strong> os relatórios validados formam os totais do presbitério, do sínodo e a visão nacional, que podem ser exportados.</li>
        <li><strong>Fechamento:</strong> ao fim do recebimento, o administrador fecha o exercício e os números validados passam a ser o resultado oficial.</li>
      </ol>
      <div class="banner info"><b>i</b><div><strong>Regra de ouro:</strong> campo vazio no relatório é <em>não informado</em> — nunca é tratado como zero. Por isso cada total mostra quantas igrejas contribuíram (ex.: “10 de 11 igrejas”), e todo número sublinhado mostra de onde veio.</div></div>`,
    },
    {
      id: 'perfis', titulo: 'Perfis de acesso: quem pode o quê', para: ['todos'], html: `
      <div class="tbl-wrap"><table class="tbl aj-tbl"><thead><tr><th>Função</th><th>Representante</th><th>Adm. presbitério</th><th>Adm. sínodo</th><th>Superadmin</th></tr></thead><tbody>
        <tr><td>Ver dados e PDF da própria igreja</td><td>✓</td><td>✓</td><td>✓</td><td>—</td></tr>
        <tr><td>Ver todas as igrejas do presbitério</td><td>—</td><td>✓</td><td>✓ (do sínodo)</td><td>—</td></tr>
        <tr><td>Consultar relatórios das igrejas (regra do banco de dados)</td><td>só a própria</td><td>do presbitério</td><td>do sínodo</td><td>todos (sem tela de igreja)</td></tr>
        <tr><td>Enviar relatório (com prévia)</td><td>só da própria igreja</td><td>de qualquer igreja do presbitério</td><td>—</td><td>—</td></tr>
        <tr><td>Ler agora (leitura automática)</td><td>✓ (próprios envios)</td><td>✓</td><td>—</td><td>—</td></tr>
        <tr><td>Digitar / corrigir dados</td><td>—</td><td>✓</td><td>—</td><td>—</td></tr>
        <tr><td>Validar ou pedir correção</td><td>—</td><td>✓</td><td>—</td><td>—</td></tr>
        <tr><td>Fechar / reabrir o exercício</td><td>—</td><td>✓</td><td>—</td><td>—</td></tr>
        <tr><td>Exportar Excel / PDF do presbitério</td><td>—</td><td>✓</td><td>✓</td><td>—</td></tr>
        <tr><td>Convidar e remover usuários</td><td>—</td><td>✓</td><td>—</td><td>só o 1º administrador de cada presbitério</td></tr>
        <tr><td>Cadastro de igrejas e transferências</td><td>—</td><td>✓</td><td>—</td><td>—</td></tr>
        <tr><td>Registro de ações e cópia de segurança</td><td>—</td><td>✓</td><td>—</td><td>—</td></tr>
        <tr><td>Visão do sínodo e visão nacional (totais)</td><td>—</td><td>✓</td><td>✓</td><td>✓</td></tr>
        <tr><td>Cadastro de sínodos e presbitérios</td><td>—</td><td>—</td><td>—</td><td>✓</td></tr>
      </tbody></table></div>
      <p class="nota">O menu se adapta ao perfil: o representante vê <em>Minha igreja, Enviar, Perfil</em>; o administrador do presbitério vê <em>Presbitério, Igrejas, Conferência, Sínodo, Perfil</em>; o superadministrador vê <em>Nacional, Estrutura, Perfil</em>. Ajuda, Dicionário de dados e Aviso de privacidade estão disponíveis para todos.</p>`,
    },
    {
      id: 'entrar', titulo: 'Entrar, sair e senha', para: ['todos'], html: `
      <ul>
        <li><strong>Entrar:</strong> e-mail e senha cadastrados. Marque <em>Mostrar senha</em> para conferir o que digitou.</li>
        <li><strong>Primeiro acesso:</strong> é feito pelo <strong>link de convite</strong> enviado pelo administrador (veja “Usuários e convites”). Ao criar a conta, a pessoa confirma que leu o <strong>aviso de privacidade</strong>.</li>
        <li><strong>Privacidade (LGPD):</strong> o aviso explica quais dados são tratados, quem tem acesso e os seus direitos. Fica na tela de login e em <em>Perfil → Aviso de privacidade</em>.</li>
        <li><strong>Sair:</strong> Perfil → <em>Sair</em>. Use sempre que trocar de usuário no mesmo aparelho.</li>
        <li><strong>Esqueci a senha:</strong> peça ao administrador do presbitério; o responsável técnico redefine a senha e você entra com a nova.</li>
        <li><strong>Sessão aberta:</strong> depois de entrar, o aparelho continua conectado até você tocar em <em>Sair</em>. Com o app instalado, normalmente basta entrar uma vez.</li>
      </ul>
      <h4>Entrar com digital ou Face ID</h4>
      <p>Use o cofre de senhas do próprio celular: ele guarda o e-mail e a senha e só preenche depois de confirmar a sua biometria.</p>
      <ul>
        <li><strong>iPhone (Face ID / Touch ID):</strong> entre uma vez digitando e-mail e senha e toque em <em>Salvar senha</em> quando o iPhone perguntar. Nas próximas vezes, toque no campo de e-mail, escolha a conta sugerida acima do teclado e confirme com o Face ID. Se não aparecer: <em>Ajustes → Senhas → Opções de Senha → Preencher Senhas Automaticamente</em>.</li>
        <li><strong>Android (digital / rosto):</strong> entre uma vez e toque em <em>Salvar</em> quando o Google perguntar. Nas próximas vezes, toque no campo de e-mail, escolha a conta e confirme com a digital. Se não aparecer: <em>Configurações → Google → Gerenciador de senhas</em> (ou <em>Preenchimento automático</em>).</li>
        <li><strong>Mais de um usuário no mesmo celular</strong> (ex.: administrador e representante): o cofre guarda as duas senhas — escolha a conta certa na sugestão.</li>
      </ul>`,
    },
    {
      id: 'painel', titulo: 'Painel do presbitério', para: ['admin'], html: `
      <p>Tela inicial do administrador com os números consolidados do exercício.</p>
      <ul>
        <li><strong>Exercício:</strong> o seletor no topo troca o ano mostrado em todo o aplicativo (painel, igrejas, conferência, sínodo e nacional). A escolha fica salva neste aparelho; o padrão é o ano mais recente com relatórios.</li>
        <li><strong>Resumo executivo:</strong> um texto curto com cobertura, membresia, movimentação, Escola Dominical, finanças e pontos de atenção (relatórios em correção, igrejas que não enviaram, variações não explicadas). É gerado por regras fixas a partir dos números, sem estimativas nem juízo sobre as igrejas. Botão <em>Copiar texto</em> para colar em atas ou mensagens; também vai no PDF.</li>
        <li><strong>Evolução histórica:</strong> um minigráfico por indicador (rol de membros, comungantes, alunos da Escola Dominical e receita) ao longo dos exercícios. O ponto vazado com linha tracejada é o valor informado como “ano anterior” no relatório seguinte — assim, já no primeiro ano há dois pontos. Se o conjunto de igrejas muda entre os anos, um aviso alerta que parte da mudança pode ser cobertura e não crescimento real.</li>
        <li><strong>Somente validados / Todos recebidos:</strong> escolhe quais relatórios entram nos totais. O padrão é <em>somente validados</em>; “todos” mostra um aviso de que inclui dados não conferidos. Essa escolha vale também para a exportação.</li>
        <li><strong>Membros, comungantes e não comungantes:</strong> com a variação do ano (calculada só com igrejas que informaram os dois anos). <strong>Toque no número</strong> para ver quais igrejas compõem o total.</li>
        <li><strong>Igrejas consideradas:</strong> “X de Y” compara com todas as igrejas cadastradas, incluindo as que <strong>não enviaram</strong>.</li>
        <li><strong>Aviso no topo:</strong> “resultado parcial” enquanto há igrejas sem relatório validado; “resultado oficial” depois que o exercício é fechado.</li>
        <li><strong>Recebimento dos relatórios:</strong> barra com a situação de cada relatório, inclusive “Não enviado”; toque para ir à Conferência.</li>
        <li><strong>Indicadores:</strong> Escola Dominical (alunos e professores), receita e despesa realizadas. Abaixo de cada um: “n de m igrejas” que informaram.</li>
        <li><strong>Variações relevantes no ano:</strong> compara o ano anterior com o atual (comungantes, não comungantes, rol e alunos da Escola Dominical) e lista as mudanças acima do limite escolhido (padrão 15% e pelo menos 5 pessoas; ajustável de 10% a 30%). Cada uma vem classificada: <em>alta/queda real</em> (a movimentação de admissões e demissões explica), <em>informada</em> (não há movimentação para conferir) ou <em>verificar dado</em> (a mudança não bate com o que foi registrado — provável erro).</li>
        <li><strong>Gráficos por igreja:</strong> comungantes e receita. Toque em uma igreja para abrir a página dela.</li>
        <li><strong>Movimentação de comungantes:</strong> admissões e demissões por tipo e o saldo do período.</li>
        <li><strong>Mapa por UF:</strong> mapa do Brasil com os estados onde estão as igrejas do presbitério pintados conforme o indicador escolhido em <em>Mostrar</em>: rol de membros (relatórios validados), igrejas cadastradas ou % de relatórios validados. Toque em um estado para ver os números. Abaixo do mapa, a lista dos estados com dados, do maior para o menor valor.</li>
        <li><strong>Composição das despesas</strong>, <strong>Liderança formal</strong> e <strong>Vida ministerial</strong> (Santa Ceia, evangelização, visitas… — dos relatórios enviados em Excel).</li>
        <li><strong>Exportar:</strong> planilha Excel e resumo em PDF (veja “Exportação”).</li>
      </ul>`,
    },
    {
      id: 'igreja', titulo: 'Igrejas e a página de cada igreja', para: ['todos'], html: `
      <p><strong>Igrejas</strong> (administrador): lista com busca, situação de cada relatório, pendências e selo de <em>variação relevante</em>. As igrejas que ainda não enviaram aparecem como <strong>Não enviado</strong> (tocar abre o envio em nome da igreja). Botões <em>Enviar relatório</em> e <em>Cadastro de igrejas</em>. O representante vai direto para <strong>Minha igreja</strong>.</p>
      <h4>Abas da página da igreja</h4>
      <ul>
        <li><strong>Visão geral:</strong> rol de membros, comungantes, Escola Dominical, finanças, liderança, estrutura, a <strong>evolução da igreja</strong> ao longo dos exercícios e as <strong>variações no ano</strong>. O seletor de <strong>exercício</strong> no topo mostra os relatórios de outros anos.</li>
        <li><strong>Membresia:</strong> admissões e demissões por tipo e sexo, evolução do ano anterior para o atual.</li>
        <li><strong>Educação:</strong> Escola Dominical e departamentos internos (UCP, UPA, UMP, SAF, UPH).</li>
        <li><strong>Finanças:</strong> receitas e despesas — realizado no ano e previsão para o próximo.</li>
        <li><strong>Ministério:</strong> vida ministerial e administração (Santa Ceia, evangelização, textos distribuídos, discipulados, ação social, visitas, reuniões, mandatos, reformas e planejamento). Só aparece quando o relatório foi enviado em Excel com a aba “Conselho ou Mesa” preenchida. A aba “Congregação” aparece à parte, sem somar aos totais da igreja.</li>
        <li><strong>Conferência:</strong> verificações de soma, alertas da leitura, origem dos dados, arquivos enviados e histórico. O número na aba indica pendências.</li>
      </ul>
      <p><strong>Relatório em PDF:</strong> o botão no topo gera um PDF com identificação, membresia e movimentação, liderança, Escola Dominical, departamentos, finanças (realizado × previsto), vida ministerial (quando houver), variações no ano, as 14 verificações e os alertas da leitura. Indica se o relatório está validado. Disponível para o administrador e para o representante.</p>
      <p class="nota">Em todas as tabelas, “—” significa <em>não informado</em> e 0 significa <em>informado como zero</em>.</p>`,
    },
    {
      id: 'rastreio', titulo: 'De onde vem cada número (rastreabilidade)', para: ['todos'], html: `
      <p>Todo número <span class="aj-rv">sublinhado</span> pode ser tocado para ver a sua origem:</p>
      <ul>
        <li><strong>Indicador</strong>, igreja e ano de referência.</li>
        <li><strong>Documento original</strong>, com botão para abri-lo.</li>
        <li><strong>Onde está no documento:</strong> no PDF, a página e o trecho exato da linha; no Excel, a aba e a célula.</li>
        <li><strong>Data da extração</strong> e <strong>situação da validação</strong>.</li>
        <li><strong>Fórmula e regra</strong> do modelo oficial para aquele campo.</li>
        <li><strong>Correções manuais</strong> naquele campo (data e valor antes → depois).</li>
      </ul>
      <p>Nos <strong>totais do presbitério</strong> (membros, comungantes, Escola Dominical, receita, despesa), o toque mostra quais igrejas compõem a soma, quais não informaram e quais ficaram de fora por não estarem validadas. Cada valor da lista leva à sua origem.</p>
      <p class="nota">Relatórios de PDF escaneado mostram a seção do formulário e a célula do modelo, pois não há texto para localizar a linha.</p>`,
    },
    {
      id: 'enviar', titulo: 'Enviar relatório', para: ['rep', 'admin'], html: `
      <ol class="aj-passos">
        <li><strong>Relatório:</strong> escolha a igreja (o representante já vem com a sua) e o exercício.</li>
        <li><strong>Arquivo:</strong> toque para escolher o relatório preenchido no modelo oficial — <strong>PDF ou Excel (.xlsx), até 10 MB</strong>. Prefira o <strong>Excel</strong> ou o <strong>PDF gerado direto do Excel</strong>: são lidos automaticamente. PDF de papel escaneado precisa ser digitado.</li>
        <li><strong>Verificação:</strong> o arquivo é analisado no próprio aparelho, antes do envio.</li>
        <li><strong>Prévia dos dados lidos:</strong> confira os números (membresia, liderança, Escola Dominical, departamentos, finanças), as somas que não fecham e os campos em branco.</li>
        <li>Marque <em>“Conferi os valores da prévia e confirmo que este é o relatório oficial aprovado pelo Conselho”</em> e toque em <strong>Enviar relatório</strong>.</li>
      </ol>
      <h4>O que é verificado antes do envio</h4>
      <ul>
        <li>Formato e tamanho; se o PDF é <strong>digital</strong> (texto) ou <strong>digitalizado</strong> (imagem escaneada).</li>
        <li>Se é o <strong>modelo oficial</strong> e qual versão (ex.: CSM-IPB 2021 v8.0).</li>
        <li>Se o <strong>ano</strong> do documento é o exercício escolhido — ano diferente <strong>impede o envio</strong>.</li>
        <li>Se o <strong>nome da igreja</strong> no documento confere (aviso, não impede).</li>
        <li>Se o <strong>mesmo arquivo</strong> já foi enviado — duplicado <strong>impede o envio</strong>.</li>
        <li>Em PDF digital ou Excel: <strong>leitura dos números</strong> e as <strong>somas</strong>, para você corrigir antes de enviar se algo não fechar.</li>
      </ul>
      <p>Verde = ok · amarelo = aviso (pode enviar) · vermelho = impede o envio.</p>
      <p>O arquivo original fica guardado em uma pasta <strong>privada</strong>; só quem tem acesso à igreja consegue baixá-lo (link temporário de 10 minutos).</p>
      <p class="nota">Com o <strong>exercício fechado</strong>, não são aceitos novos relatórios daquele ano até o administrador reabri-lo.</p>`,
    },
    {
      id: 'leitura', titulo: 'Leitura automática e versões', para: ['todos'], html: `
      <p>Em <strong>PDF digital</strong> e em <strong>Excel (.xlsx)</strong> do modelo oficial, o sistema lê sozinho todos os campos: liderança, estrutura, departamentos, admissões e demissões (por sexo), rol e finanças (realizado e previsto). PDF e Excel geram exatamente os mesmos campos, e cada valor guarda a sua origem no documento.</p>
      <ul>
        <li><strong>Excel:</strong> lido célula a célula conforme o <a href="#/dicionario">Dicionário de dados</a>. Também lê a aba <em>Conselho ou Mesa</em> (Santa Ceia, evangelização, visitas, reuniões, planejamento) e a aba <em>Congregação</em>, mostradas na aba <strong>Ministério</strong> da igreja. Use o modelo oficial sem inserir ou apagar linhas.</li>
        <li>No Excel, se a igreja digitar um número por cima de uma fórmula do modelo (ex.: comungantes do ano atual), o sistema avisa — é a causa mais comum de somas que não fecham.</li>
        <li>A leitura acontece no envio. Se não acontecer, o administrador (ou quem enviou) usa <strong>Ler agora</strong> na lista de envios.</li>
        <li>Cada leitura cria uma <strong>nova versão</strong> do relatório em <em>Aguardando conferência</em>; a versão anterior vira <em>Substituída</em> e nada é apagado.</li>
        <li><strong>Alertas da leitura</strong> apontam problemas do documento: erro de planilha (#REF!), sigla de sínodo/presbitério diferente, nome em branco, linhas fora do modelo, versão não identificada.</li>
        <li><strong>PDF escaneado</strong> não é lido automaticamente: o administrador usa <strong>Digitar dados</strong>. O reconhecimento de imagem (OCR) foi testado e ainda não tem precisão suficiente; uma alternativa por inteligência artificial está em avaliação.</li>
        <li>As perguntas <strong>Sim/Não</strong> do Excel (documentação, previdência, seguro…) são caixas de seleção e ainda não são lidas.</li>
      </ul>`,
    },
    {
      id: 'conferencia', titulo: 'Conferência e validação', para: ['admin'], html: `
      <h4>Situações de um relatório</h4>
      <ul class="aj-status">
        <li>${chip('nao_enviado')} a igreja ainda não mandou relatório.</li>
        <li>${chip('recebido')} arquivo chegou, ainda não lido.</li>
        <li>${chip('aguardando_conferencia')} números lidos ou digitados; falta a decisão do administrador.</li>
        <li>${chip('aguardando_correcao')} o administrador pediu correção à igreja.</li>
        <li>${chip('validado')} conferido; entra nos totais “somente validados”.</li>
        <li>${chip('substituido')} versão antiga, trocada por uma mais nova (fica no histórico).</li>
      </ul>
      <h4>As 14 verificações automáticas</h4>
      <ul>
        <li>Comungantes e não comungantes: admissões − demissões = diferença; ano anterior + diferença = ano atual.</li>
        <li>Rol atual = comungantes + não comungantes.</li>
        <li>Realizado e previsto: soma das receitas = total; saldo anterior + receita = grande total; soma das despesas = total; grande total − despesa = saldo seguinte.</li>
        <li>Saldo inicial previsto = saldo final realizado.</li>
      </ul>
      <p>“Não verificável” aparece quando falta algum dos campos da soma.</p>
      <h4>Decisão</h4>
      <ul>
        <li><strong>Validar relatório</strong> · <strong>Solicitar correção</strong> (comentário obrigatório) · <strong>Voltar para conferência</strong> · <strong>Corrigir dados</strong>.</li>
        <li>A tela <strong>Conferência</strong> do menu traz o quadro do <strong>exercício</strong>, os arquivos recém-recebidos, os relatórios agrupados por situação e as igrejas que não enviaram.</li>
        <li>Com o exercício <strong>fechado</strong>, os botões de decisão e de correção ficam indisponíveis.</li>
      </ul>`,
    },
    {
      id: 'exercicio', titulo: 'Fechamento do exercício e igrejas que não enviaram', para: ['admin'], html: `
      <p>Na tela <strong>Conferência</strong>, o quadro <strong>Exercício</strong> mostra igrejas cadastradas, relatórios recebidos, validados, pendentes e <strong>não enviados</strong>.</p>
      <ul>
        <li><strong>Não enviado:</strong> igreja ativa (ou congregação presbiterial) vinculada ao presbitério que ainda não mandou relatório. Aparece no painel, na lista de igrejas, na Conferência e nas exportações; tocar nela abre o envio em nome da igreja. Congregações de uma igreja não são cobradas à parte.</li>
        <li><strong>Fechar exercício:</strong> ao fim do recebimento, o administrador fecha o ano. Os relatórios <strong>validados</strong> passam a ser o <strong>resultado oficial</strong>; o sistema lista antes quem ficará de fora. Comentário opcional (ex.: data da reunião que aprovou).</li>
        <li><strong>Com o exercício fechado</strong>, o próprio banco de dados recusa novos envios, leituras, correções e mudanças de situação daquele ano. O painel e as exportações passam a dizer “resultado oficial”.</li>
        <li><strong>Reabrir:</strong> exige motivo. Fechamentos e reaberturas ficam no <strong>Histórico do exercício</strong> e no registro de ações.</li>
      </ul>`,
    },
    {
      id: 'digitar', titulo: 'Digitação e correção manual', para: ['admin'], html: `
      <ul>
        <li><strong>Corrigir dados:</strong> na Conferência de uma igreja. Abre o formulário já preenchido.</li>
        <li><strong>Digitar dados:</strong> na lista de envios, para PDF escaneado (ou planilha fora do modelo). Abre o formulário em branco, com botão para abrir o arquivo original.</li>
        <li>O formulário segue o modelo oficial: liderança, estrutura, departamentos, comungantes, não comungantes, rol atual e finanças.</li>
        <li><strong>Campo vazio = não informado.</strong> Valores em reais no formato 1.234,56.</li>
        <li>Cores: <span class="aj-cor mud">amarelo</span> alterado · <span class="aj-cor inc">sublinhado</span> masc. + fem. ≠ total · <span class="aj-cor inv">vermelho</span> valor inválido (impede salvar).</li>
        <li>A barra do topo mostra quantas alterações e se as somas conferem, atualizando a cada número.</li>
        <li>Ao salvar, o relatório volta para <em>Aguardando conferência</em>; o histórico registra quem alterou, quando e cada valor (antes → depois), e a rastreabilidade de cada número mostra a correção. Uma cópia completa dos dados anteriores fica guardada.</li>
        <li>Indisponível com o exercício fechado.</li>
      </ul>`,
    },
    {
      id: 'exportar', titulo: 'Exportação (Excel e PDF)', para: ['admin'], html: `
      <p>No fim do painel do presbitério, quadro <strong>Exportar</strong>. Usa os mesmos relatórios do painel (somente validados ou todos) e informa a situação do exercício (aberto/parcial ou fechado/oficial).</p>
      <ul>
        <li><strong>Planilha Excel</strong> com 7 abas: Resumo, Membresia, Estrutura, Vida ministerial, Finanças realizado, Finanças previsto e Situação (todas as igrejas, inclusive as que não enviaram). Cada aba de dados termina com <em>Total</em> e <em>Igrejas que informaram</em> (fórmulas). Não informado = célula vazia.</li>
        <li><strong>Resumo em PDF</strong> (A4): resumo executivo em texto, indicadores consolidados, tabela por igreja com total e a lista de relatórios pendentes ou fora do resultado oficial. Ideal para imprimir ou enviar por WhatsApp.</li>
        <li><strong>Relatório da igreja em PDF:</strong> na página de cada igreja (veja “Igrejas e a página de cada igreja”).</li>
        <li><strong>Relatórios sinodal e nacional:</strong> no fim das telas do sínodo e da visão nacional, quadro <strong>Exportar</strong> com planilha Excel (Resumo, Por presbitério, Por UF) e resumo em PDF. Trazem somente totais agregados de relatórios validados, com quantas igrejas informaram cada número e o aviso de dados parciais.</li>
      </ul>
      <p>Os arquivos são gerados no próprio aparelho e baixados direto.</p>`,
    },
    {
      id: 'usuarios', titulo: 'Usuários e convites', para: ['admin'], html: `
      <p>Em <strong>Perfil → Usuários e convites</strong>.</p>
      <ol class="aj-passos">
        <li>Preencha nome, e-mail e o acesso: <strong>Representante de igreja</strong> (escolha a igreja) ou <strong>Administrador do presbitério</strong>. O presbitério não é escolhido: é sempre o do administrador que está convidando (a tela mostra o nome dele), porque cada administrador só concede acesso dentro da própria jurisdição.</li>
        <li>Toque em <strong>Criar convite</strong> e envie o link por <strong>WhatsApp</strong> ou <strong>Copiar link</strong>.</li>
        <li>A pessoa abre o link, cria a senha (mínimo 8 caracteres), confirma que leu o aviso de privacidade e já entra com o acesso certo. Se já tiver conta com aquele e-mail, usa “Já tenho conta”.</li>
      </ol>
      <ul>
        <li>O convite vale <strong>14 dias</strong>, funciona <strong>uma vez</strong> e só com o <strong>e-mail cadastrado</strong>. Um novo convite para o mesmo e-mail substitui o anterior.</li>
        <li><strong>Convites pendentes:</strong> reenviar o link ou cancelar.</li>
        <li><strong>Usuários com acesso:</strong> papel, igreja e último acesso. <strong>Remover</strong> tira o acesso imediatamente (você não pode remover o seu próprio).</li>
        <li><strong>Outros acessos a este presbitério:</strong> superadministrador, administrador nacional e administrador sinodal do seu sínodo — contas de nível superior que também podem consultar os relatórios das suas igrejas. Aparecem só para consulta (sem “Remover”); quem as gerencia é o superadministrador.</li>
        <li>O administrador de um presbitério <strong>novo</strong> é convidado pelo superadministrador, na tela Estrutura.</li>
      </ul>`,
    },
    {
      id: 'cadastro', titulo: 'Cadastro de igrejas, congregações e transferências', para: ['admin'], html: `
      <p>Em <strong>Igrejas → Cadastro de igrejas</strong> (ou Perfil → Cadastro de igrejas).</p>
      <ul>
        <li><strong>Nova igreja ou congregação:</strong> tipo, código (sigla única, ex.: 4IPC), nome oficial, cidade, UF, data de organização e situação. Ela entra no presbitério a partir do dia do cadastro.</li>
        <li><strong>Congregação de uma igreja:</strong> escolha a igreja-mãe. Ela entra no relatório da igreja-mãe (aba “Congregação”) e não é cobrada separadamente — assim nada é contado duas vezes.</li>
        <li><strong>Congregação presbiterial:</strong> ligada direto ao presbitério; envia relatório próprio e aparece como “Não enviado” até mandar.</li>
        <li><strong>Editar:</strong> nome, cidade, UF, data, tipo e situação. O código não muda, para preservar o histórico. Unidade <strong>inativa</strong> deixa de ser cobrada, mas o histórico permanece.</li>
        <li><strong>Transferir:</strong> passa a igreja para outro presbitério a partir de uma data, com o motivo ou ato que aprovou. Os relatórios já existentes continuam ligados ao presbitério da época; as congregações da igreja vão junto.</li>
        <li><strong>Registro de alterações:</strong> todo cadastro, alteração e transferência fica registrado com data e detalhes (antes → depois).</li>
      </ul>
      <p class="nota">Novos sínodos e presbitérios são cadastrados pelo superadministrador (veja “Estrutura conciliar”).</p>`,
    },
    {
      id: 'registro', titulo: 'Registro de ações e cópia de segurança (backup)', para: ['admin'], html: `
      <h4>Registro de ações (Perfil → Registro de ações)</h4>
      <ul>
        <li>O próprio banco de dados registra automaticamente: <strong>envios</strong> de arquivo, <strong>leituras</strong>, <strong>validações</strong>, <strong>pedidos de correção</strong>, <strong>correções</strong>, <strong>convites</strong>, <strong>acessos</strong> concedidos ou removidos, <strong>cadastro</strong> e <strong>transferências</strong>, <strong>fechamento/reabertura</strong> do exercício e <strong>cópias de segurança</strong>.</li>
        <li>Cada linha mostra data e hora, o que foi feito, sobre o quê e por quem (“sistema” quando feito direto no banco pelo responsável técnico).</li>
        <li>Filtros por tipo, busca por texto e download em Excel. O registro não pode ser editado nem apagado pelo site.</li>
      </ul>
      <h4>Cópia de segurança (Perfil → Cópia de segurança)</h4>
      <ul>
        <li><strong>Dados (JSON):</strong> todas as tabelas do presbitério, todos os anos e todas as versões dos relatórios, correções, histórico, envios, usuários e registro de ações.</li>
        <li><strong>Dados + arquivos originais (ZIP):</strong> o mesmo, mais os PDFs e planilhas enviados.</li>
        <li><strong>Política recomendada:</strong> uma cópia por mês durante o recebimento e sempre depois de fechar o exercício, guardada em dois lugares diferentes com acesso restrito. A cópia contém e-mails de usuários: trate como confidencial (LGPD).</li>
        <li>Cada cópia gerada fica registrada (quando e o que continha). A restauração é feita pelo responsável técnico, reimportando as tabelas no Supabase.</li>
      </ul>`,
    },
    {
      id: 'sinodo', titulo: 'Visão do sínodo e visão nacional', para: ['admin', 'tec'], html: `
      <p>Navegação hierárquica: <strong>Nacional → Sínodo → Presbitério → Igreja</strong>. Na aba <strong>Sínodo</strong>, toque em “Igreja Presbiteriana do Brasil” no topo para abrir a visão nacional. O superadministrador entra direto na visão nacional.</p>
      <ul>
        <li><strong>Visão nacional:</strong> sínodos, presbitérios e igrejas cadastrados na plataforma; rol, comungantes, não comungantes, Escola Dominical, admissões, demissões e receita; cobertura estatística (validados, pendentes, não enviados); distribuição por UF; comparação entre presbitérios.</li>
        <li><strong>Visão do sínodo:</strong> os mesmos indicadores para os presbitérios do sínodo, com a lista de presbitérios e a comparação entre eles.</li>
        <li><strong>Resumo executivo</strong> em texto, com botão para copiar.</li>
        <li><strong>Mapa por UF:</strong> mapa do Brasil (contornos oficiais do IBGE), com cada estado colorido do claro ao escuro conforme o indicador escolhido: rol de membros, igrejas cadastradas ou % de relatórios validados. Estados em bege não têm dados. A escala começa em zero, para não exagerar diferenças pequenas. Os estados pequenos (como DF, ES, RJ, SE, AL, PE, PB e RN) têm o rótulo do lado de fora, ligado por uma linha. Toque em um estado para ver os números. Abaixo do mapa fica a lista dos estados com dados, do maior para o menor valor.</li>
        <li><strong>Evolução histórica:</strong> as duas telas mostram a evolução por exercício do rol de membros, comungantes, alunos da Escola Dominical e receita (somente relatórios validados). O primeiro ponto vazado é o “ano anterior” informado nos relatórios; um aviso aparece quando o conjunto de igrejas muda entre os anos.</li>
        <li><strong>Exportar:</strong> as duas telas geram planilha Excel e resumo em PDF dos totais (por presbitério e por UF).</li>
        <li>Somente relatórios <strong>validados</strong> entram nos totais, e cada número mostra quantas igrejas contribuíram. Cada exercício é somado ao sínodo a que o presbitério pertencia naquele ano.</li>
        <li>Enquanto nem todas as unidades estiverem na plataforma, os totais aparecem como <strong>parciais</strong> e não são apresentados como o total da IPB. O total oficial da denominação só será exibido quando houver fonte institucional.</li>
        <li>Estas telas mostram apenas <strong>totais agregados</strong>; elas não abrem os dados de uma igreja de outro presbitério.</li>
      </ul>`,
    },
    {
      id: 'estrutura', titulo: 'Estrutura conciliar: sínodos e presbitérios', para: ['tec'], html: `
      <p>Exclusivo do <strong>superadministrador</strong>, no menu <strong>Estrutura</strong>. O superadministrador vê a visão nacional e a estrutura, mas não as telas internas de um presbitério.</p>
      <ul>
        <li><strong>Novo sínodo / novo presbitério:</strong> sigla única, nome oficial e situação. Todo presbitério pertence a um sínodo.</li>
        <li><strong>Editar:</strong> nome e situação (ativo/inativo). As siglas não mudam, para preservar o histórico. Nada é apagado.</li>
        <li><strong>Mudar de sínodo:</strong> registra a data e o motivo. Os exercícios anteriores continuam somados ao sínodo da época na visão nacional.</li>
        <li><strong>Convidar administrador:</strong> gera o link de convite do administrador do presbitério, que depois cadastra as igrejas e convida os representantes.</li>
        <li>Todas as alterações ficam no registro da estrutura.</li>
      </ul>
      <p class="nota">O primeiro superadministrador é definido pelo responsável técnico no banco de dados (veja “Todas as configurações”). Use uma conta própria: cada conta tem um único papel.</p>`,
    },
    {
      id: 'seguranca', titulo: 'Privacidade e segurança dos dados', para: ['todos'], html: `
      <ul>
        <li><strong>Regras de acesso no banco de dados:</strong> cada consulta é filtrada pelo próprio banco conforme o papel e a jurisdição do usuário — não é possível ver dados de outra igreja ou presbitério “por fora” do site.</li>
        <li><strong>Sem convite, nada:</strong> uma conta criada sem convite (sem perfil de acesso) não vê nenhum dado — nem relatórios nem a lista de igrejas, presbitérios e sínodos. Sem login, também nada é visível.</li>
        <li><strong>Arquivos originais</strong> em pasta privada, abertos só por link temporário (10 minutos).</li>
        <li><strong>Visões do sínodo e nacional</strong> mostram apenas totais agregados. Contas de nível superior (superadministrador, administrador nacional e sinodal) podem consultar relatórios das igrejas sob sua abrangência e aparecem para o administrador do presbitério em <em>Outros acessos a este presbitério</em>.</li>
        <li><strong>Dados pessoais</strong> do secretário que constam no formulário não são extraídos nem exibidos; ficam só no arquivo original.</li>
        <li><strong>Comunicação criptografada</strong> (HTTPS); senhas guardadas de forma cifrada; a chave secreta do banco não fica no site.</li>
        <li><strong>Nada é apagado</strong> por atualização ou substituição de relatório: versões antigas, correções e histórico ficam guardados.</li>
        <li><strong>Registro de ações</strong> e <strong>cópias de segurança</strong> sob responsabilidade do administrador do presbitério.</li>
        <li>Detalhes no <a href="#/privacidade">Aviso de privacidade</a>.</li>
      </ul>`,
    },
    {
      id: 'instalar', titulo: 'Instalar no celular e atualizar', para: ['todos'], html: `
      <ul>
        <li><strong>Endereço:</strong> ipbbrasil.github.io/igreja-presbiteriana</li>
        <li><strong>Android (Chrome):</strong> menu ⋮ → <em>Instalar app</em> ou <em>Adicionar à tela inicial</em>.</li>
        <li><strong>iPhone (Safari):</strong> botão Compartilhar → <em>Adicionar à Tela de Início</em>.</li>
        <li>O aplicativo instalado abre em tela cheia, com o ícone da IPB.</li>
        <li><strong>Atualizar:</strong> o aplicativo abre direto da cópia guardada no aparelho (mais rápido) e baixa as novidades em segundo plano; elas aparecem na abertura seguinte. Se algo parecer antigo, feche o aplicativo e abra de novo (às vezes, duas vezes).</li>
        <li>É preciso internet para entrar, enviar e ver os dados (os dados nunca ficam guardados no aparelho).</li>
      </ul>`,
    },
    {
      id: 'config', titulo: 'Todas as configurações', para: ['todos', 'tec'], html: `
      <h4>No aplicativo (qualquer usuário)</h4>
      <div class="tbl-wrap"><table class="tbl aj-tbl"><thead><tr><th>Configuração</th><th>Onde</th><th>Efeito</th></tr></thead><tbody>
        <tr><td>Exercício (ano)</td><td>Seletor no topo do painel, das igrejas, da conferência, da página da igreja, do sínodo e da visão nacional</td><td>Qual ano é mostrado em todo o aplicativo (fica salvo neste aparelho)</td></tr>
        <tr><td>Somente validados / Todos recebidos</td><td>Painel do presbitério</td><td>Quais relatórios entram nos totais, gráficos e exportações</td></tr>
        <tr><td>Limite de variação relevante (10% a 30%)</td><td>Painel → Variações relevantes no ano</td><td>A partir de quanto uma mudança é alertada (fica salvo neste aparelho)</td></tr>
        <tr><td>Exercício do envio</td><td>Enviar → 1. Relatório</td><td>Ano do relatório enviado (deve bater com o documento)</td></tr>
        <tr><td>Mostrar senha</td><td>Login e convite</td><td>Exibe a senha digitada</td></tr>
        <tr><td>Sair</td><td>Perfil</td><td>Encerra a sessão neste aparelho</td></tr>
      </tbody></table></div>
      <h4>Administrador do presbitério</h4>
      <div class="tbl-wrap"><table class="tbl aj-tbl"><thead><tr><th>Configuração</th><th>Onde</th><th>Efeito</th></tr></thead><tbody>
        <tr><td>Convidar usuário (papel e igreja)</td><td>Perfil → Usuários e convites</td><td>Define quem acessa e o que vê</td></tr>
        <tr><td>Remover acesso / cancelar convite</td><td>Perfil → Usuários e convites</td><td>Retira o acesso imediatamente</td></tr>
        <tr><td>Situação do relatório</td><td>Igreja → Conferência</td><td>Validar, pedir correção, voltar para conferência</td></tr>
        <tr><td>Fechar / reabrir o exercício</td><td>Conferência → quadro Exercício</td><td>Torna o resultado oficial e trava alterações daquele ano</td></tr>
        <tr><td>Igrejas, congregações e transferências</td><td>Igrejas → Cadastro de igrejas</td><td>Quem pertence ao presbitério e é cobrado no envio</td></tr>
        <tr><td>Cópia de segurança</td><td>Perfil → Cópia de segurança</td><td>Baixa todos os dados (e arquivos) do presbitério</td></tr>
      </tbody></table></div>
      <h4>Superadministrador</h4>
      <div class="tbl-wrap"><table class="tbl aj-tbl"><thead><tr><th>Configuração</th><th>Onde</th><th>Efeito</th></tr></thead><tbody>
        <tr><td>Sínodos e presbitérios</td><td>Menu Estrutura</td><td>Cadastrar, editar, inativar e mudar presbitério de sínodo</td></tr>
        <tr><td>Primeiro administrador de um presbitério</td><td>Estrutura → Convidar administrador</td><td>Gera o convite do administrador</td></tr>
      </tbody></table></div>
      <h4>Responsável técnico (Supabase e código)</h4>
      <div class="tbl-wrap"><table class="tbl aj-tbl"><thead><tr><th>Configuração</th><th>Onde</th><th>Efeito</th></tr></thead><tbody>
        <tr><td>Endereço e chave pública do Supabase</td><td><code>js/config.js</code> (SUPABASE_URL, SUPABASE_ANON_KEY)</td><td>Banco que o site usa. Use só a chave <em>publishable</em>, nunca a secreta</td></tr>
        <tr><td>Exercício padrão</td><td><code>js/config.js</code> (ANO_PADRAO)</td><td>Só é usado quando ainda não há relatório nenhum; os anos com relatório aparecem sozinhos no seletor de exercício</td></tr>
        <tr><td>Dicionário de dados (células do modelo)</td><td><code>js/dicionario.js</code> · página Perfil → Dicionário de dados</td><td>Define de onde cada campo é lido no Excel; ajustar aqui se a IPB publicar nova versão do modelo</td></tr>
        <tr><td>Estrutura do banco</td><td>SQL Editor, nesta ordem: <code>schema.sql</code>, <code>002_envios</code>, <code>003_leitura</code>, <code>004_correcoes</code>, <code>005_usuarios</code>, <code>006_exercicio</code>, <code>007_cadastro</code>, <code>008_auditoria</code>, <code>009_nacional</code>, <code>010_estrutura</code>, <code>011_restricao</code>, <code>012_acessos_superiores</code>, <code>013_evolucao_nacional</code></td><td>Tabelas, regras de acesso, pasta privada, funções e gatilhos (o 011 impede que contas sem perfil vejam qualquer dado; o 012 lista os acessos de nível superior)</td></tr>
        <tr><td>Confirmação de e-mail</td><td>Authentication → Sign In / Providers → Email → <em>Confirm email</em></td><td>Deve ficar <strong>desligada</strong> para o convite criar a conta na hora</td></tr>
        <tr><td>Criar o superadministrador</td><td>Authentication → Users → Add user (Auto Confirm) e depois SQL na tabela <code>perfis</code> com papel <code>superadmin</code></td><td>Conta que cadastra sínodos e presbitérios</td></tr>
        <tr><td>Perfis manuais</td><td>SQL Editor, tabela <code>perfis</code></td><td>Papel (superadmin, admin_nacional, admin_sinodal, admin_presbiterial, representante) e vínculo</td></tr>
        <tr><td>Redefinir senha de um usuário</td><td>SQL Editor (<code>auth.users</code>)</td><td>Quando a pessoa não consegue entrar</td></tr>
        <tr><td>Senha do banco</td><td>Project Settings → Database</td><td>Não é usada pelo site; troque se tiver sido exposta</td></tr>
        <tr><td>Pasta dos arquivos</td><td>Storage → bucket <code>relatorios</code> (privado, 10 MB, PDF/XLSX)</td><td>Onde ficam os originais enviados</td></tr>
        <tr><td>Publicação do site</td><td>GitHub → repositório <code>igreja-presbiteriana</code> (GitHub Pages)</td><td>Cada alteração enviada ao repositório atualiza o site</td></tr>
        <tr><td>Modo local (teste)</td><td><code>?local=1</code> em localhost</td><td>Usa um arquivo no computador, sem Supabase, e permite simular perfis</td></tr>
      </tbody></table></div>`,
    },
    {
      id: 'problemas', titulo: 'Problemas comuns', para: ['todos'], html: `
      <dl class="aj-faq">
        <dt>“E-mail ou senha incorretos”, mas está certo</dt><dd>O celular pode estar preenchendo uma senha salva de outro usuário. Apague o campo, digite à mão e use <em>Mostrar senha</em>. Depois de entrar, aceite atualizar a senha salva no cofre do celular.</dd>
        <dt>“Seu usuário ainda não tem um perfil de acesso”</dt><dd>A conta existe, mas não está ligada a uma igreja ou presbitério — por segurança, ela não vê nenhum dado. Peça um convite ao administrador e use “Já tenho conta”.</dd>
        <dt>Convite expirado ou já usado</dt><dd>Peça ao administrador para criar outro convite para o seu e-mail.</dd>
        <dt>“Exercício não confere” no envio</dt><dd>O ano escrito no documento é diferente do exercício escolhido. Troque o exercício ou envie o relatório correto.</dd>
        <dt>“Não há relatório deste exercício para esta igreja”</dt><dd>O ano escolhido no seletor de exercício ainda não tem relatório dessa igreja. Escolha outro ano no topo da tela ou envie o relatório.</dd>
        <dt>“O exercício está fechado”</dt><dd>O administrador encerrou o ano. Para enviar ou corrigir algo, ele precisa reabrir o exercício (com motivo) na tela Conferência.</dd>
        <dt>“Arquivo já enviado”</dt><dd>Esse mesmo arquivo já está no sistema para essa igreja e ano. Se houve correção, envie o arquivo corrigido.</dd>
        <dt>PDF digitalizado (imagem)</dt><dd>Pode ser enviado, mas os números serão digitados pelo administrador. Sempre que possível, envie o Excel ou o PDF gerado direto do Excel do modelo.</dd>
        <dt>Somas com divergência ou “verificar dado”</dt><dd>Algum total do relatório não bate com a soma das linhas, ou a mudança no ano não é explicada pelas admissões e demissões. Confira o relatório; o administrador pode pedir correção ou corrigir os dados.</dd>
        <dt>A planilha “não está na posição do modelo”</dt><dd>Foram inseridas ou apagadas linhas no Excel. Use o modelo oficial CSM-IPB sem alterar a estrutura.</dd>
        <dt>Transferência diz que não há outro presbitério</dt><dd>Só existe um presbitério cadastrado. O superadministrador precisa cadastrar o presbitério de destino.</dd>
        <dt>Visão nacional ou Estrutura mostram erro</dt><dd>Os scripts mais recentes do banco ainda não foram aplicados (009 e 010). Avise o responsável técnico.</dd>
        <dt>O aplicativo mostra algo antigo</dt><dd>Feche o aplicativo e abra de novo (ou recarregue a página).</dd>
      </dl>`,
    },
    {
      id: 'glossario', titulo: 'Glossário', para: ['todos'], html: `
      <dl class="aj-faq">
        <dt>Comungantes</dt><dd>Membros que fizeram profissão de fé.</dd>
        <dt>Não comungantes</dt><dd>Membros batizados na infância que ainda não fizeram profissão de fé.</dd>
        <dt>Rol atual</dt><dd>Comungantes + não comungantes no fim do ano.</dd>
        <dt>Rol separado</dt><dd>Membros afastados temporariamente do rol, conforme a disciplina.</dd>
        <dt>Jurisdição / ex-officio</dt><dd>Recebimento de membros por decisão do Conselho, sem carta de transferência.</dd>
        <dt>Grande total</dt><dd>Saldo do ano anterior + receita do ano.</dd>
        <dt>Congregação presbiterial</dt><dd>Congregação ligada diretamente ao presbitério, que envia relatório próprio.</dd>
        <dt>Cobertura (“n de m igrejas”)</dt><dd>Quantas igrejas informaram aquele dado; o total soma só essas.</dd>
        <dt>Não enviado</dt><dd>Igreja cadastrada que ainda não mandou o relatório do exercício.</dd>
        <dt>Versão do relatório</dt><dd>Cada novo envio lido gera uma versão; as antigas ficam como “Substituída”.</dd>
        <dt>Variação relevante</dt><dd>Mudança do ano anterior para o atual acima do limite (padrão 15% e 5 pessoas), classificada como real, informada ou a verificar.</dd>
        <dt>Exercício</dt><dd>Ano a que o relatório se refere (ex.: o relatório entregue em 2026 é do exercício 2025).</dd>
        <dt>Exercício fechado / resultado oficial</dt><dd>Ano encerrado pelo administrador: os relatórios validados formam o resultado oficial e nada mais pode ser alterado sem reabertura.</dd>
        <dt>Resumo executivo</dt><dd>Texto gerado automaticamente por regras fixas que resume os números do painel; não substitui a análise dos concílios.</dd>
        <dt>Rastreabilidade</dt><dd>Possibilidade de ver, para cada número, o documento, a página ou célula, a extração, a validação e as correções.</dd>
        <dt>Superadministrador</dt><dd>Conta que cuida da estrutura conciliar (sínodos e presbitérios) da plataforma.</dd>
      </dl>`,
    },
  ];

  // Tópicos mais relevantes para cada papel aparecem primeiro
  const MEU = { representante: ['rep'], admin_presbiterial: ['admin'], admin_sinodal: ['admin'], admin_nacional: ['admin', 'tec'], superadmin: ['tec', 'admin'] };

  // papel: papel do usuário logado (ou null na tela de login)
  function html(papel) {
    const meu = MEU[papel] || null;
    const relevante = (t) => !meu || t.para.includes('todos') || t.para.some((p) => meu.includes(p));
    const ordem = [...TOPICOS.filter(relevante), ...TOPICOS.filter((t) => !relevante(t))];
    return `
      <div class="busca aj-busca"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>
        <input type="search" id="aj-q" placeholder="Buscar na ajuda (ex.: convite, PDF, senha)" aria-label="Buscar na ajuda"></div>
      <div class="aj-lista">${ordem.map((t, i) => `<details class="card aj" id="aj-${t.id}"${i === 0 ? ' open' : ''}>
          <summary><span>${t.titulo}</span><small>${t.para.map((p) => PARA[p]).join(' · ')}</small></summary>
          <div class="aj-c">${t.html}</div></details>`).join('')}</div>
      <p class="vazio" id="aj-nada" hidden>Nada encontrado. Tente outra palavra.</p>`;
  }

  // Busca: mostra só os tópicos que contêm o texto e já os abre
  function ligar(raiz) {
    const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const $q = raiz.querySelector('#aj-q');
    $q.addEventListener('input', () => {
      const q = norm($q.value.trim());
      let n = 0;
      raiz.querySelectorAll('details.aj').forEach((d) => {
        const ok = !q || norm(d.textContent).includes(q);
        d.hidden = !ok; if (ok) n++;
        if (q) d.open = ok;
      });
      raiz.querySelector('#aj-nada').hidden = n > 0;
    });
  }

  return { html, ligar };
})();
