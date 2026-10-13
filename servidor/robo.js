// Robô do PJe-Calc Cidadão: opera a tela oficial (localhost:9257) pelo Edge, como uma pessoa faria.
// Quem calcula, liquida e gera o PDF e o .PJC é sempre o PJe-Calc oficial; aqui só se digita e clica.
// Regras da interface, verificadas na 2.16.0: docs/pesquisa/mapeamento-2.16.0.md.
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

export const BASE = process.env.PJECALC_URL || "http://localhost:9257/pjecalc";
export const VERSOES = ["2.16.0"];

// Página que cada item do menu abre; serve para confirmar que a navegação chegou onde devia.
const PAGINA = {
  "Dados do Cálculo": "/calculo/calculo.jsf", "Histórico Salarial": "/historico-salarial.jsf", Verbas: "/verba-calculo.jsf",
  FGTS: "/fgts.jsf", Honorários: "/honorarios.jsf", "Correção, Juros e Multa": "/parametros-atualizacao.jsf",
  Liquidar: "/liquidacao.jsf", Imprimir: "/relatorio-calculo.jsf", Exportar: "/exportacao.jsf",
};

const id = (campo) => `[id='formulario:${campo}']`;
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const digitos = (s) => s.replace(/\D/g, "");
export const brl = (n) => {
  const [i, d] = Math.abs(n).toFixed(2).split(".");
  return (n < 0 ? "-" : "") + i.replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "," + d;
};
const mes = (s) => { const [m, a] = s.split("/").map(Number); return a * 12 + m - 1; };

export async function verificar() {
  let html;
  try {
    html = await (await fetch(BASE + "/versao.html", { signal: AbortSignal.timeout(5000) })).text();
  } catch {
    return { pronto: false, motivo: "O PJe-Calc não está aberto neste computador (nada responde em localhost:9257). Abra o PJe-Calc pelo ícone, espere a tela inicial carregar e tente de novo." };
  }
  const versao = html.match(/Versao:\s*([\d.]+)/i)?.[1] ?? "desconhecida";
  if (!VERSOES.includes(versao))
    return { pronto: false, versao, motivo: `O PJe-Calc instalado é a versão ${versao}; o robô foi testado na ${VERSOES.join(", ")}. Atualize a extensão ou o PJe-Calc.` };
  return { pronto: true, versao };
}

export async function abrirNavegador({ visivel = false } = {}) {
  let navegador;
  // Linux: Chromium do próprio Playwright, sem Edge nem Chrome instalados.
  if (process.env.PJECALC_NAVEGADOR === "chromium") navegador = await chromium.launch({ headless: !visivel });
  else for (const channel of [process.env.PJECALC_NAVEGADOR || "msedge", "chrome"]) {
    try { navegador = await chromium.launch({ channel, headless: !visivel }); break; } catch (e) { if (channel === "chrome") throw new Error("Não achei o Microsoft Edge nem o Google Chrome neste computador. " + e.message.split("\n")[0]); }
  }
  const contexto = await navegador.newContext({ acceptDownloads: true, viewport: { width: 1400, height: 1000 } });
  // conta os AJAX em andamento: disparar outro antes de o anterior voltar derruba o PJe-Calc ("row is unavailable")
  await contexto.addInitScript(() => {
    window.__ajax = 0;
    const send = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function (...a) {
      window.__ajax++;
      this.addEventListener("loadend", () => { window.__ajax--; });
      return send.apply(this, a);
    };
    // Campos como a data de demissão disparam dois AJAX no mesmo Tab (onchange + onblur). Com o servidor lento, o segundo
    // não consegue a trava do Seam (LockTimeoutException). Fila única do RichFaces, só durante o Tab de digitar():
    // ligada sempre, ela travou o "Processando..." na lista de verbas.
    const fila = setInterval(() => {
      const ajax = window.A4J?.AJAX;
      if (!ajax?.Submit || ajax.Submit.__fila) return;
      const submit = ajax.Submit;
      ajax.Submit = function (form, evento, opcoes = {}) { return submit.call(this, form, evento, window.__fila ? { ...opcoes, eventsQueue: opcoes.eventsQueue || "robo" } : opcoes); };
      ajax.Submit.__fila = true;
      clearInterval(fila);
    }, 20);
  });
  const p = await contexto.newPage();
  p.setDefaultTimeout(60000);
  p.on("dialog", (d) => d.accept()); // confirmações do PJe-Calc ("Confirma operação?")
  return { navegador, p };
}

