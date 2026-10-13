// Mapeia subtelas: Verbas > Expresso, Verbas > Manual, Histórico Salarial > Novo.
import { chromium } from "playwright-core";
import fs from "fs";
import { esperarAjax, lerCampos, criarCalculoFicticio, irPara } from "./mapear.mjs";
const SAIDA = "docs/pesquisa/mapa-2.16.0";
const b = await chromium.launch({ channel: "msedge", headless: true });
const p = await b.newPage({ viewport: { width: 1400, height: 1200 } });
console.log("calculo", await criarCalculoFicticio(p));
const grava = async (nome) => { const d = await lerCampos(p); fs.writeFileSync(`${SAIDA}/${nome}.json`, JSON.stringify(d, null, 2));
  await p.screenshot({ path: `ambiente/telas/${nome}.png`, fullPage: true }); console.log(nome, d.url, d.campos.length, "campos", d.acoes.map(a => a.texto).join(" | ")); return d; };

await irPara(p, "Verbas");
await p.click("[id='formulario:lancamentoExpresso']"); await esperarAjax(p);
const exp = await grava("verbas--expresso");
const verbas = await p.evaluate(() => [...document.querySelectorAll("input[type=checkbox]")].filter(e => e.offsetParent)
  .map(e => ({ id: e.id, nome: (e.closest("td") ? e.closest("td").textContent : e.parentElement.textContent).trim().replace(/\s+/g, " ") })));
fs.writeFileSync(`${SAIDA}/verbas--expresso-lista.json`, JSON.stringify(verbas, null, 2));
console.log("verbas expresso:", verbas.length, verbas.slice(0, 60).map(v => v.nome).join("; "));

await irPara(p, "Verbas");
await p.click("[id='formulario:incluir']"); await esperarAjax(p);
await grava("verbas--manual-novo");

await irPara(p, "Histórico Salarial");
await p.click("[id='formulario:incluir']"); await esperarAjax(p);
await grava("historico-salarial--novo");
await b.close();
