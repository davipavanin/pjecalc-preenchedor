# PJe-Calc Preenchedor: guia de instalação e uso

Versão de teste (0.1.0). Funciona no Windows, com o PJe-Calc Cidadão 2.16.0 e o Claude Desktop.

## O que ele faz

Você descreve o caso ao Claude ou anexa a sentença. O Claude monta a ficha do cálculo, pergunta o que faltar
e mostra um resumo. Depois que você aprova, ele preenche o PJe-Calc oficial instalado no seu computador,
liquida e salva o **PDF** e o **.PJC** para juntar no PJe.

Quem calcula é sempre o PJe-Calc. O Claude só digita e clica, como uma pessoa faria.

## Instalar (uma vez)

1. Confira se o **PJe-Calc Cidadão 2.16.0** está instalado e abre normalmente.
2. Confira se o **Claude Desktop** está instalado e atualizado.
3. Baixe **`pje-calc-preenchedor.mcpb`** e **`pjecalc-preenchedor.zip`** na página [Releases](https://github.com/davipavanin/pjecalc-preenchedor/releases) e dê dois cliques no `.mcpb`. O Claude Desktop abre a tela de instalação. Clique em
   **Instalar**.
   - Em "Pasta dos cálculos" fica `Documentos\PJe-Calc Preenchedor`. Pode trocar, se quiser.
   - "Mostrar o navegador" pode ficar desligado. Ligue se quiser ver o preenchimento acontecendo.
4. No Claude Desktop, vá em **Configurações → Capacidades → Skills**, clique em **Enviar skill** e escolha
   **`pjecalc-preenchedor.zip`**.

O Microsoft Edge, que já vem no Windows, é o navegador usado. Não precisa instalar mais nada.

## Usar

1. **Abra o PJe-Calc** pelo ícone e espere a tela inicial carregar.
2. No Claude Desktop, peça, por exemplo:
   > Faça o cálculo de liquidação deste processo no PJe-Calc. (anexe a sentença)
3. Responda às perguntas do Claude: datas, salários, índices de correção e o que a sentença não deixar claro.
4. **Leia o resumo da ficha com atenção.** Só responda "pode preencher" se estiver de acordo.
5. Espere alguns minutos. **Não mexa no PJe-Calc enquanto ele preenche.**
6. O Claude informa o número do cálculo e onde ficaram o PDF e o .PJC.
7. **Confira o PDF** antes de juntar no PJe.

Se a liquidação não fechar, o Claude mostra as pendências do PJe-Calc e o número do cálculo. Corrija no
PJe-Calc e peça: "liquide e exporte o cálculo nº X".

## O que esta versão cobre

- Dados do processo e do contrato, evolução salarial, prescrição quinquenal.
- Verbas do Lançamento Expresso: rescisórias, horas extras com reflexos, adicionais, multas dos
  arts. 467 e 477, indenizações com valor fixo.
- FGTS + 40%, honorários advocatícios, correção monetária e juros em fases (ex.: IPCA-E, SELIC, IPCA e taxa
  legal).

**Fica para você completar no PJe-Calc:** cartão de ponto, faltas, férias gozadas detalhadas,
salário-família, seguro-desemprego, pensão alimentícia, previdência privada, custas e verbas fora do
Lançamento Expresso. Nesses casos o Claude avisa o que ficou de fora.

## Cuidados

- O valor que vale é o do PDF do PJe-Calc. Confira sempre antes de juntar.
- Os nomes das partes precisam estar exatamente como no cadastro do PJe.
- Indenizações com valor fixo (como dano moral) são lançadas como pagamento único, sem proporcionalizar.
  Confira a data de arbitramento (Súmula 439 do TST) no PDF.
- Sentenças e dados de clientes ficam no seu computador; a extensão não envia nada para fora.
- Se o PJe-Calc for atualizado para outra versão, a extensão avisa e não preenche até ser testada nela.

## Ajuda

Qualquer erro: copie a mensagem do Claude e abra uma issue em https://github.com/davipavanin/pjecalc-preenchedor/issues (sem dados de clientes).