// A janela "Processando..." cobre a tela durante cada AJAX e engole cliques: esperar ela sumir.
export async function esperar(p, timeout = 120000) {
  await p.waitForTimeout(150);
  await p.waitForFunction(() => {
    const d = document.getElementById("formulario:msgAguardeCDiv");
    return !window.__ajax && (!d || getComputedStyle(d).display === "none" || d.offsetParent === null);
  }, null, { timeout });
  // ponytail: sem waitForLoadState("networkidle"): no Histórico Salarial uma conexão fica aberta e cada espera custava 60 s.
  // O contador __ajax cobre o que importa (os AJAX do formulário).
}

// textContent, não innerText: a caixa de mensagem é animada (toggle) e pode estar oculta quando lemos.
// Não apagar a caixa: o AJAX atualiza os elementos dela pelo id e, apagados, a resposta some.
// Em vez disso, marca o que já estava na tela e lê só o que chegou depois.
const mensagens = (p) => p.evaluate(() => [...new Set([...document.querySelectorAll(".rich-messages")]
  .filter((e) => !e.hasAttribute("data-velho") || e.querySelector(":not([data-velho])"))
  .map((e) => e.textContent.replace(/\s+/g, " ").trim()).filter(Boolean))]);
const limparMensagens = (p) => p.evaluate(() => document.querySelectorAll(".rich-messages, .rich-messages *").forEach((e) => e.setAttribute("data-velho", "")));

async function clicar(p, sel) { await esperar(p); await (typeof sel === "string" ? p.locator(sel) : sel).click(); await esperar(p); }

async function salvar(p, etapa, botao = "salvar") {
  await limparMensagens(p);
  await clicar(p, id(botao));
  // Algumas telas (verba com valor alterado) abrem uma caixa "Confirma operação?" desenhada na página, não um dialog do navegador.
  const ok = p.locator("input[type=button][value='Ok'], input[type=submit][value='Ok'], button:text-is('Ok')").filter({ visible: true }).first();
  if (await ok.waitFor({ state: "visible", timeout: 3000 }).then(() => true, () => false)) await clicar(p, ok);
  // listas longas (histórico) salvam depois que o "Processando" some: esperar a mensagem chegar, até 60 s
  await p.waitForFunction(() => [...document.querySelectorAll(".rich-messages:not([data-velho]), .rich-messages :not([data-velho]), .rich-message")]
    .some((e) => e.textContent.trim()), null, { timeout: 60000 }).catch(() => {});
  const m = await mensagens(p);
  const erro = m.find((x) => /^Erro/i.test(x));
  if (erro || !m.some((x) => /Sucesso/i.test(x))) {
    // mensagens de validação ao lado dos campos (rich-message) explicam recusas silenciosas
    const campos = (await p.locator(".rich-message").allTextContents()).map((t) => t.trim()).filter(Boolean);
    throw new Error(`${etapa}: o PJe-Calc não confirmou o salvamento. ${[erro, ...m, ...campos].filter(Boolean).join(" | ") || "(nenhuma mensagem na tela)"}`);
  }
}

