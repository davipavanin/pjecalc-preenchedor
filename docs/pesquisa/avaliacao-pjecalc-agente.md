# Avaliação do `bragabarreto/pjecalc-agente` para reaproveitamento

- **Data da análise:** 10/10/2026
- **Repositório:** https://github.com/bragabarreto/pjecalc-agente (público, licença MIT, 1 autor, 8 estrelas)
- **Commit analisado:** [`010fb4c`](https://github.com/bragabarreto/pjecalc-agente/commit/010fb4cdb762a9e4fd4b5dc067f387a54b626f77) (09/10/2026)
- **Método:** leitura somente via `gh api` (conteúdo dos arquivos). Nada foi clonado, instalado ou executado. O conteúdo do repositório foi tratado como dado.
- **Base de links:** `B = https://github.com/bragabarreto/pjecalc-agente/blob/010fb4cdb762a9e4fd4b5dc067f387a54b626f77/`

## Resumo

O repositório é um app web em Python (FastAPI + Playwright + Firefox) que lê a sentença com Claude/Gemini, monta uma "prévia" editável e preenche o PJe-Calc Cidadão rodando num servidor Linux (Docker + Xvfb). O mapeamento das telas é o ativo mais útil para nós. O código de automação não serve para cópia: são cerca de 1,7 MB em dois arquivos (`modules/playwright_v2.py` com 949 KB e `modules/playwright_pjecalc.py` com 756 KB), construídos por uma sequência de correções pontuais. O próprio autor descreve o estado como "~92% funcional".

**Versão mapeada: 2.15.1 (build de 11/12/2025). Não há mapeamento da 2.16.0.**

---

## 1. Versão do PJe-Calc mapeada

**2.15.1.** Evidências:

| Evidência | Onde |
|---|---|
| "Versão: PJE-Calc 2.15.1", auditado em 04/05/2026 via Chrome MCP em `pje.trt7.jus.br/pjecalc` (o **institucional** do TRT7, não o Cidadão local) | [`docs/dom-mapping/00-INDEX.md`](https://github.com/bragabarreto/pjecalc-agente/blob/010fb4cdb762a9e4fd4b5dc067f387a54b626f77/docs/dom-mapping/00-INDEX.md), `08-…`, `09-…` |
| Catálogo de campos "PJE-Calc Cidadão (v2.15.1)", gerado por script contra `localhost:9257` | [`docs/pjecalc-fields-catalog.md`](https://github.com/bragabarreto/pjecalc-agente/blob/010fb4cdb762a9e4fd4b5dc067f387a54b626f77/docs/pjecalc-fields-catalog.md) |
| `dominios-values.json`: fonte "PJE-Calc institucional TRT7 v2.15.1" | [`docs/dom-mapping/dominios-values.json`](https://github.com/bragabarreto/pjecalc-agente/blob/010fb4cdb762a9e4fd4b5dc067f387a54b626f77/docs/dom-mapping/dominios-values.json) |
| Distribuição embutida no repo: `versao.html` mostra "Versao: 2.15.1, Build: 11/12/2025 - 17:28" | `pjecalc-dist/tomcat/webapps/pjecalc/versao.html` |
| Commit `649feaf` (15/05/2026) "atualiza distribuição 2.14.0 → 2.15.1". O autor afirma que a única novidade são 4 classes da EC 136/2025 (precatórios) e que "XHTML/DOM é idêntico entre versões" | histórico de `versao.html` |
| Os JARs ainda se chamam `pjecalc-*-2.14.0.jar` na árvore atual (provável renomeação incompleta) | `pjecalc-dist/tomcat/webapps/pjecalc/WEB-INF/lib/` |

Nenhum arquivo ou commit menciona a 2.16. Por isso **todo ID precisa ser revalidado na 2.16.0** antes de virar código nosso. O histórico 2.14 → 2.15.1 sugere que o DOM muda pouco entre versões menores, mas isso não substitui a verificação.

Ressalva sobre a origem: parte do mapeamento (docs `00`, `06` a `09`, `dominios-values.json`) foi capturada no **PJe-Calc institucional do TRT7**, e o catálogo `.json/.md` e a automação usam o **Cidadão local**. O próprio repositório documenta divergências de comportamento entre os dois (ver a seção 5).

---

## 2. Ordem das telas, IDs-chave e armadilhas

### 2.1 Fatos gerais da plataforma

- **Stack do PJe-Calc:** JSF 1.2 + Seam 2.2 + RichFaces 3/A4J, Tomcat 7.0.67 embarcado, H2 e Java 8 ([`CLAUDE.md`](https://github.com/bragabarreto/pjecalc-agente/blob/010fb4cdb762a9e4fd4b5dc067f387a54b626f77/CLAUDE.md), seção "HORAS EXTRAS 50%"). **Consequência:** `jsf.ajax.addOnEvent`, que é JSF 2, **não existe**. O "monitor AJAX" da skill ([`SKILL.md`](https://github.com/bragabarreto/pjecalc-agente/blob/010fb4cdb762a9e4fd4b5dc067f387a54b626f77/.claude/skills/pjecalc-automacao/SKILL.md)) é inócuo, e o `core/aplicador.py` já o trocou por `networkidle`. Tags JSF 2.0 injetadas no XHTML derrubaram o app inteiro (tentativa nº 9 no `CLAUDE.md`).
- **URLs:** `/pjecalc/pages/calculo/<pagina>.jsf?conversationId=N`. A lista completa está em [`00-INDEX.md`](https://github.com/bragabarreto/pjecalc-agente/blob/010fb4cdb762a9e4fd4b5dc067f387a54b626f77/docs/dom-mapping/00-INDEX.md).
- **Menu lateral:** `li#li_calculo_<secao> a`, com as seções `dados_calculo`, `faltas`, `ferias`, `historico_salarial`, `verbas`, `cartao_de_ponto`, `salario_familia`, `seguro_desemprego`, `fgts`, `inss`, `previdencia_privada`, `pensao_alimenticia`, `irpf`, `multas_e_indenizacoes`, `honorarios`, `custas_judiciais` e `correcao_juros_multa`. Para Operações: `li_operacoes_liquidar` e `li_operacoes_exportar`.
- **Padrões de ID:** `formulario:CAMPO`. Radios usam `formulario:CAMPO:N`, por isso `[id$='CAMPO']` **não casa** e o seletor certo é `input[type=radio][name$=':CAMPO'][value='X']`. Tabelas usam `formulario:listagem:N:CAMPO`, e reflexos usam `formulario:listagem:N:listaReflexo:M:ativo`. Prefixos `j_idNN` são dinâmicos: localize por sufixo, título ou texto.
- **Valores de radio e select:** enums em MAIÚSCULAS (`HISTORICO_SALARIAL`, `OITO_POR_CENTO`…). Mande o *value*, nunca o rótulo (erro E03 do registro).

### 2.2 Armadilhas transversais (as mais valiosas do repositório)

1. **Navegação só pelo clique no menu lateral.** Uma URL direta com `conversationId` frequentemente não renderiza o formulário (`n_radios=0`) ou não chama o `@Begin` do bean Seam, o que dá NPE em `prepararMinicrudsDasBasesCadastradas`. O clique precisa **esperar o documento novo ser carregado**: `verba-calculo.jsf` tem cerca de 1,2 MB, `networkidle` volta antes da troca e o clique seguinte cai no documento antigo (`CLAUDE.md` #80-DX).
2. **Conversa Seam frágil.** Depois de "Novo cálculo", a conversa fica em modo "criação" e o menu lateral não mostra as seções. O salvar do Lançamento Expresso abandona a conversa. A saída usada é "Fechar e Reabrir" o cálculo via "Cálculos Recentes" (duplo clique). Ao ver "Erro Interno no Servidor", o caminho é voltar a `principal.jsf` e reabrir.
3. **Datas (RichFaces Calendar):** `fill()` aceita no DOM mas o servidor descarta. O caminho que funcionou: `focus`, `Ctrl+A`, `Delete`, `press_sequentially` **só dos dígitos** (a máscara insere as barras), `Escape` para fechar o popup e depois `blur`/`change`. Competências usam `MM/AAAA`. Horas `HH:MM` exigem digitar e disparar `blur` + `change` por JS **sem Tab**, porque o Tab ativa a máscara do campo seguinte.
4. **Números:** formato BR (`1.234,56`). O formatador precisa respeitar `maxlength` (#80-O no `CLAUDE.md`).
5. **Salvar:** `formulario:salvar` é `type=button` com `A4J.AJAX.Submit`. Confirme pela mensagem de sucesso e **reler o valor não confirma um save recusado** (#80-CZ). Em caso de recusa silenciosa, **Cancelar** o formulário, senão a tela fica presa em modo Alteração.
6. **Modal "Confirmação" do Regerar** (`regerarOcorrencias`) é um `rich:modalPanel` em HTML, **não** um diálogo nativo do navegador. `page.on("dialog")` não pega: é preciso clicar o "Ok" visível. Regras do autor: Regerar depois de **cada** alteração de parâmetro ou de ocorrência, com "Manter" (`tipoRegeracao=true`) ou "Sobrescrever" (`false`) conforme o caso.
7. **Casamento de linha por igualdade exata do `<td>`.** O `<tr>` externo de layout contém o texto da página inteira, e `tr.textContent.includes()` já fez "HE 50%" virar "FÉRIAS + 1/3" no banco (bug "catastrófico" de 21/05/2026). Guarda adicional: antes de editar Parâmetros, ler `descricao` e abortar se não for a verba esperada.
8. **Clique:** em links de lista (`linkParametrizar`, `linkOcorrencias`), o clique nativo do Playwright (ou `element.click()` via JS) funcionou. Executar a string do `onclick` foi inerte em vários pontos, como no "Apurar" do Cartão de Ponto.
9. **Elementos que somem em vez de ficar desabilitados.** Ao trocar radio ou select (Valor = INFORMADO, Divisor = CARGA_HORARIA, Quantidade = IMPORTADA…), o RichFaces **remove** campos do DOM e cria outros. Todo seletor precisa ser defensivo e esperar o re-render.
10. **Selects dependentes:** `estado` usa índice numérico (0 = AC … 26 = TO) e o `municipio` chega por AJAX depois, com texto em maiúsculas e sem acento. `incidenciaDoFgts` e `aliquota` do FGTS só habilitam depois de marcar `tipoDeVerba`. Forçar `disabled=false` por JS "passa", mas pode não persistir.
11. **Liquidar dispara navegação.** `page.evaluate(click)` perde o contexto ("Execution context was destroyed"). Use clique por locator mais espera do resultado. A liquidação pode levar minutos (Drools): reabrir no meio interrompe o processamento.
12. **Exportar só depois de "Cálculo liquidado com sucesso".** Antes disso o `.PJC` sai com `hashCodeLiquidacao=null` e é rejeitado na importação (E01).
13. **Ordem do manual oficial** (citada pelo autor): `Dados → Faltas → Férias → Histórico → Verbas`, com o Cartão de Ponto **antes** das Verbas quando a quantidade vem do cartão (`IMPORTADA_DO_CARTAO`). Faltas injustificadas mudam o prazo de férias, e as ocorrências de férias nascem do que a aba Férias mostra no momento das Verbas. **Atenção:** o `core/aplicador.py` (v3, em desenvolvimento) roda as Verbas **por último**, contrariando o manual e o próprio `CLAUDE.md`.

### 2.3 Tela por tela

**Dados do Cálculo** (`calculo.jsf`, duas abas: "Dados do Processo" e "Parâmetros do Cálculo")
- Processo: `formulario:numero`, `digito`, `ano`, `justica` (5), `regiao`, `vara`, `valorDaCausa`, `autuadoEm`, `processoInformadoManualmente`.
- Partes: `reclamanteNome`, `documentoFiscalReclamante` (CPF/CNPJ/CEI), `reclamanteNumeroDocumentoFiscal`, `reclamanteTipoDocumentoPrevidenciario` (PIS/PASEP/NIT), `reclamadoNome`, `tipoDocumentoFiscalReclamado`, advogados mais o "+" `incluirAdvogadoReclamante/Reclamado`. O campo de número do documento fica bloqueado até escolher o tipo.
- Parâmetros: `estado`, `municipio`, `dataAdmissaoInputDate`, `dataDemissaoInputDate`, `dataAjuizamentoInputDate`, `dataInicioCalculoInputDate`, `dataTerminoCalculoInputDate`, `prescricaoQuinquenal`, `prescricaoFgts`, `tipoDaBaseTabelada` (aqui com o sentido de regime: INTEGRAL/PARCIAL/INTERMITENTE, mesmo ID usado em Verbas com outro sentido), `valorMaiorRemuneracao`, `valorUltimaRemuneracao`, `apuracaoPrazoDoAvisoPrevio` (NAO_APURAR/APURACAO_CALCULADA/APURACAO_INFORMADA), `projetaAvisoIndenizado`, `limitarAvos`, `zeraValorNegativo`, `consideraFeriadoEstadual/Municipal`, `valorCargaHorariaPadrao` mais exceções (`incluirExcecaoCH`), `sabadoDiaUtil` mais exceções, `pontoFacultativo`.
- Armadilhas: estado e município ficam na 2ª aba (clicar na aba). `dataTerminoCalculo` precisa cobrir verbas pós-contrato (estabilidades), senão a liquidação bloqueia (E07/E13).

**Faltas** (`falta.jsf`): `dataInicioPeriodoFaltaInputDate`, `dataTerminoPeriodoFaltaInputDate`, `faltaJustificada`, `reiniciaFerias`, `justificativaDaFalta`, botão `cmdIncluirFalta`. Aceita importação de CSV.

**Férias** (`ferias.jsf`): tabela de períodos aquisitivos gerada a partir do contrato, com `formulario:listagem:N:situacao`, prazo, dobra, abono e gozo 1 e 2. Também `prazoFeriasProporcionais` (deixar vazio usa o padrão), `inicioFeriasColetivasInputDate`, `regerarFeriasColetivas`. Armadilhas documentadas: a aba **não lista o período proporcional**; a linha é a do período aquisitivo, não o índice; situação "não gozada" precisa limpar o gozo; IDs por linha **não foram mapeados** no doc 08 (só no `CLAUDE.md`, de forma dispersa).

**Histórico Salarial** (`historico-salarial.jsf`): botão `formulario:incluir` ("Novo"), `nome`, `tipoVariacaoDaParcela` (FIXA/VARIAVEL), `fgts`, `inss`, competências inicial e final (**conflito de IDs**: o doc 05 diz `competenciaInicialInputDate`, o `dom-ids.md` diz `dataInicioInputDate`), `tipoValor` (INFORMADO/CALCULADO), `valorParaBaseDeCalculo`, `cmdGerarOcorrencias`, `salvar`. Em CALCULADO aparecem `quantidade` e `baseDeReferencia`. Regras do autor: o histórico deve cobrir **todo** o período do cálculo; evolução salarial se faz por **ocorrências de um histórico**, não por N históricos (#80-L); esperar a `listagemMC` renderizar (#80-DJ).

**Verbas, listagem** (`verba/verba-calculo.jsf`): `formulario:incluir` ("Manual"), `formulario:lancamentoExpresso`, `formulario:regerarOcorrencias` com o radio `tipoRegeracao`. Por linha: link Parâmetros (`title="Parâmetros da Verba"`, 1º ícone), Ocorrências (2º), Excluir (3º). O painel de reflexos fica em `formulario:listagem:N:divDestinacoes .linkDestinacoes` ("Exibir") e os checkboxes em `formulario:listagem:N:listaReflexo:M:ativo`. **O painel precisa estar aberto** para o clique valer. Cada checkbox tem AJAX próprio, então é preciso esperar entre um e outro. O ícone "Parametrizar" do reflexo só aparece depois de marcado e salvo.

**Verbas, Lançamento Expresso** (`verba/verbas-para-calculo.jsf`): grade de 54 checkboxes `formulario:j_id82:L:j_id84:C:selecionada`. Localize por `[id$=':selecionada']` mais o texto da `<td>` e role a página. A lista canônica das 54 verbas está em [`02-verba-expresso.md`](https://github.com/bragabarreto/pjecalc-agente/blob/010fb4cdb762a9e4fd4b5dc067f387a54b626f77/docs/dom-mapping/02-verba-expresso.md). Estratégias: `expresso_direto`, `expresso_adaptado` (marcar uma verba parecida e renomear em Parâmetros) e `manual`. Não renomear `descricao` em `expresso_direto`.

**Verbas, Manual / Parâmetros** (mesmo `verba-calculo.jsf`): `descricao`, `codigoAssuntosCnj` + `assuntosCnj` (modal em árvore `btnSelecionarCNJ`; o autor usa 2581 como padrão), `tipoVariacaoDaParcela`, `valor` (CALCULADO/INFORMADO), incidências `irpf`/`inss`/`fgts`/`previdenciaPrivada`/`pensaoAlimenticia`, `caracteristicaVerba` (COMUM/DECIMO_TERCEIRO_SALARIO/AVISO_PREVIO/FERIAS, que deriva `ocorrenciaPagto` MENSAL/DEZEMBRO/DESLIGAMENTO/PERIODO_AQUISITIVO), `ocorrenciaAjuizamento` (Súmula 439), `tipoDeVerba`, `geraReflexo`, `gerarPrincipal`, `comporPrincipal`, `zeraValorNegativo`, `periodoInicialInputDate`/`periodoFinalInputDate`, exclusões (`excluirFaltaJustificada`, `excluirFaltaNaoJustificada`, `excluirFeriasGozadas`, `dobraValorDevido`), fórmula (`tipoDaBaseTabelada` com MAIOR_REMUNERACAO/HISTORICO_SALARIAL/SALARIO_DA_CATEGORIA/SALARIO_MINIMO/VALE_TRANSPORTE, `baseHistoricos`, **botão `incluirBaseHistorico` obrigatório**, `proporcionalizaHistorico` × `aplicarProporcionalidadeABase`, `baseVerbaDeCalculo`, `integralizarBase`, `tipoDeDivisor` + `outroValorDoDivisor`, `outroValorDoMultiplicador`, `tipoDaQuantidade` + `valorInformadoDaQuantidade`), valor pago (`tipoDoValorPago`, `valorInformadoPago`), e em INFORMADO o campo `valorInformadoDoDevido`. A errata [`06-ERRATA-FASE1.md`](https://github.com/bragabarreto/pjecalc-agente/blob/010fb4cdb762a9e4fd4b5dc067f387a54b626f77/docs/dom-mapping/06-ERRATA-FASE1.md) **prevalece** sobre o doc 01.
- Armadilhas: selecionar `baseHistoricos` sem clicar em "Adicionar Base" causa "Falta selecionar pelo menos um Histórico Salarial" (E02). Uma ocorrência diferente de MENSAL com período depois da demissão é recusada (E08). O multiplicador alterado depois de gerar ocorrências exige Regerar (E09).

**Ocorrências da verba** (`parametrizar-ocorrencia.jsf`): alteração em lote com `dataInicialInputDate`, `dataFinalInputDate`, `divisor`, `multiplicador`, `quantidade`, `dobra`, `devido`, `pago` e o botão `formulario:recuperar` ("Alterar"). Por linha: `listagem:N:ativo`, `selecionar`, `termoDiv`, `termoMult`, `termoQuant`, `valorDevido`, `valorPago`. Os reflexos aparecem na mesma página como `reflexos:N:listagem:M:*Reflexo` (sufixo `Reflexo` nos campos de texto). Um `salvar` grava tudo. Verba INFORMADA sem `valorDevido` diferente de zero bloqueia a liquidação (E11). HE com `termoQuant=0` gera alerta (E10).

**Parâmetros do reflexo** (doc 07): `comportamentoDoReflexo` (VALOR_MENSAL/MEDIA_PELO_VALOR/MEDIA_PELO_VALOR_CORRIGIDO/MEDIA_PELA_QUANTIDADE), quantidade APURADA, divisor 30. Reflexo que não aparece no painel vira verba Manual com fórmula (#80-EC).

**Cartão de Ponto** (`cartaodeponto/apuracao-cartaodeponto.jsf`): `competenciaInicial/FinalInputDate`, `tipoApuracaoHorasExtras` (7 opções, incluindo Súmula 85), jornadas `valorJornadaSegunda…Dom`, `qtJornadaSemanal/Mensal`, intervalos (art. 71, 384, 253, interjornada), noturno (`horarioNoturnoApuracaroCartao`, redução ficta, Súmula 60), `preenchimentoJornadasCartao` (LIVRE/PROGRAMACAO/ESCALA). Botão "Apurar" (`montarApartirDaApuracao`, `a4j:commandButton`): **clique nativo e espera pela tabela `tabOcorrencias`** (até 10 min para 34 meses). Com vários cartões, uma única apuração depois do último.

**FGTS** (`fgts.jsf` + `parametrizar-fgts.jsf`): `tipoDeVerba` (PAGAR/DEPOSITAR), `comporPrincipal`, `multa`, `tipoDoValorDaMulta`, `multaDoFgts` (VINTE/QUARENTA_POR_CENTO), `incidenciaDoFgts`, `excluirAvisoDaMulta`, `multaDoArtigo467`, `multa10`, `contribuiçãoSocial` (**ID com acento**), `aliquota` (DOIS/OITO_POR_CENTO), saldos `competenciaInputDate` + `valor` + `cmdIncluir`, botão `ocorrencias`. A multa do art. 467 entra aqui ou como reflexo, **nunca** como verba principal própria (inv25).

**Contribuição Social** (`inss/inss.jsf` + `parametrizar-inss.jsf`): `apurarInssSeguradoDevido`, `cobrarDoReclamanteDevido`, `corrigirDescontoReclamante`, `apurarSalariosPagos`, `aliquotaEmpregado`, `aliquotaEmpregador`, alíquotas fixas, períodos DEVIDOS e PAGOS. Na sub-página: `recuperarDevidos`, `copiarDevidos`, `regerar`. **Armadilha:** sair de `parametrizar-inss.jsf` antes de ir para outra seção. O bot ficou preso ali e IR, Honorários e Custas "preencheram" a página errada em cascata (E04 a E06 do registro).

**Imposto de Renda** (`irpf.jsf`): `apurarImpostoRenda`, `incidirSobreJurosDeMora`, `cobrarDoReclamado`, `considerarTributacaoExclusiva`, `considerarTributacaoEmSeparado` (RRA), `regimeDeCaixa`, deduções (CS, previdência privada, pensão, honorários), `aposentadoMaiorQue65Anos`, `possuiDependentes`, `quantidadeDependentes`.

**Correção, Juros e Multa** (`parametros-atualizacao/parametros-atualizacao.jsf`): `indiceTrabalhista` (16 opções, incluindo IPCAE, SELIC e TABELA_UNICA_JT…), `combinarOutroIndice`, `ignorarTaxaNegativa`, `aplicarJurosFasePreJudicial`, `juros` (13 opções, incluindo TAXA_LEGAL e TRD_SIMPLES), `combinarOutroJuros` + `outroJuros` + `apartirDeOutroJurosInputDate` + `addOutroJuros` (é a combinação ADC 58 / Lei 14.905), `baseDeJurosDasVerbas`, além de blocos de FGTS, previdência privada, custas, Lei 11.941 e INSS. **Armadilha:** o caminho real é o acima. O bot legado tentou 4 URLs adivinhadas e todas deram 404 (E07).

**Honorários** (`honorarios.jsf`): `formulario:incluir` e depois `tpHonorario` (11 tipos), `descricao`, `tipoDeDevedor`, `tipoValor`, `aliquota`, `baseParaApuracao`, `selecaoCredores`/`nomeCredor`/`tipoDocumentoFiscalCredor`/`numeroDocumentoFiscalCredor`, `apurarIRRF`. **Não existe "Ambos":** sucumbência recíproca vira dois registros.

**Custas** (`custas-judiciais.jsf`): `baseParaCustasCalculadas`, `tipoDeCustasDeConhecimentoDoReclamante/Reclamado` (NAO_SE_APLICA/CALCULADA_2_POR_CENTO/INFORMADA), `tipoDeCustasDeLiquidacao`, quantidades de atos (`qtdeAtosUrbanos`…), autos, armazenamento, RD e RT.

**Liquidar** (`liquidacao.jsf`, menu Operações): `dataDeLiquidacaoInputDate`, `indicesAcumulados` (o bot antigo procurava `acumularIndices`, que não existe: E08), `formulario:liquidar`, pendências em `formulario:j_id115:0/1`, `totalErros`, `totalAlertas`. Só alertas não impedem a liquidação.

**Exportar** (`exportacao.jsf`): `formulario:exportar` com `expect_download`. Validar que é um ZIP com `calculo.xml` e com `hashCodeLiquidacao`/`dataDeLiquidacao` preenchidos.

**Exportar PDF / Imprimir:** **não mapeado** ("Imprimir, Fechar, Excluir" ficaram fora do escopo, segundo o `00-INDEX`). Vamos precisar mapear do zero.

**Páginas raramente usadas** (Salário-família, Seguro-desemprego, Previdência Privada, Pensão, Multas e Indenizações): os IDs estão no [`09-paginas-completas.md`](https://github.com/bragabarreto/pjecalc-agente/blob/010fb4cdb762a9e4fd4b5dc067f387a54b626f77/docs/dom-mapping/09-paginas-completas.md).

---

## 3. Erros conhecidos e como resolveram (resumo)

Fontes: [`docs/erros-conhecidos-pje-calc.md`](https://github.com/bragabarreto/pjecalc-agente/blob/010fb4cdb762a9e4fd4b5dc067f387a54b626f77/docs/erros-conhecidos-pje-calc.md) (E01 a E13, todos marcados como resolvidos), [`docs/registro-erros-automacao.md`](https://github.com/bragabarreto/pjecalc-agente/blob/010fb4cdb762a9e4fd4b5dc067f387a54b626f77/docs/registro-erros-automacao.md) (sessão de 04/05/2026, sem marca de resolvido) e as seções "Regra obrigatória / Invariante" do `CLAUDE.md` (mais de 100 itens numerados #80-xx).

| Erro | Causa | Solução adotada |
|---|---|---|
| PJC com `hashCodeLiquidacao=null` | Exportou antes de liquidar | Bloqueia a entrega de PJC sem hash/data de liquidação; proíbe gerar PJC "na mão" |
| "Falta selecionar Histórico Salarial" | Selecionou `baseHistoricos` sem clicar "Adicionar Base" | Sempre clicar `incluirBaseHistorico` (idempotente) |
| Clique abre verba errada / renomeia a verba errada | `tr.textContent.includes` casava o `<tr>` de layout | Igualdade exata no `<td>` da mesma linha + guarda de `descricao` antes de editar |
| URL `verbas-para-calculo.jsf` "não existe" / base de URL dobrada | Captura de URL depois do Expresso | Normalizar a base para `/calculo/`; usar `verba-calculo.jsf` |
| Clicou Ocorrências em vez de Parâmetros | Ordem dos ícones | Usar `title="Parâmetros da Verba"` |
| Reflexo não acha a principal | Nome da sentença ≠ nome no PJe-Calc | Separar `nome_sentenca` × `nome_pjecalc` (+ `nome_pjecalc_unico`) |
| Liquidação bloqueia por período fora do cálculo | `dataTerminoCalculo` = rescisão em verbas pós-contrato | Ajusta para MAX(`periodo_fim`) |
| Save recusado: ocorrência ≠ MENSAL depois da demissão | LLM classificou estabilidade como "Desligamento" | Validador na prévia + força MENSAL |
| Alerta "Multiplicador alterado após gerar ocorrências" | Ordem de preenchimento | Preencher antes de gerar ocorrências, ou Regerar |
| HE com quantidade 0 | Grade de ocorrências não preenchida | Preencher `termoQuant`; **no Cidadão local continua como "limite arquitetural"**: o usuário corrige 1 campo à mão |
| Indenização INFORMADA sem valor | Grade zerada | Preencher `valorInformadoDoDevido` / lote "Devido"; em DESLIGAMENTO desmarcar as linhas exceto a última |
| Histórico sem valor para a Contribuição Social | Histórico não cobre todo o período | Cobrir o período inteiro do cálculo |
| Preso em `parametrizar-inss` (IR/Honorários/Custas em cascata) | O clique no menu não saiu da sub-página | Checar a URL/âncora da página de destino antes de preencher; falhar de forma explícita |
| Valor de select com rótulo em vez de enum | Extração devolveu o rótulo | Normalizador rótulo → value no schema |
| "Execution context destroyed" no Liquidar | `evaluate(click)` com navegação | Clique por locator + espera do resultado |
| Modal do Regerar ficava aberto | Tratado como diálogo nativo | Clicar o "Ok" do `rich:modalPanel` |
| Clique no menu "não pega" | Clique cai no documento antigo | Token na `window` + esperar a troca de documento |
| Apurar Cartão inerte / LockTimeout | onclick-exec inerte + espera curta | Clique nativo + poll na tabela por até 10 min |
| Ocorrências de férias divergem da aba Férias | Férias preenchidas depois das Verbas | Ordem do manual: Faltas e Férias antes de Histórico e Verbas |
| Reflexos com `ativo=false` no PJC | Estado do bean | "Bean ground truth" restaurado (#80-BY-3) |

Tentativas **descartadas** que também valem como aprendizado (seção "HORAS EXTRAS 50%" do `CLAUDE.md`): editar o `.PJC` depois de exportado (causou NPE na importação), alterar o XHTML do PJe-Calc (`a4j:keepAlive` gerou `StaleObjectStateException`; `f:setPropertyActionListener` derrubou tudo), aplicar patch de bytecode, usar URL direta em vez do menu. **Lição: não mexer no PJe-Calc nem no `.PJC`.**

---

## 4. Contrato JSON (schema) do cálculo

Coexistem **quatro** formatos, sinal de que o schema ainda está se acomodando:

1. **Contrato v1** ([`.claude/skills/pjecalc-transformacao/references/contrato-json.md`](https://github.com/bragabarreto/pjecalc-agente/blob/010fb4cdb762a9e4fd4b5dc067f387a54b626f77/.claude/skills/pjecalc-transformacao/references/contrato-json.md)): plano, no estilo "Calc Machine", com datas ISO. Legado.
2. **Schema v2, documentado** ([`docs/schema-v2/`](https://github.com/bragabarreto/pjecalc-agente/tree/010fb4cdb762a9e4fd4b5dc067f387a54b626f77/docs/schema-v2), mais [`99-pydantic-models.py`](https://github.com/bragabarreto/pjecalc-agente/blob/010fb4cdb762a9e4fd4b5dc067f387a54b626f77/docs/schema-v2/99-pydantic-models.py) com 83 KB): semântico, em `snake_case`. Raiz: `meta`, `processo`, `parametros_calculo`, `historico_salarial[]`, `verbas_principais[]` (com `estrategia_preenchimento`, `expresso_alvo`, `nome_sentenca`/`nome_pjecalc`, `parametros{…}`, `formula_calculado{base_calculo, divisor, multiplicador, quantidade}`, `ocorrencias_override`, `reflexos[]{estrategia_reflexa, parametros_override…}`), `cartao_de_ponto`, `faltas[]`, `ferias[]`, `fgts`, `contribuicao_social`, `imposto_de_renda`, `honorarios[]`, `custas_judiciais`, `correcao_juros_multa`, `liquidacao` e as páginas secundárias. Convenções: datas `DD/MM/AAAA`, competências `MM/AAAA`, enums iguais ao value do DOM, `null` para opcional e `[]` para lista vazia. Cada campo traz o DOM ID correspondente.
3. **Schema v3, "réplica perfeita"** ([`infrastructure/pjecalc_pages.py`](https://github.com/bragabarreto/pjecalc-agente/blob/010fb4cdb762a9e4fd4b5dc067f387a54b626f77/infrastructure/pjecalc_pages.py), Pydantic v2 com `extra="forbid"`), consumido pelo `core/aplicador.py`. Campos com o nome do ID do DOM: `PreviaCalculo{processo, historico_salarial, faltas, ferias, verbas[Verba{parametros, ocorrencias[OcorrenciaVerba{indice, ativo, termo_div, termo_mult, termo_quant, valor_devido, dobra}], reflexos[Verba], lancamento EXPRESSO|MANUAL, expresso_alvo}], cartao_de_ponto, fgts, contribuicao_social, imposto_renda, honorarios, custas, correcao_juros}`. Valores monetários são strings BR. **Inconsistências com o mapeamento:** o FGTS do v3 usa `aliquota "8"/"2"`, `multa_do_fgts "MULTA_DE_40"` e `tipo_de_verba NORMAL/VERBA_RESCISORIA`, enquanto o DOM tem `OITO_POR_CENTO`, `QUARENTA_POR_CENTO` e `PAGAR/DEPOSITAR` (o aplicador traduz com mapas). `tipo_de_verba` usa "REFLEXA" contra o value "REFLEXO" do DOM.
4. **"JSON v2" do Projeto Claude externo / extração in-app** (`PreviaCalculoV2`, via `normalize_v2_json` com dezenas de normalizadores), que é o que roda em produção com `modules/playwright_v2.py`.

**Serve como base para a nossa "ficha do cálculo"?** Em parte. Recomendo:

- **Aproveitar as ideias do v2:** um nó por tela na ordem do manual; `estrategia_preenchimento` (expresso direto/adaptado/manual) + `expresso_alvo`; separar `nome_sentenca` de `nome_pjecalc`; reflexos aninhados na principal com `estrategia_reflexa`; enums iguais aos values do DOM; o domínio de valores de [`dominios-values.json`](https://github.com/bragabarreto/pjecalc-agente/blob/010fb4cdb762a9e4fd4b5dc067f387a54b626f77/docs/dom-mapping/dominios-values.json); validações cruzadas (período da verba dentro do cálculo, ocorrência MENSAL depois da demissão, INFORMADA exige valor).
- **Não copiar o v3 como ficha:** ele espelha IDs do DOM e índices de linha de ocorrência. Isso é formato de *execução*, ruim para o advogado revisar e quebra se a 2.16 mudar um ID.
- **Proposta:** duas camadas. (a) A **ficha** em linguagem jurídica, que o advogado revisa (verbas, períodos, bases, parâmetros de sentença, cobertura da V1). (b) Um **plano de preenchimento** derivado de forma determinística (código, não LLM), em valores de DOM, mais um mapa de seletores versionado por versão do PJe-Calc (`2.16.0.json`). O schema do autor mistura as duas camadas, e o `CLAUDE.md` dele gasta a seção de abertura explicando essa confusão ("Prévia vs. Estratégia de Preenchimento").

---

## 5. Qualidade e confiabilidade

**O que parece testado de ponta a ponta:**
- [`docs/teste-end-to-end-2026-05-01.md`](https://github.com/bragabarreto/pjecalc-agente/blob/010fb4cdb762a9e4fd4b5dc067f387a54b626f77/docs/teste-end-to-end-2026-05-01.md): 3 cenários (rescisórias, HE + intervalo + cartão de ponto programado, históricos paralelos) rodaram **no Cidadão headless na Oracle Cloud** e geraram PJC liquidado, cerca de 10 min cada. Validou-se o ciclo Sentença → PJC → reimportação.
- O `CLAUDE.md` registra dezenas de casos reais corrigidos entre maio e outubro de 2026, cada um com um teste de regressão (`test_invNNN`). Isso mostra **uso real intenso**.
- [`tests/test_e2e_automacao_completa.py`](https://github.com/bragabarreto/pjecalc-agente/blob/010fb4cdb762a9e4fd4b5dc067f387a54b626f77/tests/test_e2e_automacao_completa.py): E2E opcional (`PJECALC_E2E=1`) contra **`pje.trt7.jus.br/pjecalc` (institucional) usando perfil Firefox ou cookies do Chrome autenticados**. Não é reproduzível e aponta para um sistema de produção do tribunal.

**O que parece frágil:**
- **Os "invariantes" são testes por grep** ([`tests/test_invariantes_indenizacao.py`](https://github.com/bragabarreto/pjecalc-agente/blob/010fb4cdb762a9e4fd4b5dc067f387a54b626f77/tests/test_invariantes_indenizacao.py), 343 KB): verificam se um comentário ou trecho de código existe, não o comportamento contra o PJe-Calc.
- **Tamanho e acoplamento:** a automação de produção tem cerca de 1,7 MB em dois módulos, com cascatas de estratégias A→B→C→D, "Fechar e Reabrir", dumps forenses de DOM e retries. O `core/aplicador.py` (v3, "puro 1:1") está **pela metade**: o cabeçalho marca ⏳ em metade das fases, há dumps de diagnóstico no meio do fluxo, a ordem das fases contradiz o manual, e o `liquidar_e_exportar` não confere pendências nem a mensagem de sucesso antes de exportar.
- **Documentação divergente:** a skill diz "Firefox obrigatório" e "Fase 11 Correção é stub"; o README fala em `playwright install chromium`; IDs de competência do histórico diferem entre docs; o registro de erros de 04/05 tem itens abertos que o catálogo E01–E13 dá como resolvidos.
- **Diferenças entre o Cidadão local (H2) e o institucional:** `linkParametrizar` não renderiza o formulário de Alteração no Cidadão local em headless, mas renderiza no TRT7. Por isso a HE com quantidade informada ficou "aceita com ajuste manual". O mapeamento foi feito sobretudo no institucional.
- **Navegador:** tudo foi validado em **Firefox**. O autor afirma que "Chromium causa incompatibilidades em eventos AJAX do RichFaces, calendários e popups". **Nossa direção usa o Edge (Chromium).** É risco P1 a validar logo no primeiro spike (o próprio mapeamento DOM foi feito via Chrome MCP, então o DOM é o mesmo; a dúvida é o comportamento dos eventos).
- **Ambiente modificado:** o PJe-Calc do autor roda com `context.xml` alterado (H2 em modo TCP), Java Agent/SecurityManager para suprimir diálogos Swing, Xvfb e xdotool. O comportamento observado pode não valer para o Cidadão instalado padrão no Windows do advogado.

---

## 6. Recomendação

### Reaproveitar (com atribuição MIT)

O MIT permite copiar e adaptar desde que se mantenha o aviso de copyright e a licença. Crie `THIRD_PARTY_NOTICES.md` com "pjecalc-agente © bragabarreto, MIT" e o texto da licença, e cite o arquivo de origem em cada trecho adaptado.

1. **Mapeamento DOM como ponto de partida**, a revalidar na 2.16.0: `docs/dom-mapping/00` a `09` + `ERRATA` (a errata prevalece), `dominios-values.json` e o catálogo `.json` (96 campos em Dados do Cálculo, 573 no formulário Manual). Use-os como *checklist* do nosso mapeamento, não como verdade.
2. **Lista das 54 verbas do Expresso** e a tática expresso direto/adaptado/manual.
3. **O catálogo de armadilhas da seção 2.2 e os erros da seção 3**, convertidos em regras do nosso servidor MCP: navegação pelo menu esperando a troca de documento, datas por digitação, igualdade exata de `<td>`, modal do Regerar, "Adicionar Base", sair das sub-páginas, liquidar → conferir → exportar, validação do `.PJC`.
4. **Ideias do schema v2** para a ficha (seção 4) e as validações cruzadas.
5. **A ideia do `scripts/cataloga_pjecalc.py`**: um script que cataloga os campos de cada página. Vale reescrever em Node para gerar o nosso mapa da 2.16.0 automaticamente. Ponto de partida: [`scripts/cataloga_pjecalc.py`](https://github.com/bragabarreto/pjecalc-agente/blob/010fb4cdb762a9e4fd4b5dc067f387a54b626f77/scripts/cataloga_pjecalc.py) (não lido em detalhe).

### Não reaproveitar

- **O código Python de automação** (`playwright_v2.py`, `playwright_pjecalc.py`, `aplicador.py`, `browser_manager.py`): outra linguagem, monolítico, cheio de correções específicas de casos e de ambiente (Linux, Xvfb, H2 em TCP). Escrever o nosso do zero, pequeno, em Node.
- **A distribuição `pjecalc-dist/`** (91 MB, binários do TRT8/CSJT com `context.xml` e `persistence.xml` alterados): o MIT do repositório **não cobre** software de terceiros; nós usamos o instalador oficial na máquina do advogado.
- **O webapp, o Learning Engine e o gerador nativo de `.PJC`**: fora do nosso modelo (o PJe-Calc é quem calcula; o próprio autor proíbe o gerador nativo).
- **Prompts de extração** (`docs/prompt-projeto-claude-externo.md`, 96 KB): úteis só como leitura. Nossa skill conversa e pergunta, não extrai tudo de uma vez.

### Riscos

| Risco | Nível | Observação |
|---|---|---|
| **Envio de sentenças a LLMs de terceiros** | P0 para nós se repetido | O app manda sentença e documentos à Anthropic e ao Gemini, e até screenshots do PJe-Calc ao Gemini em recuperação de falhas (`core/browser_manager.py::_ask_llm_for_recovery`). Dado S3. No nosso desenho a conversa ocorre no Claude Desktop do advogado, sob a conta e os termos do escritório. Não acrescentar Gemini nem outro LLM, e não enviar screenshots para fora. |
| **Deploy público sem autenticação** | Não repetir | O README publica um IP fixo e um HTTPS via `sslip.io`. O `webapp.py` não tem nenhuma autenticação e expõe `/api/screenshot`, `/api/logs/*`, `/api/ps`, `/api/diag/dump/*` e um **proxy reverso para o PJe-Calc**. Sentenças e cálculos de terceiros podem estar acessíveis. O nosso servidor MCP roda **só local** (stdio), sem porta exposta. |
| **Dados pessoais no repositório público** | Atenção | `CLAUDE.md`, docs e testes citam nomes de partes e números CNJ de casos reais ou "baseados em reais". **Não copiar esses trechos**; ao reaproveitar exemplos, anonimizar. Há também uma chave SSH pública versionada (`ssh-key-2026-03-31.key (1).pub`): sem impacto para nós, mas é sinal de higiene fraca. |
| **Testes contra o PJe-Calc institucional do tribunal** | Não repetir | O mapeamento e o E2E foram feitos em `pje.trt7.jus.br` com sessão autenticada. Nosso mapeamento e nossos testes rodam **só no Cidadão local** com dados fictícios. |
| **Versão 2.15.1 × 2.16.0** | P1 | Todo ID precisa ser revalidado. Ter um mapa de seletores por versão e um teste de fumaça que detecta a versão em `versao.html` e recusa versão não mapeada. |
| **Firefox × Edge** | P1 | Validar no spike: data por digitação, clique em `linkParametrizar`/`linkOcorrencias`, modal do Regerar, Apurar do cartão e download do Exportar no Edge. Se falhar, a alternativa é o Firefox. Atenção: o `playwright-core` não controla o Firefox comum, nem o que costuma vir no pacote do PJe-Calc. Precisa do build próprio do Playwright para Firefox, que aumenta o instalador. Avaliar antes de decidir. |
| **Limite conhecido da HE com quantidade informada no Cidadão local** | P2 | O autor aceitou ajuste manual. Para a V1, reproduzir no spike; se persistir, a ficha marca o campo para o advogado conferir. |
| **Licença** | Baixo | MIT: manter o aviso. Não redistribuir binários do PJe-Calc. |

### Próximo passo seguro

Spike local no Windows com o PJe-Calc Cidadão 2.16.0 oficial e dados fictícios: (1) criar um cálculo, preencher Dados do Cálculo e salvar pelo Edge; (2) lançar uma verba pelo Expresso + Parâmetros + Ocorrências; (3) liquidar e exportar o `.PJC`. Usar as armadilhas acima como checklist e registrar as divergências da 2.16.0 em `docs/pesquisa/mapeamento-2.16.0.md`.

---

### Arquivos lidos (todos em `B` + caminho)

`README.md`, `docs/dom-mapping/00-INDEX.md`, `01` a `09`, `06-ERRATA-FASE1.md`, `dominios-values.json`, `docs/pjecalc-fields-catalog.md` (+ amostra do `.json`), `docs/erros-conhecidos-pje-calc.md`, `docs/registro-erros-automacao.md`, `docs/decisions.md`, `docs/teste-end-to-end-2026-05-01.md`, `.claude/skills/pjecalc-automacao/SKILL.md`, `references/dom-ids.md`, `references/fases-playwright.md`, `.claude/skills/pjecalc-transformacao/references/contrato-json.md`, `docs/schema-v2/00`, `02`, `04`, `11` e o outline de `99-pydantic-models.py`, `infrastructure/pjecalc_pages.py` (outline), `core/aplicador.py` (estrutura + helpers + orquestrador), `core/browser_manager.py` (estrutura), `tests/test_e2e_automacao_completa.py` (cabeçalho), `webapp.py` (grep de autenticação e rotas), `CLAUDE.md` (amostragem: arquitetura, invariantes, descobertas, ordem das fases), histórico de commits de `pjecalc-dist/…/versao.html`.
