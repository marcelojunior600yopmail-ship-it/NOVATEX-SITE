/* ==========================================================================
   SEU PENDRIVE ATUALIZADO — CONFIGURAÇÃO DA LOJA
   --------------------------------------------------------------------------
   ESTE É O ÚNICO ARQUIVO QUE VOCÊ PRECISA MEXER NO DIA A DIA.

   Aqui você:
     • adiciona / remove produtos           -> LOJA.produtos
     • muda preço, nome, descrição, foto    -> LOJA.produtos
     • cria cupons de desconto              -> LOJA.cupons
     • troca o número do WhatsApp           -> LOJA.whatsapp
     • liga o Mercado Pago e cola as chaves -> LOJA.pagamento.mercadoPago

   Nada mais no site precisa ser alterado: o carrinho, o checkout e a página
   de sucesso leem tudo daqui.
   ========================================================================== */
(function (window) {
  'use strict';

  var LOJA = {

    /* ---------------------------------------------------------------------
       1. LOJA
       --------------------------------------------------------------------- */
    nome: 'Seu Pendrive Atualizado',
    moeda: 'BRL',
    locale: 'pt-BR',

    /* ---------------------------------------------------------------------
       2. WHATSAPP  (para onde o cliente é levado ao finalizar a compra)
       --------------------------------------------------------------------- */
    whatsapp: {
      // Formato internacional, só números: 55 + DDD + número.
      // 55 (Brasil) + 33 (DDD) + 997090370
      numero: '5533997090370',
      exibicao: '(33) 99709-0370',
      // Quantos segundos a página de sucesso espera antes de abrir a conversa
      // sozinha. Use 0 para abrir na hora.
      redirecionarEmSegundos: 3
    },

    /* ---------------------------------------------------------------------
       3. PÁGINAS
       --------------------------------------------------------------------- */
    paginas: {
      loja: 'repertorio.html',
      sucesso: 'sucesso.html'
    },

    /* ---------------------------------------------------------------------
       4. PAGAMENTO
       ---------------------------------------------------------------------
       provedor:
         'whatsapp'    -> (ATUAL) o cliente preenche os dados, finaliza e cai
                          direto na sua conversa do WhatsApp com o resumo do
                          pedido pronto. Você combina o pagamento (Pix/etc.)
                          e manda o link de download.

         'mercadopago' -> o cliente é enviado ao checkout do Mercado Pago e,
                          depois do pagamento aprovado, volta para a página de
                          sucesso e é levado ao seu WhatsApp do mesmo jeito.
                          Para usar, preencha as credenciais abaixo e suba o
                          servidor de exemplo em /mercadopago (leia o README).
       --------------------------------------------------------------------- */
    pagamento: {
      provedor: 'whatsapp',

      mercadoPago: {
        /* ===============================================================
           >>> COLE AQUI AS CREDENCIAIS DO MERCADO PAGO <<<

           PUBLIC KEY  — pode ficar no site, é pública.
                         Painel Mercado Pago > Suas integrações > Credenciais
                         Ex.: 'APP_USR-00000000-0000-0000-0000-000000000000'

           ACCESS TOKEN — **NÃO** cole aqui. É uma chave secreta e ficaria
                         visível para qualquer visitante. Ela vai no servidor,
                         no arquivo mercadopago/.env (veja mercadopago/README.md).
           =============================================================== */
        publicKey: 'COLE_AQUI_SUA_PUBLIC_KEY',

        // Endereço do seu servidor que cria a preferência de pagamento
        // (o servidor de exemplo já responde neste caminho).
        endpointCriarPreferencia: '/api/mercadopago/criar-preferencia',

        // Para onde o Mercado Pago devolve o cliente depois de pagar.
        // Deixe o domínio completo quando o site estiver publicado.
        // Ex.: 'https://seudominio.com.br/sucesso.html'
        urlRetornoSucesso: 'sucesso.html',
        urlRetornoPendente: 'sucesso.html',
        urlRetornoFalha: 'repertorio.html'
      }
    },

    /* ---------------------------------------------------------------------
       5. CUPONS DE DESCONTO  (opcional — deixe a lista vazia para desligar)
       ---------------------------------------------------------------------
       tipo: 'percentual' (valor em %) ou 'fixo' (valor em reais)
       minimo: valor mínimo do carrinho para o cupom valer (0 = sem mínimo)
       --------------------------------------------------------------------- */
    cupons: [
      { codigo: 'PAREDAO10', tipo: 'percentual', valor: 10, minimo: 0, rotulo: '10% de desconto' },
      { codigo: 'SEUPENDRIVE5', tipo: 'fixo', valor: 5, minimo: 20, rotulo: 'R$ 5,00 de desconto' }
    ],

    /* ---------------------------------------------------------------------
       6. PRODUTOS
       ---------------------------------------------------------------------
       Para adicionar um produto novo, copie um bloco inteiro { ... } e cole
       depois da vírgula. Campos:

         id        (obrigatório) identificador único, sem espaço
         nome      (obrigatório) título do produto
         preco     (obrigatório) número, sem "R$" e usando ponto: 20 ou 19.9
         precoDe   (opcional)    preço "de" riscado, para mostrar promoção
         descricao (obrigatório) texto do produto
         imagem    (obrigatório) caminho da foto
         alt       (opcional)    descrição da foto para acessibilidade
         tag       (opcional)    selo que aparece na foto
         entrega   (opcional)    linha curta de entrega, ex.: 'Download imediato'
         destaques (opcional)    lista de bullets do card
         maxQtd    (opcional)    limite por pedido (padrão 99)
       --------------------------------------------------------------------- */
    produtos: [
      {
        id: 'repertorio-atualizado',
        nome: 'Repertório Atualizado',
        preco: 20,
        precoDe: null,
        descricao: 'Acesso ao repertório completo e atualizado, organizado em pastas para facilitar a navegação. Após a confirmação do pagamento, o cliente recebe o link para download.',
        imagem: 'assets/img/produto-repertorio.jpg',
        alt: 'Capa do Repertório Atualizado mostrando as 32 pastas e o preço de R$ 20,00',
        tag: 'Mais vendido',
        entrega: 'Link de download enviado no WhatsApp',
        destaques: [
          'Mais de 5.000 músicas',
          '32 pastas separadas por estilo',
          'Atualizações constantes',
          'Pronto para paredão, som automotivo e festas'
        ],
        maxQtd: 20
      }
    ],

    /* ---------------------------------------------------------------------
       7. CARRINHO (ajustes finos — pode deixar como está)
       --------------------------------------------------------------------- */
    carrinho: {
      chaveArmazenamento: 'pendrive:carrinho',
      chavePedido: 'pendrive:ultimo-pedido',
      maxQtdPadrao: 99
    }
  };

  window.LOJA = LOJA;
})(window);