// Campos com máscara (datas, competências, CPF): focar, esperar a máscara se instalar, digitar só os dígitos, Tab.
// Digitar antes da máscara embaralha ("01032021" vira "10/32/0210"); Escape desfaz o valor.
async function digitar(p, campo, texto) {
  const l = p.locator(id(campo));
  await esperar(p);
  await l.focus();
  await p.waitForTimeout(400);
  await l.press("ControlOrMeta+a");
  await l.press("Delete");
  await p.keyboard.type(digitos(texto), { delay: 40 });
  await p.evaluate(() => { window.__fila = 1; });
  await p.keyboard.press("Tab");
  await esperar(p);
  await p.evaluate(() => { window.__fila = 0; });
  const valor = await l.inputValue();
  if (digitos(valor) !== digitos(texto)) throw new Error(`O campo ${campo} ficou "${valor}" em vez de "${texto}".`);
}

// Sair do campo e esperar: o AJAX de "perdeu o foco" não pode coincidir com o próximo clique (a fila do PJe-Calc descarta um deles).
async function escrever(p, campo, texto) {
  await esperar(p);
  const l = p.locator(id(campo));
  await l.fill(String(texto));
  await l.blur();
  await esperar(p);
  // Campos de dinheiro têm máscara: "220" virou 2,20 e multiplicou as horas extras por 100. Conferir o que ficou.
  if (/^-?[\d.,]+$/.test(String(texto))) {
    const ficou = await l.inputValue();
    if (digitos(ficou).replace(/^0+/, "") !== digitos(String(texto)).replace(/^0+/, ""))
      throw new Error(`O campo ${campo} ficou "${ficou}" em vez de "${texto}"; parei para não calcular errado.`);
  }
}

async function radio(p, campo, valor) {
  const l = p.locator(`input[type=radio][name='formulario:${campo}'][value='${valor}']`);
  if (!(await l.isChecked())) { await l.click(); await esperar(p); }
}

async function caixa(p, campo, ligado) {
  const l = p.locator(id(campo));
  if ((await l.isChecked()) !== ligado) { await l.click(); await esperar(p); }
}

async function escolherPorTexto(p, campo, texto) {
  const alvo = texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim();
  // listas dependentes (município depois do estado) chegam por AJAX: tentar por até 15 s
  let valor;
  for (let t = 0; t < 30 && valor === undefined; t++) {
    if (t) await p.waitForTimeout(500);
    valor = await p.locator(`${id(campo)} option`).evaluateAll((os, a) =>
      os.find((o) => o.text.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim() === a)?.value, alvo);
  }
  if (valor === undefined) throw new Error(`Opção "${texto}" não existe em ${campo}.`);
  await p.selectOption(id(campo), valor);
  await esperar(p);
}

// Menu lateral: os IDs mudam (j_id38...), então navega pelo texto e espera o documento novo carregar.
export async function irPara(p, item) {
  await esperar(p);
  const link = p.locator("a[id*='j_id38']").filter({ hasText: new RegExp(`^\\s*${esc(item)}\\s*$`) }).first();
  await p.evaluate(() => { window.__robo = 1; });
  await link.evaluate((a) => a.click());
  await p.waitForFunction(() => !window.__robo, null, { timeout: 120000 });
  await esperar(p);
  if (!p.url().includes(PAGINA[item])) throw new Error(`Não consegui abrir a tela "${item}" (o PJe-Calc está em ${new URL(p.url()).pathname}).`);
}

export async function abrirCalculo(p, numero) {
  await p.goto(BASE + "/pages/principal.jsf");
  await esperar(p);
  const opcao = p.locator(`select[ondblclick] option[value='${numero}']`);
  if (!(await opcao.count())) throw new Error(`O cálculo ${numero} não aparece em "Cálculos Recentes" do PJe-Calc. Abra-o uma vez pelo "Buscar Cálculo" e tente de novo.`);
  await p.locator("select[ondblclick]").selectOption(String(numero));
  await p.evaluate(() => { window.__robo = 1; });
  await opcao.dispatchEvent("dblclick");
  await p.waitForFunction(() => !window.__robo, null, { timeout: 120000 });
  await esperar(p);
  const aberto = await p.inputValue(id("idCalculo"));
  if (aberto !== String(numero)) throw new Error(`Pedi o cálculo ${numero}, mas o PJe-Calc abriu o ${aberto}.`);
}

