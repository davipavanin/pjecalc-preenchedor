// Spike: cálculo fictício mínimo até o PDF e o .PJC oficiais (Liquidar, Exportar, Imprimir).
// Uso: node ferramentas/spike-ponta-a-ponta.mjs [--visivel]
import { chromium } from "playwright-core";
import fs from "fs";
import { esperarAjax, digitarData, criarCalculoFicticio, irPara } from "./mapear.mjs";

const SAIDA = "ambiente/saida";
fs.mkdirSync(SAIDA, { recursive: true });
const b = await chromium.launch({ channel: "msedge", headless: !process.argv.includes("--visivel") });
const ctx = await b.newContext({ acceptDownloads: true, viewport: { width: 1400, height: 1000 } });
const p = await ctx.newPage();
const foto = (n) => p.screenshot({ path: `${SAIDA}/${n}.png`, fullPage: true });
const msgs = () => p.evaluate(() => [...document.querySelectorAll(".rich-messages, .msgErro, .msgSucesso, .rich-message, [class*='mensage'], [class*='Mensage']")]
  .map((e) => e.textContent.trim().replace(/\s+/g, " ")).filter(Boolean));

// Lê a lista "Pendências do Cálculo" da tela Liquidar: tipo (erro/alerta), seção e texto.
const pendencias = () => p.evaluate(() => [...document.querySelectorAll("img")]
  .filter((i) => /erro|alerta|warn|error/i.test(i.src) && i.closest("tr") && !/Legenda/.test(i.closest("fieldset,table")?.textContent.slice(0, 40) || ""))
  .map((i) => ({ src: i.src.split("/").pop(), texto: i.closest("tr").textContent.trim().replace(/\s+/g, " ") })));

try {
  const id = await criarCalculoFicticio(p);
  console.log("calculo", id, await msgs());
  await irPara(p, "Dados do Cálculo");
  await p.getByText("Parâmetros do Cálculo", { exact: true }).click(); await esperarAjax(p);
  await p.fill("[id='formulario:valorMaiorRemuneracao']", "3.000,00");
  await p.fill("[id='formulario:valorUltimaRemuneracao']", "3.000,00");
  await p.click("[id='formulario:salvar']"); await esperarAjax(p);
  console.log("parametros", await msgs());

  await irPara(p, "Histórico Salarial");
  await p.click("[id='formulario:incluir']"); await esperarAjax(p);
  await p.fill("[id='formulario:nome']", "SALARIO");
  await digitarData(p, "competenciaInicialInputDate", "03/2021");
  await digitarData(p, "competenciaFinalInputDate", "05/2024");
  await p.check("[id='formulario:tipoValor:0']"); await esperarAjax(p);
  await p.fill("[id='formulario:valorParaBaseDeCalculo']", "3.000,00");
  await p.click("[id='formulario:cmdGerarOcorrencias']"); await esperarAjax(p);
  await p.click("[id='formulario:salvar']"); await esperarAjax(p);
  console.log("historico", await msgs()); await foto("1-historico");

  await irPara(p, "Verbas");
  await p.click("[id='formulario:lancamentoExpresso']"); await esperarAjax(p);
  for (const nome of ["SALDO DE SALÁRIO", "AVISO PRÉVIO", "13º SALÁRIO", "FÉRIAS + 1/3", "MULTA DO ARTIGO 477 DA CLT"]) {
    const cb = p.locator("td", { hasText: new RegExp(`^\\s*${nome.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`) }).locator("input[type=checkbox]");
    await cb.first().check();
  }
  await p.click("[id='formulario:salvar']"); await esperarAjax(p);
  console.log("verbas", await msgs()); await foto("2-verbas");

  await irPara(p, "Liquidar");
  await digitarData(p, "dataDeLiquidacaoInputDate", "30/09/2026");
  await p.click("[id='formulario:liquidar']"); await esperarAjax(p);
  console.log("liquidar", await msgs(), await pendencias()); await foto("3-liquidar");

  await irPara(p, "Exportar");
  const [dl] = await Promise.all([p.waitForEvent("download", { timeout: 60000 }), p.click("[id='formulario:exportar']")]);
  await dl.saveAs(`${SAIDA}/${dl.suggestedFilename()}`);
  console.log("exportar", dl.suggestedFilename());

  await irPara(p, "Imprimir");
  const espera = Promise.race([
    p.waitForEvent("download", { timeout: 120000 }).then((d) => ({ d })),
    ctx.waitForEvent("page", { timeout: 120000 }).then((np) => ({ np })),
  ]);
  await p.click("[id='formulario:imprimirConsolidado']");
  const r = await espera;
  if (r.d) { await r.d.saveAs(`${SAIDA}/${r.d.suggestedFilename()}`); console.log("imprimir: download", r.d.suggestedFilename()); }
  else { await r.np.waitForLoadState(); console.log("imprimir: nova janela", r.np.url()); }
  await foto("4-imprimir");
} catch (e) {
  console.log("ERRO", e.message.split("\n")[0], await msgs().catch(() => []));
  await foto("erro");
} finally {
  await b.close();
}
