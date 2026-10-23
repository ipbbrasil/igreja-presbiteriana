// Central de ajuda: o que o aplicativo faz, passo a passo de cada função e todas as configurações.
// Cada tópico indica para quem vale; a busca filtra pelo texto.
window.Ajuda = (() => {
  const chip = (s) => { const x = Regras.STATUS[s]; return `<span class="chip ${x.cls}"><b aria-hidden="true">${x.icon}</b>${x.label}</span>`; };
  const PARA = { todos: 'Todos', admin: 'Administrador', rep: 'Representante', tec: 'Responsável técnico' };

  const TOPICOS = [
    {
      id: 'visao', titulo: 'O que é o sistema', para: ['todos'], html: `
      <p>Plataforma para <strong>receber, conferir e consolidar</strong> os relatórios estatísticos anuais das igrejas (modelo oficial CSM-IPB “Informações Cadastrais e Estatísticas de Comunidade Presbiteriana”).</p>
      <p>A organização segue a estrutura da IPB: <strong>Igrejas → Presbitério → Sínodo → Nacional</strong>. Cada pessoa só vê o que corresponde ao seu acesso.</p>
      <h4>O ciclo de um relatório</h4>
      <ol class="aj-passos">
        <li><strong>Convite:</strong> o administrador do presbitério convida o representante da igreja.</li>
        <li><strong>Envio:</strong> o representante envia o relatório (PDF ou Excel) pelo site; o arquivo é conferido antes de sair do aparelho.</li>
        <li><strong>Leitura:</strong> os números do PDF digital são lidos automaticamente; PDF escaneado ou Excel são digitados pelo administrador.</li>
        <li><strong>Conferência:</strong> o sistema refaz 14 somas e aponta divergências e problemas do documento.</li>
        <li><strong>Decisão:</strong> o administrador valida ou pede correção. Tudo fica no histórico.</li>
        <li><strong>Consolidação:</strong> os relatórios validados formam os totais do presbitério e do sínodo, que podem ser exportados.</li>
      </ol>
      <div class="banner info"><b>i</b><div><strong>Regra de ouro:</strong> campo vazio no relatório é <em>não informado</em> — nunca é tratado como zero. Por isso cada total mostra quantas igrejas contribuíram (ex.: “10 de 11 igrejas”).</div></div>`,
    },
    {
      id: 'perfis', titulo: 'Perfis de acesso: quem pode o quê', para: ['todos'], html: `
      <div class="tbl-wrap"><table class="tbl aj-tbl"><thead><tr><th>Função</th><th>Representante</th><th>Adm. presbitério</th><th>Adm. sínodo</th></tr></thead><tbody>
        <tr><td>Ver dados da própria igreja</td><td>✓</td><td>✓</td><td>✓</td></tr>
        <tr><td>Ver todas as igrejas do presbitério</td><td>—</td><td>✓</td><td>✓</td></tr>
        <tr><td>Enviar relatório</td><td>só da própria igreja</td><td>de qualquer igreja do presbitério</td><td>—</td></tr>
        <tr><td>Ler agora (leitura automática)</td><td>✓ (próprios envios)</td><td>✓</td><td>—</td></tr>
        <tr><td>Digitar / corrigir dados</td><td>—</td><td>✓</td><td>—</td></tr>
        <tr><td>Validar ou pedir correção</td><td>—</td><td>✓</td><td>—</td></tr>
        <tr><td>Exportar Excel / PDF</td><td>—</td><td>✓</td><td>✓</td></tr>
        <tr><td>Convidar e remover usuários</td><td>—</td><td>✓</td><td>—</td></tr>
        <tr><td>Visão do sínodo</td><td>—</td><td>✓</td><td>✓</td></tr>
      </tbody></table></div>
      <p class="nota">O menu se adapta ao perfil: o representante vê <em>Minha igreja, Enviar, Perfil</em>; o administrador vê <em>Presbitério, Igrejas, Conferência, Sínodo, Perfil</em>.</p>`,
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
        <li><strong>Somente validados / Todos recebidos:</strong> escolhe quais relatórios entram nos totais. O padrão é <em>somente validados</em>; “todos” mostra um aviso de que inclui dados não conferidos. Essa escolha vale também para a exportação.</li>
        <li><strong>Membros, comungantes e não comungantes:</strong> com a variação do ano (calculada só com igrejas que informaram os dois anos).</li>
        <li><strong>Recebimento dos relatórios:</strong> barra com a situação de cada relatório; toque para ir à Conferência.</li>
        <li><strong>Indicadores:</strong> Escola Dominical (alunos e professores), receita e despesa realizadas. Abaixo de cada um: “n de m igrejas” que informaram.</li>
        <li><strong>Gráficos por igreja:</strong> comungantes e receita. Toque em uma igreja para abrir a página dela.</li>
        <li><strong>Variações relevantes no ano:</strong> compara o ano anterior com o atual (comungantes, não comungantes, rol e alunos da Escola Dominical) e lista as mudanças acima do limite escolhido (padrão 15% e pelo menos 5 pessoas; ajustável de 10% a 30%). Cada uma vem classificada: <em>alta/queda real</em> (a movimentação de admissões e demissões explica), <em>informada</em> (não há movimentação para conferir) ou <em>verificar dado</em> (a mudança não bate com o que foi registrado — provável erro). A mesma análise aparece na página de cada igreja e no PDF da igreja.</li>
        <li><strong>Movimentação de comungantes:</strong> admissões e demissões por tipo e o saldo do período.</li>
        <li><strong>Composição das despesas</strong> e <strong>Liderança formal</strong> (pastores, presbíteros, diáconos…).</li>
        <li><strong>Exportar:</strong> planilha Excel e resumo em PDF (veja “Exportação”).</li>
      </ul>`,
    },
    {
      id: 'igreja', titulo: 'Igrejas e a página de cada igreja', para: ['todos'], html: `
      <p><strong>Igrejas</strong> (administrador): lista com busca por nome, situação de cada relatório e botão <em>Enviar relatório</em>. O representante vai direto para <strong>Minha igreja</strong>.</p>
      <h4>Abas da página da igreja</h4>
      <ul>
        <li><strong>Visão geral:</strong> rol de membros, comungantes, Escola Dominical, finanças e liderança.</li>
        <li><strong>Membresia:</strong> admissões e demissões por tipo e sexo, evolução do ano anterior para o atual.</li>
        <li><strong>Educação:</strong> Escola Dominical e departamentos internos (UCP, UPA, UMP, SAF, UPH).</li>
        <li><strong>Finanças:</strong> receitas e despesas — realizado no ano e previsão para o próximo.</li>
        <li><strong>Ministério:</strong> vida ministerial e administração (Santa Ceia, evangelização, textos distribuídos, discipulados, ação social, visitas, reuniões, mandatos, reformas e planejamento). Só aparece quando o relatório foi enviado em Excel com a aba “Conselho ou Mesa” preenchida.</li>
        <li><strong>Conferência:</strong> verificações de soma, alertas da leitura, origem dos dados, arquivos enviados e histórico. O número na aba indica pendências.</li>
      </ul>
      <p><strong>Relatório em PDF:</strong> o botão no topo da página da igreja gera um PDF com identificação, membresia e movimentação, liderança, Escola Dominical, departamentos, finanças (realizado × previsto), vida ministerial (quando houver), as 14 verificações e os alertas da leitura. Indica se o relatório está validado. Disponível para o administrador e para o representante da igreja.</p>
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
        <li><strong>Arquivo:</strong> toque para escolher o relatório preenchido no modelo oficial — <strong>PDF ou Excel (.xlsx), até 10 MB</strong>.</li>
        <li><strong>Verificação:</strong> o arquivo é analisado no próprio aparelho, antes do envio.</li>
        <li>Marque <em>“Confirmo que este é o relatório oficial aprovado pelo Conselho”</em> e toque em <strong>Enviar relatório</strong>.</li>
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
      <p>O arquivo original fica guardado em uma pasta <strong>privada</strong>; só quem tem acesso à igreja consegue baixá-lo (link temporário de 10 minutos).</p>`,
    },
    {
      id: 'leitura', titulo: 'Leitura automática e versões', para: ['todos'], html: `
      <p>Em <strong>PDF digital</strong> e em <strong>Excel (.xlsx)</strong> do modelo oficial, o sistema lê sozinho todos os campos: liderança, estrutura, departamentos, admissões e demissões (por sexo), rol e finanças (realizado e previsto). PDF e Excel geram exatamente os mesmos campos.</p>
      <ul>
        <li><strong>Excel:</strong> lido célula a célula conforme o <a href="#/dicionario">Dicionário de dados</a>. Também lê a aba <em>Conselho ou Mesa</em> (Santa Ceia, evangelização, visitas, reuniões, planejamento) e a aba <em>Congregação</em>, mostradas na aba <strong>Ministério</strong> da igreja. Use o modelo oficial sem inserir ou apagar linhas.</li>
        <li>No Excel, se a igreja digitar um número por cima de uma fórmula do modelo (ex.: comungantes do ano atual), o sistema avisa — é a causa mais comum de somas que não fecham.</li>
        <li>A leitura acontece no envio. Se não acontecer, o administrador (ou quem enviou) usa <strong>Ler agora</strong> na lista de envios.</li>
        <li>Cada leitura cria uma <strong>nova versão</strong> do relatório em <em>Aguardando conferência</em>; a versão anterior vira <em>Substituída</em> e nada é apagado.</li>
        <li><strong>Alertas da leitura</strong> apontam problemas do documento: erro de planilha (#REF!), sigla de sínodo/presbitério diferente, nome em branco, linhas fora do modelo, versão não identificada.</li>
        <li><strong>PDF escaneado</strong> não é lido automaticamente: o administrador usa <strong>Digitar dados</strong>.</li>
        <li>As perguntas <strong>Sim/Não</strong> do Excel (documentação, previdência, seguro…) são caixas de seleção e ainda não são lidas.</li>
      </ul>`,
    },
    {
      id: 'conferencia', titulo: 'Conferência e validação', para: ['admin'], html: `
      <h4>Situações de um relatório</h4>
      <ul class="aj-status">
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
        <li>A aba <strong>Conferência</strong> do menu agrupa todos os relatórios por situação e mostra os arquivos recém-recebidos.</li>
      </ul>`,
    },
    {
      id: 'exercicio', titulo: 'Fechamento do exercício e igrejas que não enviaram', para: ['admin'], html: `
      <p>Na tela <strong>Conferência</strong>, o quadro <strong>Exercício</strong> mostra igrejas cadastradas, relatórios recebidos, validados, pendentes e <strong>não enviados</strong>.</p>
      <ul>
        <li><strong>Não enviado:</strong> igreja vinculada ao presbitério que ainda não mandou relatório. Aparece no painel, na lista de igrejas e na Conferência; tocar nela abre o envio em nome da igreja.</li>
        <li><strong>Fechar exercício:</strong> ao fim do recebimento, o administrador fecha o ano. Os relatórios <strong>validados</strong> passam a ser o <strong>resultado oficial</strong>; o sistema lista antes quem ficará de fora. Comentário opcional (ex.: data da reunião que aprovou).</li>
        <li><strong>Com o exercício fechado</strong>, o banco de dados recusa novos envios, leituras, correções e mudanças de situação daquele ano. O painel e as exportações passam a dizer “resultado oficial”.</li>
        <li><strong>Reabrir:</strong> exige motivo. Fechamentos e reaberturas ficam no <strong>Histórico do exercício</strong>.</li>
      </ul>`,
    },
    {
      id: 'digitar', titulo: 'Digitação e correção manual', para: ['admin'], html: `
      <ul>
        <li><strong>Corrigir dados:</strong> na Conferência de uma igreja. Abre o formulário já preenchido.</li>
        <li><strong>Digitar dados:</strong> na lista de envios, para PDF escaneado ou Excel. Abre o formulário em branco, com botão para abrir o arquivo original.</li>
        <li>O formulário segue o modelo oficial: liderança, estrutura, departamentos, comungantes, não comungantes, rol atual e finanças.</li>
        <li><strong>Campo vazio = não informado.</strong> Valores em reais no formato 1.234,56.</li>
        <li>Cores: <span class="aj-cor mud">amarelo</span> alterado · <span class="aj-cor inc">sublinhado</span> masc. + fem. ≠ total · <span class="aj-cor inv">vermelho</span> valor inválido (impede salvar).</li>
        <li>A barra do topo mostra quantas alterações e se as somas conferem, atualizando a cada número.</li>
        <li>Ao salvar, o relatório volta para <em>Aguardando conferência</em>; o histórico registra quem alterou, quando e cada valor (antes → depois). Uma cópia completa dos dados anteriores fica guardada.</li>
      </ul>`,
    },
    {
      id: 'exportar', titulo: 'Exportação (Excel e PDF)', para: ['admin'], html: `
      <p>No fim do painel do presbitério, quadro <strong>Exportar</strong>. Usa os mesmos relatórios do painel (somente validados ou todos).</p>
      <ul>
        <li><strong>Planilha Excel</strong> com 7 abas: Resumo, Membresia, Estrutura, Finanças realizado, Finanças previsto e Situação (todas as igrejas). Cada aba de dados termina com <em>Total</em> e <em>Igrejas que informaram</em> (fórmulas). Não informado = célula vazia.</li>
        <li><strong>Resumo em PDF</strong> (A4, uma página): indicadores consolidados, tabela por igreja com total e relatórios pendentes. Ideal para imprimir ou enviar por WhatsApp.</li>
      </ul>
      <p>Os arquivos são gerados no próprio aparelho e baixados direto.</p>`,
    },
    {
      id: 'usuarios', titulo: 'Usuários e convites', para: ['admin'], html: `
      <p>Em <strong>Perfil → Usuários e convites</strong>.</p>
      <ol class="aj-passos">
        <li>Preencha nome, e-mail e o acesso: <strong>Representante de igreja</strong> (escolha a igreja) ou <strong>Administrador do presbitério</strong>.</li>
        <li>Toque em <strong>Criar convite</strong> e envie o link por <strong>WhatsApp</strong> ou <strong>Copiar link</strong>.</li>
        <li>A pessoa abre o link, cria a senha (mínimo 8 caracteres) e já entra com o acesso certo. Se já tiver conta com aquele e-mail, usa “Já tenho conta”.</li>
      </ol>
      <ul>
        <li>O convite vale <strong>14 dias</strong>, funciona <strong>uma vez</strong> e só com o <strong>e-mail cadastrado</strong>. Um novo convite para o mesmo e-mail substitui o anterior.</li>
        <li><strong>Convites pendentes:</strong> reenviar o link ou cancelar.</li>
        <li><strong>Usuários com acesso:</strong> papel, igreja e último acesso. <strong>Remover</strong> tira o acesso imediatamente (você não pode remover o seu próprio).</li>
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
      id: 'estrutura', titulo: 'Estrutura conciliar: sínodos e presbitérios', para: ['tec'], html: `
      <p>Exclusivo do <strong>superadministrador</strong>, no menu <strong>Estrutura</strong>. O superadministrador vê a visão nacional e a estrutura, mas não as telas internas de um presbitério.</p>
      <ul>
        <li><strong>Novo sínodo / novo presbitério:</strong> sigla única, nome oficial e situação. Todo presbitério pertence a um sínodo.</li>
        <li><strong>Editar:</strong> nome e situação (ativo/inativo). As siglas não mudam, para preservar o histórico. Nada é apagado.</li>
        <li><strong>Mudar de sínodo:</strong> registra a data e o motivo. Os exercícios anteriores continuam somados ao sínodo da época na visão nacional.</li>
        <li><strong>Convidar administrador:</strong> gera o link de convite do administrador do presbitério, que depois cadastra as igrejas e convida os representantes.</li>
        <li>Todas as alterações ficam no registro da estrutura.</li>
      </ul>
      <p class="nota">O primeiro superadministrador é definido pelo responsável técnico no banco de dados.</p>`,
    },
    {
      id: 'registro', titulo: 'Registro de ações e cópia de segurança', para: ['admin'], html: `
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
        <li>Cada cópia gerada fica registrada (quando e o que continha).</li>
      </ul>`,
    },
    {
      id: 'sinodo', titulo: 'Visão do sínodo e visão nacional', para: ['admin'], html: `
      <p>Navegação hierárquica: <strong>Nacional → Sínodo → Presbitério → Igreja</strong>. Na aba <strong>Sínodo</strong>, toque em “Igreja Presbiteriana do Brasil” no topo para abrir a visão nacional.</p>
      <ul>
        <li><strong>Visão nacional:</strong> sínodos, presbitérios e igrejas cadastrados na plataforma; rol, comungantes, não comungantes, Escola Dominical, admissões, demissões e receita; cobertura estatística (validados, pendentes, não enviados); distribuição por UF; comparação entre presbitérios.</li>
        <li><strong>Visão do sínodo:</strong> os mesmos indicadores para os presbitérios do sínodo, com a lista de presbitérios e a comparação entre eles.</li>
        <li>Somente relatórios <strong>validados</strong> entram nos totais, e cada número mostra quantas igrejas contribuíram.</li>
        <li>Enquanto nem todas as unidades estiverem na plataforma, os totais aparecem como <strong>parciais</strong> e não são apresentados como o total da IPB. O total oficial da denominação só será exibido quando houver fonte institucional.</li>
        <li>Estas telas mostram apenas <strong>totais agregados</strong>. O detalhe de cada igreja continua restrito a quem tem jurisdição sobre ela.</li>
      </ul>`,
    },
    {
      id: 'instalar', titulo: 'Instalar no celular e atualizar', para: ['todos'], html: `
      <ul>
        <li><strong>Android (Chrome):</strong> menu ⋮ → <em>Instalar app</em> ou <em>Adicionar à tela inicial</em>.</li>
        <li><strong>iPhone (Safari):</strong> botão Compartilhar → <em>Adicionar à Tela de Início</em>.</li>
        <li>O aplicativo instalado abre em tela cheia, com o ícone da IPB.</li>
        <li><strong>Atualizar:</strong> as novidades chegam sozinhas; se algo parecer antigo, feche o aplicativo e abra de novo.</li>
        <li>É preciso internet para entrar, enviar e ver os dados (os dados nunca ficam guardados no aparelho).</li>
      </ul>`,
    },
    {
      id: 'config', titulo: 'Todas as configurações', para: ['todos', 'tec'], html: `
      <h4>No aplicativo (qualquer usuário)</h4>
      <div class="tbl-wrap"><table class="tbl aj-tbl"><thead><tr><th>Configuração</th><th>Onde</th><th>Efeito</th></tr></thead><tbody>
        <tr><td>Somente validados / Todos recebidos</td><td>Painel do presbitério</td><td>Quais relatórios entram nos totais, gráficos e exportações</td></tr>
        <tr><td>Exercício do envio</td><td>Enviar → 1. Relatório</td><td>Ano do relatório enviado (deve bater com o documento)</td></tr>
        <tr><td>Mostrar senha</td><td>Login e convite</td><td>Exibe a senha digitada</td></tr>
        <tr><td>Sair</td><td>Perfil</td><td>Encerra a sessão neste aparelho</td></tr>
      </tbody></table></div>
      <h4>Administrador do presbitério</h4>
      <div class="tbl-wrap"><table class="tbl aj-tbl"><thead><tr><th>Configuração</th><th>Onde</th><th>Efeito</th></tr></thead><tbody>
        <tr><td>Convidar usuário (papel e igreja)</td><td>Perfil → Usuários e convites</td><td>Define quem acessa e o que vê</td></tr>
        <tr><td>Remover acesso / cancelar convite</td><td>Perfil → Usuários e convites</td><td>Retira o acesso imediatamente</td></tr>
        <tr><td>Situação do relatório</td><td>Igreja → Conferência</td><td>Validar, pedir correção, voltar para conferência</td></tr>
      </tbody></table></div>
      <h4>Responsável técnico (Supabase e código)</h4>
      <div class="tbl-wrap"><table class="tbl aj-tbl"><thead><tr><th>Configuração</th><th>Onde</th><th>Efeito</th></tr></thead><tbody>
        <tr><td>Endereço e chave pública do Supabase</td><td><code>js/config.js</code> (SUPABASE_URL, SUPABASE_ANON_KEY)</td><td>Banco que o site usa. Use só a chave <em>publishable</em>, nunca a secreta</td></tr>
        <tr><td>Exercício padrão</td><td><code>js/config.js</code> (ANO_PADRAO)</td><td>Ano exibido no painel</td></tr>
        <tr><td>Dicionário de dados (células do modelo)</td><td><code>js/dicionario.js</code> · página Perfil → Dicionário de dados</td><td>Define de onde cada campo é lido no Excel; ajustar aqui se a IPB publicar nova versão do modelo</td></tr>
        <tr><td>Estrutura do banco</td><td>SQL Editor: <code>schema.sql</code>, <code>002_envios</code> a <code>005_usuarios</code></td><td>Tabelas, permissões, pasta privada, funções</td></tr>
        <tr><td>Confirmação de e-mail</td><td>Authentication → Sign In / Providers → Email → <em>Confirm email</em></td><td>Deve ficar <strong>desligada</strong> para o convite criar a conta na hora</td></tr>
        <tr><td>Primeiro administrador / perfis manuais</td><td>SQL Editor, tabela <code>perfis</code></td><td>Papel (superadmin, admin_nacional, admin_sinodal, admin_presbiterial, representante) e vínculo</td></tr>
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
        <dt>“Seu usuário ainda não tem um perfil de acesso”</dt><dd>A conta existe, mas não está ligada a uma igreja ou presbitério. Peça um convite ao administrador e use “Já tenho conta”.</dd>
        <dt>Convite expirado ou já usado</dt><dd>Peça ao administrador para criar outro convite para o seu e-mail.</dd>
        <dt>“Exercício não confere” no envio</dt><dd>O ano escrito no documento é diferente do exercício escolhido. Troque o exercício ou envie o relatório correto.</dd>
        <dt>“Arquivo já enviado”</dt><dd>Esse mesmo arquivo já está no sistema para essa igreja e ano. Se houve correção, envie o arquivo corrigido.</dd>
        <dt>PDF digitalizado (imagem)</dt><dd>Pode ser enviado, mas os números serão digitados pelo administrador. Sempre que possível, gere o PDF direto do Excel do modelo.</dd>
        <dt>Somas com divergência</dt><dd>Algum total do relatório não bate com a soma das linhas. Confira o relatório; o administrador pode pedir correção ou corrigir os dados.</dd>
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
        <dt>Cobertura (“n de m igrejas”)</dt><dd>Quantas igrejas informaram aquele dado; o total soma só essas.</dd>
        <dt>Versão do relatório</dt><dd>Cada novo envio lido gera uma versão; as antigas ficam como “Substituída”.</dd>
      </dl>`,
    },
  ];

  const MEU = { representante: 'rep', admin_presbiterial: 'admin', admin_sinodal: 'admin', admin_nacional: 'admin', superadmin: 'admin' };

  // papel: papel do usuário logado (ou null na tela de login)
  function html(papel) {
    const meu = MEU[papel] || null;
    const relevante = (t) => !meu || t.para.includes('todos') || t.para.includes(meu);
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