// ---------- Preenchimento ----------

export async function preencher(p, ficha, log) {
  await p.goto(BASE + "/pages/principal.jsf");
  await esperar(p);
  await p.getByRole("link", { name: "Criar Novo Cálculo" }).click();
  await p.waitForURL(/calculo\.jsf/);
  await esperar(p);
  await dadosDoProcesso(p, ficha.processo);
  await parametros(p, ficha.contrato);
  await salvar(p, "Dados do Cálculo");
  const numero = await p.inputValue(id("idCalculo"));
  log(`Cálculo nº ${numero} criado no PJe-Calc (dados do processo e parâmetros).`);
  await historico(p, ficha, log);
  await verbas(p, ficha, log);
  await fgts(p, ficha.fgts, log);
  for (const h of ficha.honorarios) await honorario(p, h, log);
  if (ficha.correcao) await correcao(p, ficha.correcao, log);
  return numero;
}

async function dadosDoProcesso(p, proc) {
  if (proc.numero) {
    const [, n, d, a, , t, v] = proc.numero.match(/^(\d{7})-(\d{2})\.(\d{4})\.(\d)\.(\d{2})\.(\d{4})$/);
    for (const [campo, valor] of [["numero", n], ["digito", d], ["ano", a], ["regiao", t], ["vara", v]]) await escrever(p, campo, valor);
  }
  if (proc.valor_causa !== undefined) await escrever(p, "valorDaCausa", brl(proc.valor_causa));
  await escrever(p, "reclamanteNome", proc.reclamante.nome);
  if (proc.reclamante.cpf) { await radio(p, "documentoFiscalReclamante", "CPF"); await digitar(p, "reclamanteNumeroDocumentoFiscal", proc.reclamante.cpf); }
  if (proc.reclamante.pis) { await radio(p, "reclamanteTipoDocumentoPrevidenciario", "PIS"); await digitar(p, "reclamanteNumeroDocumentoPrevidenciario", proc.reclamante.pis); }
  await escrever(p, "reclamadoNome", proc.reclamada.nome);
  const doc = proc.reclamada.cnpj ? ["CNPJ", proc.reclamada.cnpj] : proc.reclamada.cpf ? ["CPF", proc.reclamada.cpf] : null;
  if (doc) { await radio(p, "tipoDocumentoFiscalReclamado", doc[0]); await digitar(p, "reclamadoNumeroDocumentoFiscal", doc[1]); }
}

async function parametros(p, c) {
  await p.getByText("Parâmetros do Cálculo", { exact: true }).click();
  await esperar(p);
  await escolherPorTexto(p, "estado", c.estado); // município chega por AJAX depois do estado
  await escolherPorTexto(p, "municipio", c.municipio);
  await digitar(p, "dataAdmissaoInputDate", c.admissao);
  if (c.demissao) await digitar(p, "dataDemissaoInputDate", c.demissao);
  await digitar(p, "dataAjuizamentoInputDate", c.ajuizamento);
  if (c.inicio_calculo) await digitar(p, "dataInicioCalculoInputDate", c.inicio_calculo);
  if (c.fim_calculo) await digitar(p, "dataTerminoCalculoInputDate", c.fim_calculo);
  await caixa(p, "prescricaoQuinquenal", c.prescricao_quinquenal);
  await escolherPorTexto(p, "tipoDaBaseTabelada", { INTEGRAL: "Tempo Integral", PARCIAL: "Tempo Parcial", INTERMITENTE: "Trabalho Intermitente" }[c.regime]);
  await escrever(p, "valorMaiorRemuneracao", brl(c.maior_remuneracao));
  if (c.ultima_remuneracao !== undefined) await escrever(p, "valorUltimaRemuneracao", brl(c.ultima_remuneracao));
  await escolherPorTexto(p, "apuracaoPrazoDoAvisoPrevio", { CALCULADO: "Calculado", NAO_APURAR: "Não apurar" }[c.aviso_previo]);
  if (c.aviso_previo === "CALCULADO") await caixa(p, "projetaAvisoIndenizado", c.projetar_aviso_indenizado);
  await escrever(p, "valorCargaHorariaPadrao", brl(c.carga_horaria_mensal)); // "220,00": "220" a máscara lê como 2,20
}

