# Mapeamento do PJe-Calc Cidadão 2.16.0

Feito em 10/10/2026 no PJe-Calc 2.16.0 oficial (instalador do TRT8, MD5 conferido), rodando no Mac com
Java Temurin 1.8.0_504 (x64, Rosetta) e controlado pelo Edge via `playwright-core`. Só dados fictícios.
Os JSON de cada tela estão em `mapa-2.16.0/` (gerados por `ferramentas/mapear*.mjs`).

## Ambiente

- Pacote: autoextraível WinRAR com `pjecalc-windows64-2.16.0/` (Tomcat 7.0.67, Java 8u241 embutido,
  Firefox Portable 55 em `navegador/windows`, banco H2 em `.dados/pjecalc.h2.db`).
- Sobe em ~10 s em `http://localhost:9257/pjecalc`, usuário "offline", perfil CALCULISTA.
- Interface: JSF 1.2 + Seam + RichFaces 3.3.3 + jQuery 1.3.2 + Prototype. Máscaras: jquery.maskedinput 1.3.1,
  maskMoney, maskfinancial.

## Regras para o robô (verificadas)

1. **Esperar a janela "Processando..."** (`formulario:msgAguardeCDiv`) sumir depois de cada ação que dispara
   AJAX. Ela cobre a tela e engole cliques; esperar só a rede não basta.
2. **Datas**: focar o campo, esperar ~400 ms (a máscara se instala no foco com atraso), digitar só os dígitos,
   `Tab`. Digitar antes embaralha ("01032021" vira "10/32/0210"). **Não usar `Escape`**: a máscara volta ao valor
   anterior.
3. **Menu**: IDs gerados (`formulario:j_id38:…`) — navegar pelo texto do item. Os itens do cálculo só aparecem
   depois de salvar Dados do Cálculo. Liquidar, Imprimir e Exportar ficam no grupo recolhido **Operações**: abrir
   o grupo antes.
4. **Tela inicial**: os botões são imagens; achar pelo nome acessível ("Criar Novo Cálculo").
5. **Município** depende do Estado (AJAX): selecionar o estado, esperar, depois o município.
6. **Edge funcionou** em tudo o que foi feito até aqui (preencher, salvar, navegar). O alerta da comunidade sobre
   Chromium ainda precisa ser checado em Verbas (parâmetros, ocorrências, reflexos) e Liquidar.

## Padrões que o PJe-Calc já traz (cálculo novo)

- Correção: índice trabalhista **IPCA-E**; juros **TRD Juros Simples**, combinado com **"Sem Juros" a partir do
  ajuizamento**. Revisar contra ADC 58/59 e Lei 14.905/2024 na ficha.
- Prazo de aviso prévio "Calculado", projetar aviso indenizado marcado, feriados estaduais e municipais marcados,
  sábado como dia útil marcado, pontos facultativos nacionais (Carnaval, Corpus Christi, Sexta-feira Santa).

## Telas

| Tela | Página | Campos | Ações |
|---|---|---|---|
| Dados do Cálculo | `calculo/calculo.jsf` | 39 | Adicionar Advogado, Adicionar Advogado, Salvar, Fechar |
| Faltas | `calculo/falta.jsf` | 7 | Salvar Nova Falta, Confirmar |
| Férias | `calculo/ferias.jsf` | 48 | Confirmar, Regerar Férias, Salvar |
| Histórico Salarial | `calculo/historico-salarial.jsf` | 2 | Novo, Grade de Ocorrências |
| historico-salarial--novo | `calculo/historico-salarial.jsf` | 14 | Confirmar, Gerar Ocorrências, Salvar, Cancelar |
| Verbas | `calculo/verba/verba-calculo.jsf` | 5 | Manual, Expresso, Regerar |
| verbas--expresso | `calculo/verba/verbas-para-calculo.jsf` | 55 | Salvar, Cancelar |
| verbas--manual-novo | `calculo/verba/verba-calculo.jsf` | 58 | Selecionar Assunto CNJ, Adicionar Base, Salvar, Cancelar |
| Cartão de Ponto | `cartaodeponto/apuracao-cartaodeponto.jsf` | 3 | Novo, Grade de Ocorrências, Visualizar Cartão |
| Salário-família | `calculo/salario-familia.jsf` | 15 | Adicionar Variação na Quantidade de Filhos, Adicionar Histórico Salarial, Adicionar Salário Devido, Salvar |
| Seguro-desemprego | `calculo/seguro-desemprego.jsf` | 15 | Adicionar Histórico Salarial, Adicionar Salário Devido, Salvar |
| FGTS | `calculo/fgts.jsf` | 24 | Adicionar, Salvar, Ocorrências |
| Contribuição Social | `calculo/inss/inss.jsf` | 19 | Salvar, Ocorrências |
| Previdência Privada | `calculo/previdencia-privada.jsf` | 5 | Adicionar Nova Alíquota, Salvar |
| Pensão Alimentícia | `calculo/pensao-alimenticia.jsf` | 4 | Salvar |
| Imposto de Renda | `calculo/irpf.jsf` | 14 | Salvar |
| Multas e Indenizações | `calculo/multas-indenizacoes.jsf` | 1 | Novo |
| Honorários | `calculo/honorarios.jsf` | 1 | Novo |
| Custas Judiciais | `calculo/custas-judiciais.jsf` | 27 | Adicionar, Adicionar, Salvar |
| Correção, Juros e Multa | `calculo/parametros-atualizacao/parametros-atualizacao.jsf` | 9 | Adicionar, Excluir, Salvar |
| Liquidar | `calculo/liquidacao.jsf` | 5 | Liquidar |
| Imprimir | `calculo/relatorio/relatorio-calculo.jsf` | 24 | Imprimir |
| Exportar | `calculo/exportacao.jsf` | 2 | Exportar |

## Lançamento Expresso

53 verbas na 2.16.0 (a 2.15.1 mapeada pelo `pjecalc-agente` tinha 54). Lista em
`mapa-2.16.0/verbas--expresso-lista.json`.

## Falta mapear

- Parâmetros, ocorrências e reflexos de uma verba (depois de incluída).
- Faltas e Férias com lançamentos; Histórico Salarial com competências.
- Liquidar de fato, mensagens de sucesso/erro, Exportar `.PJC` e Imprimir PDF.
- Segunda aba de Custas e de Correção (só a aba aberta foi lida).
