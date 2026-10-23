// Aviso de privacidade (LGPD — Lei 13.709/2018). Página pública: abre também sem login.
window.Privacidade = (() => {
  const VERSAO = '22/10/2026';
  const sec = (titulo, corpo) => `<section class="card pv-sec"><header class="card-h"><h2>${titulo}</h2></header><div class="aj-c">${corpo}</div></section>`;

  function html() {
    return `
      <p class="nota top">Versão de ${VERSAO}. Este aviso explica, de forma simples, como a plataforma de estatística trata dados pessoais, conforme a Lei Geral de Proteção de Dados (LGPD — Lei 13.709/2018).</p>
      ${sec('1. Quem é responsável', `<p>A plataforma é utilizada pelo <strong>presbitério</strong> ao qual a sua igreja está vinculada, para receber e consolidar os relatórios estatísticos oficiais das igrejas. O presbitério é o responsável pelo tratamento dos dados dos seus usuários e relatórios.</p>
        <p>Para qualquer assunto de privacidade, fale com o <strong>administrador do seu presbitério</strong> (a pessoa que enviou o seu convite).</p>`)}
      ${sec('2. Quais dados são tratados', `<ul>
          <li><strong>Dos usuários:</strong> nome, e-mail, senha (guardada de forma cifrada — ninguém consegue lê-la), perfil de acesso (representante ou administrador), igreja vinculada e data do último acesso.</li>
          <li><strong>Dos relatórios:</strong> números estatísticos da igreja (membresia por sexo, admissões e demissões, Escola Dominical, departamentos, finanças e, quando enviado em Excel, atividades do Conselho). São dados da instituição, <strong>não de membros individuais</strong>.</li>
          <li><strong>Arquivos originais:</strong> o PDF ou Excel enviado é guardado como comprovante. O modelo oficial contém nome, endereço, telefone e e-mail do secretário do Conselho e da igreja. <strong>Esses dados pessoais não são extraídos nem exibidos</strong> nos painéis; ficam apenas no arquivo original, em pasta privada.</li>
          <li><strong>Registro de ações:</strong> quem fez cada envio, validação, correção, convite ou alteração de cadastro, e quando.</li>
        </ul>`)}
      ${sec('3. O que não é coletado', `<ul>
          <li>Lista de membros, nomes ou dados individuais de membros das igrejas.</li>
          <li>Localização, contatos do celular, fotos, câmera ou microfone.</li>
          <li>Rastreadores de publicidade ou ferramentas de análise de navegação.</li>
        </ul>`)}
      ${sec('4. Para que os dados são usados', `<ul>
          <li>Permitir o acesso seguro de cada pessoa apenas ao que corresponde à sua função.</li>
          <li>Receber, conferir, validar e consolidar os relatórios estatísticos, gerando os painéis da igreja, do presbitério, do sínodo e a visão nacional.</li>
          <li>Manter o histórico e a rastreabilidade dos números (quem enviou, corrigiu ou validou).</li>
          <li>Os dados <strong>não são vendidos, cedidos para propaganda nem usados para outra finalidade</strong>.</li>
        </ul>`)}
      ${sec('5. Quem tem acesso', `<ul>
          <li><strong>Representante da igreja:</strong> somente os dados e arquivos da própria igreja.</li>
          <li><strong>Administrador do presbitério:</strong> as igrejas sob a jurisdição do presbitério, os usuários e o registro de ações do presbitério.</li>
          <li><strong>Administrador sinodal</strong> (do sínodo do presbitério), <strong>administrador nacional</strong> e <strong>superadministrador:</strong> pelas regras da plataforma, também podem consultar os relatórios das igrejas sob sua abrangência. As telas do sínodo e nacional mostram apenas <strong>totais agregados</strong>. Essas contas aparecem para o administrador do presbitério em <em>Usuários e convites → Outros acessos a este presbitério</em>.</li>
          <li>Os arquivos originais só podem ser abertos por quem tem acesso à igreja, por meio de link temporário (10 minutos).</li>
          <li>Quem não recebeu convite (ou não está logado) não vê nenhum dado da plataforma.</li>
        </ul>`)}
      ${sec('6. Onde os dados ficam e como são protegidos', `<ul>
          <li>Os dados e arquivos ficam no serviço de banco de dados em nuvem <strong>Supabase</strong>; o site é publicado pelo <strong>GitHub Pages</strong>, que hospeda apenas o programa, sem dados.</li>
          <li>Toda comunicação é <strong>criptografada</strong> (HTTPS). As regras de acesso ficam no próprio banco de dados, que recusa qualquer leitura fora da jurisdição do usuário.</li>
          <li>A chave secreta do banco não fica no site. Os arquivos originais ficam em pasta <strong>privada</strong>.</li>
          <li>Cópias de segurança baixadas pelo administrador contêm e-mails de usuários e devem ser guardadas como documento confidencial.</li>
        </ul>`)}
      ${sec('7. Por quanto tempo', `<ul>
          <li><strong>Relatórios e histórico:</strong> mantidos enquanto forem necessários para a estatística da Igreja; versões substituídas não são apagadas, para preservar a rastreabilidade.</li>
          <li><strong>Usuários:</strong> quando o acesso é removido, a pessoa deixa de ver qualquer dado imediatamente. A exclusão da conta de login pode ser pedida ao administrador do presbitério.</li>
        </ul>`)}
      ${sec('8. Seus direitos', `<p>Pela LGPD (art. 18), você pode pedir: confirmação de que seus dados são tratados, acesso a eles, correção de dados incompletos ou desatualizados, exclusão dos dados desnecessários, informação sobre com quem são compartilhados e revisão deste tratamento.</p>
        <p>Faça o pedido ao <strong>administrador do seu presbitério</strong>. Nome e e-mail podem ser corrigidos por ele; a exclusão da conta é feita pelo responsável técnico.</p>`)}
      ${sec('9. Armazenamento no seu aparelho', `<ul>
          <li>O navegador guarda a sua <strong>sessão de login</strong>, para você não precisar entrar toda vez. Use <em>Perfil → Sair</em> em aparelhos compartilhados.</li>
          <li>Também guarda preferências simples (como o limite de alerta de variação) e uma cópia do programa para abrir mais rápido — <strong>nunca os dados dos relatórios</strong>.</li>
          <li>Não são usados cookies de publicidade ou rastreamento.</li>
        </ul>`)}
      ${sec('10. Alterações deste aviso', `<p>Este aviso pode ser atualizado. A data da versão fica no topo da página.</p>`)}`;
  }

  return { html, VERSAO };
})();