// Um histórico "SALÁRIO" cobrindo o contrato; a evolução salarial vai nas ocorrências mensais dele.
export async function historico(p, f, log) {
  const faixas = [...f.salarios].sort((a, b) => mes(a.de) - mes(b.de));
  await irPara(p, "Histórico Salarial");
  await clicar(p, id("incluir"));
  await escrever(p, "nome", "SALÁRIO");
  await caixa(p, "fgts", f.fgts_sobre_salarios);
  await digitar(p, "competenciaInicialInputDate", faixas[0].de);
  await digitar(p, "competenciaFinalInputDate", faixas.at(-1).ate);
  await radio(p, "tipoValor", "INFORMADO");
  await escrever(p, "valorParaBaseDeCalculo", brl(faixas[0].valor));
  await clicar(p, id("cmdGerarOcorrencias"));
  const linhas = await p.locator("[id^='formulario:listagemMC:'][id$=':valor']").evaluateAll((es) =>
    es.map((e) => ({ id: e.id, comp: [...e.closest("tr").children].map((td) => td.textContent.trim()).find((t) => /^\d{2}\/\d{4}$/.test(t)) })));
  if (!linhas.length) throw new Error("Histórico Salarial: o PJe-Calc não gerou as ocorrências mensais.");
  let alteradas = 0;
  for (const l of linhas) {
    const faixa = faixas.find((s) => mes(s.de) <= mes(l.comp) && mes(l.comp) <= mes(s.ate));
    if (!faixa) throw new Error(`Histórico Salarial: competência ${l.comp} fora das faixas salariais da ficha.`);
    // cada valor alterado dispara um AJAX ao perder o foco; se o último só disparar no clique em Salvar,
    // a fila do PJe-Calc descarta o Salvar. Por isso: sair do campo e esperar, um por um.
    if (faixa !== faixas[0]) { const c = p.locator(`[id='${l.id}']`); await c.fill(brl(faixa.valor)); await c.blur(); await esperar(p); alteradas++; }
  }
  await salvar(p, "Histórico Salarial");
  log(`Histórico salarial "SALÁRIO" com ${linhas.length} competências (${faixas.length} faixa(s) de salário; ${alteradas} meses ajustados).`);
}

async function verbas(p, f, log) {
  await irPara(p, "Verbas");
  await clicar(p, id("lancamentoExpresso"));
  await p.locator("td input[type=checkbox]").first().waitFor({ timeout: 60000 }); // a lista do Expresso pode chegar depois
  for (const v of f.verbas) {
    const cb = p.locator("td").filter({ hasText: new RegExp(`^\\s*${esc(v.nome)}\\s*$`) }).locator("input[type=checkbox]").first();
    if (!(await cb.count())) throw new Error(`A verba "${v.nome}" não existe no Lançamento Expresso desta versão do PJe-Calc.`);
    await cb.check();
  }
  await salvar(p, "Lançamento Expresso");
  log(`Lançamento Expresso: ${f.verbas.map((v) => v.nome).join(", ")}.`);
  for (const v of f.verbas) await parametrizarVerba(p, v, log);
  for (const v of f.verbas) if (v.reflexos) await reflexos(p, v, log);
  await regerar(p, log);
}

// As ocorrências de cada verba nascem no Lançamento Expresso; parâmetros mudados depois (valor informado,
// quantidade, ocorrência de pagamento) só valem após "Regerar". Sem isso a liquidação acusa erro.
export async function regerar(p, log) {
  if (!p.url().includes(PAGINA.Verbas)) await irPara(p, "Verbas");
  await salvar(p, "Regerar ocorrências das verbas", "regerarOcorrencias");
  log("Ocorrências das verbas regeradas com os parâmetros da ficha.");
}

