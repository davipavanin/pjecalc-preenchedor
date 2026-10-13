# PJe-Calc Preenchedor

Extensão do Claude Desktop que preenche o **PJe-Calc Cidadão** oficial instalado no computador a partir de uma
ficha do cálculo montada pela IA e **aprovada pelo advogado**, liquida e salva o **PDF** e o **.PJC** para juntar
no PJe.

Quem calcula é sempre o PJe-Calc. A extensão só digita e clica, como uma pessoa faria, pelo Microsoft Edge.

> Projeto aberto, sem fins comerciais e **sem vínculo com a Justiça do Trabalho, o CSJT ou o TRT8**.
> Versão de teste (0.1.0), testada só com dados fictícios no PJe-Calc 2.16.0. Confira sempre o PDF gerado.

- **Instalar e usar:** [docs/guia.md](docs/guia.md)
- **Baixar:** página [Releases](https://github.com/davipavanin/pjecalc-preenchedor/releases)

## Como funciona

1. O advogado anexa a sentença no Claude Desktop. A skill monta a ficha só com o que está nos documentos e
   pergunta o que falta.
2. `conferir_ficha` valida a ficha (datas, faixas salariais, dígito do número CNJ, verbas sem horas ou valor)
   e devolve um resumo para revisão.
3. `preencher_calculo` só roda depois da aprovação expressa do advogado. Preenche dados do processo, parâmetros,
   histórico salarial, verbas do Lançamento Expresso com reflexos, FGTS, honorários e correção/juros; liquida;
   exporta o `.PJC` e o PDF oficial.
4. `liquidar_e_exportar` liquida e exporta um cálculo que o advogado completou à mão.

Proteções: lê de volta todo campo numérico depois de digitar (máscaras do PJe-Calc alteram valores em
silêncio), confere o nome da verba antes de editar, recusa versões do PJe-Calc não testadas e recusa exportar
`.PJC` sem liquidação.

## Privacidade

A extensão roda inteira no computador do advogado e não envia dados para nenhum servidor além do próprio
Claude que ele usa. Não abra issues com dados de clientes.

## Desenvolvimento

```bash
npm ci
npm run teste       # ponta a ponta com a ficha fictícia (PJe-Calc aberto)
npm run teste:mcp   # o mesmo, chamando o servidor MCP por stdio
npm run pacote      # gera dist/pje-calc-preenchedor.mcpb e dist/pjecalc-preenchedor.zip
```

- `servidor/robo.js`: opera a tela do PJe-Calc (regras verificadas na 2.16.0 em `docs/pesquisa/`).
- `servidor/ficha.js`: schema da ficha e regras de conferência.
- `servidor/index.js`: servidor MCP (stdio).
- `skill/pjecalc-preenchedor/SKILL.md`: como a IA conduz a conversa.

Fora de escopo nesta versão: cartão de ponto, faltas, férias gozadas detalhadas, salário-família,
seguro-desemprego, pensão, previdência privada, custas e verbas fora do Lançamento Expresso.

## Licença

[MIT](LICENSE). O PJe-Calc Cidadão é software da Justiça do Trabalho e não é distribuído aqui.