// Abre "Parâmetros da Verba" da linha cujo nome é exatamente o da verba (nunca por "contém": já trocou verbas em outro robô).
export async function abrirParametros(p, nome) {
  const link = await p.evaluate((n) => {
    for (const td of document.querySelectorAll("[id='formulario:listagem'] td")) {
      if (td.textContent.trim() !== n) continue;
      const a = td.closest("tr").querySelector("a[title='Parâmetros da Verba']");
      if (a) return a.id;
    }
  }, nome);
  if (!link) throw new Error(`Verba "${nome}" não encontrada na lista de verbas do cálculo.`);
  await clicar(p, `[id='${link}']`);
  const descricao = await p.inputValue(id("descricao"));
  if (descricao.trim() !== nome) throw new Error(`Abri os parâmetros de "${descricao}" em vez de "${nome}"; parei para não alterar a verba errada.`);
}

async function parametrizarVerba(p, v, log) {
  await abrirParametros(p, v.nome);
  const feito = [];
  if (v.de) { await digitar(p, "periodoInicialInputDate", v.de); feito.push(`de ${v.de}`); }
  if (v.ate) { await digitar(p, "periodoFinalInputDate", v.ate); feito.push(`até ${v.ate}`); }
  if (v.valor !== undefined) {
    await radio(p, "valor", "INFORMADO");
    // Valor fixado na decisão é pago uma vez: o padrão do PJe-Calc (Mensal + Proporcionalizar) repetiria o valor a cada mês do período.
    await radio(p, "ocorrenciaPagto", "DESLIGAMENTO");
    await caixa(p, "aplicarProporcionalidadeAoValorDevido", false);
    await escrever(p, "valorInformadoDoDevido", brl(v.valor));
    feito.push(`valor informado R$ ${brl(v.valor)}, pago uma vez (Desligamento), sem proporcionalizar`);
  } else {
    if ((await p.inputValue(id("tipoDaBaseTabelada"))) === "HISTORICO_SALARIAL") {
      const temBase = await p.evaluate(() => [...document.querySelectorAll("[id='formulario:listagemHistoricosDaVerba'] tbody tr")]
        .some((tr) => tr.textContent.trim()));
      if (!temBase) {
        await escolherPorTexto(p, "baseHistoricos", "SALÁRIO");
        await clicar(p, id("incluirBaseHistorico"));
        feito.push('base "SALÁRIO"');
      }
    }
    if (v.horas_por_mes) {
      await radio(p, "tipoDaQuantidade", "INFORMADA");
      await escrever(p, "valorInformadoDaQuantidade", brl(v.horas_por_mes));
      feito.push(`${brl(v.horas_por_mes)} h/mês`);
    }
  }
  await salvar(p, `Parâmetros da verba ${v.nome}`);
  log(`Verba ${v.nome}: ${feito.length ? feito.join(", ") : "parâmetros padrão do PJe-Calc"}.`);
}

const prefixo = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim();

// Reflexos ficam num painel por verba ("Exibir"); cada caixa salva sozinha por AJAX.
async function reflexos(p, v, log) {
  const lista = () => p.evaluate((n) => {
    for (const td of document.querySelectorAll("[id='formulario:listagem'] td")) {
      if (td.textContent.trim() !== n) continue;
      const linha = td.closest("tr");
      const a = linha.querySelector("a[title='Parâmetros da Verba']");
      if (!a) continue;
      const i = a.id.split(":")[2];
      return [...document.querySelectorAll(`[id^='formulario:listagem:${i}:listaReflexo:'][id$=':ativo']`)]
        .map((c) => ({ i, id: c.id, nome: c.closest("tr").textContent.trim().replace(/\s+/g, " "), marcado: c.checked }));
    }
    return [];
  }, v.nome);
  const disponiveis = await lista();
  if (!disponiveis.length) { log(`Verba ${v.nome}: o PJe-Calc não oferece reflexos para ela.`); return; }
  const quer = v.reflexos.map(prefixo);
  for (const r of disponiveis) {
    const deve = quer.some((q) => prefixo(r.nome).startsWith(q));
    if (deve === r.marcado) continue;
    const caixaReflexo = p.locator(`[id='${r.id}']`);
    // o clique só vale com o painel aberto ("Exibir" da linha da verba)
    if (!(await caixaReflexo.isVisible())) { await p.locator(`[id='formulario:listagem:${r.i}:divDestinacoes'] .linkDestinacoes`).click(); await p.waitForTimeout(600); }
    await caixaReflexo.click();
    await esperar(p);
  }
  const depois = await lista();
  const marcados = depois.filter((r) => r.marcado).map((r) => r.nome);
  const naoAchados = quer.filter((q) => !depois.some((r) => prefixo(r.nome).startsWith(q)));
  log(`Reflexos de ${v.nome}: ${marcados.join("; ") || "nenhum"}${naoAchados.length ? `. Não encontrei reflexo começando por: ${naoAchados.join(", ")}` : ""}.`);
}

async function fgts(p, fg, log) {
  await irPara(p, "FGTS");
  await radio(p, "tipoDeVerba", fg.destino);
  await caixa(p, "multa", fg.multa_40);
  if (fg.multa_40) await radio(p, "multaDoFgts", "QUARENTA_POR_CENTO");
  await caixa(p, "multaDoArtigo467", fg.multa_467);
  await salvar(p, "FGTS");
  log(`FGTS: ${fg.destino === "PAGAR" ? "pagar ao reclamante" : "depositar na conta vinculada"}${fg.multa_40 ? ", multa de 40%" : ""}${fg.multa_467 ? ", multa do art. 467" : ""}.`);
}

async function honorario(p, h, log) {
  await irPara(p, "Honorários");
  await clicar(p, id("incluir"));
  await escolherPorTexto(p, "tpHonorario", "Honorários Advocatícios");
  await radio(p, "tipoDeDevedor", h.devedor);
  await radio(p, "tipoValor", "CALCULADO");
  await escrever(p, "aliquota", brl(h.percentual));
  await escolherPorTexto(p, "baseParaApuracao", "Bruto");
  if (h.credor) await escrever(p, "nomeCredor", h.credor);
  await salvar(p, "Honorários");
  log(`Honorários advocatícios: ${brl(h.percentual)}% sobre o bruto, devidos pelo ${h.devedor.toLowerCase()}${h.credor ? ` a ${h.credor}` : ""}.`);
}

async function correcao(p, c, log) {
  await irPara(p, "Correção, Juros e Multa");
  // apaga as combinações que o PJe-Calc traz prontas e monta as da ficha
  for (let i = 0; i < 20; i++) {
    const excluir = p.locator("a[id$='excluirDep'], a[id*='excluirIndice'], a[id*='excluirJuros']").filter({ visible: true }).first();
    if (!(await excluir.count())) break;
    await clicar(p, `[id='${await excluir.getAttribute("id")}']`);
  }
  await p.selectOption(id("indiceTrabalhista"), c.indices[0].indice);
  await esperar(p);
  await caixa(p, "combinarOutroIndice", c.indices.length > 1);
  for (const x of c.indices.slice(1)) {
    await p.selectOption(id("outroIndiceTrabalhista"), x.indice);
    await esperar(p);
    await digitar(p, "apartirDeOutroIndiceInputDate", x.a_partir_de);
    await clicar(p, id("addOutroIndice"));
  }
  await caixa(p, "aplicarJurosFasePreJudicial", c.juros_fase_pre_judicial);
  await p.selectOption(id("juros"), c.juros[0].tabela);
  await esperar(p);
  await caixa(p, "combinarOutroJuros", c.juros.length > 1);
  for (const x of c.juros.slice(1)) {
    await p.selectOption(id("outroJuros"), x.tabela);
    await esperar(p);
    await digitar(p, "apartirDeOutroJurosInputDate", x.a_partir_de);
    await clicar(p, id("addOutroJuros"));
  }
  await salvar(p, "Correção, Juros e Multa");
  const fmt = (xs, k) => xs.map((x, i) => (i ? `${x[k]} a partir de ${x.a_partir_de}` : x[k])).join(" → ");
  log(`Correção: ${fmt(c.indices, "indice")}. Juros: ${fmt(c.juros, "tabela")}${c.juros_fase_pre_judicial ? " (com juros na fase pré-judicial)" : ""}.`);
}

// ---------- Liquidação e documentos oficiais ----------

const pendencias = (p) => p.evaluate(() => [...document.querySelectorAll(".validacaoErro, .validacaoAlerta")].map((e) => ({
  tipo: e.classList.contains("validacaoErro") ? "erro" : "alerta",
  texto: e.textContent.trim().replace(/\s+/g, " "),
})).filter((x) => !/^(Erro: Impede|Alerta: Não impede) a liquidação/i.test(x.texto))); // fora a legenda da tela

export async function liquidar(p, data) {
  await irPara(p, "Liquidar");
  if (data) await digitar(p, "dataDeLiquidacaoInputDate", data);
  const usada = await p.inputValue(id("dataDeLiquidacaoInputDate"));
  await limparMensagens(p);
  await p.locator(id("liquidar")).click();
  await esperar(p, 20 * 60000); // a liquidação pode levar minutos
  const m = await mensagens(p);
  const pend = await pendencias(p);
  const ok = m.some((x) => /Sucesso/i.test(x)) && !pend.some((x) => x.tipo === "erro");
  return { ok, data_liquidacao: usada, mensagens: m, pendencias: pend };
}

// O .PJC é um zip com um XML; antes da liquidação ele sai com hashCodeLiquidacao nulo e o PJe o recusa.
export function lerPJC(arquivo) {
  const b = fs.readFileSync(arquivo);
  const fim = b.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (fim < 0) throw new Error("O .PJC exportado não é um arquivo zip.");
  const cd = b.readUInt32LE(fim + 16);
  const metodo = b.readUInt16LE(cd + 10), tamanho = b.readUInt32LE(cd + 20), local = b.readUInt32LE(cd + 42);
  const inicio = local + 30 + b.readUInt16LE(local + 26) + b.readUInt16LE(local + 28);
  const dados = b.subarray(inicio, inicio + tamanho);
  return (metodo === 8 ? zlib.inflateRawSync(dados) : dados).toString("latin1");
}

export async function exportarPJC(p, pasta) {
  await irPara(p, "Exportar");
  const [d] = await Promise.all([p.waitForEvent("download", { timeout: 300000 }), p.locator(id("exportar")).click()]);
  const arquivo = path.join(pasta, d.suggestedFilename());
  await d.saveAs(arquivo);
  const xml = lerPJC(arquivo);
  if (/<hashCodeLiquidacao>null</.test(xml) || /<dataDeLiquidacao>null</.test(xml)) {
    fs.rmSync(arquivo);
    throw new Error("O PJe-Calc exportou o cálculo sem liquidação (o PJe recusaria). Liquide antes de exportar.");
  }
  return arquivo;
}

export async function imprimirPDF(p, pasta) {
  await irPara(p, "Imprimir");
  await radio(p, "formatoSaida", "PDF");
  const [d] = await Promise.all([p.waitForEvent("download", { timeout: 600000 }), p.locator(id("imprimirConsolidado")).click()]);
  const arquivo = path.join(pasta, d.suggestedFilename().replace(/\.pdf$/i, "") + ".pdf");
  await d.saveAs(arquivo);
  if (fs.readFileSync(arquivo).subarray(0, 4).toString() !== "%PDF") {
    const m = await mensagens(p);
    fs.rmSync(arquivo);
    throw new Error(`O PJe-Calc não gerou o PDF. ${m.join(" ")}`);
  }
  return arquivo;
}
