// Cria um cálculo fictício mínimo, salva e mapeia cada tela do menu do cálculo.
// Uso: node ferramentas/mapear-telas.mjs
import { chromium } from "playwright-core";
import fs from "fs";
import { esperarAjax, menuDoCalculo, digitarData, lerCampos } from "./mapear.mjs";

const SAIDA = "docs/pesquisa/mapa-2.16.0";
const PULAR = new Set(["Fechar", "Excluir"]);
const slug = (t) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/gi, "-").toLowerCase();

const b = await chromium.launch({ channel: "msedge", headless: true });
const p = await b.newPage({ viewport: { width: 1400, height: 1000 } });
await p.goto("http://localhost:9257/pjecalc/pages/principal.jsf");
await p.getByRole("link", { name: "Criar Novo Cálculo" }).click();
await p.waitForURL(/calculo\.jsf/); await esperarAjax(p);
await p.fill("[id='formulario:reclamanteNome']", "RECLAMANTE FICTICIO");
await p.fill("[id='formulario:reclamadoNome']", "RECLAMADA FICTICIA LTDA");
await p.getByText("Parâmetros do Cálculo", { exact: true }).click(); await esperarAjax(p);
await p.selectOption("[id='formulario:estado']", { label: "SP" }); await esperarAjax(p);
await p.selectOption("[id='formulario:municipio']", { label: "CAMPINAS" }); await esperarAjax(p);
await digitarData(p, "dataAdmissaoInputDate", "01/03/2021");
await digitarData(p, "dataDemissaoInputDate", "15/05/2024");
await digitarData(p, "dataAjuizamentoInputDate", "10/09/2024");
await p.fill("[id='formulario:valorCargaHorariaPadrao']", "220");
await p.click("[id='formulario:salvar']"); await esperarAjax(p);

const menu = await menuDoCalculo(p);
const fim = menu.findIndex((m) => m.texto === "Exportar");
const telas = menu.slice(0, fim + 1).filter((m) => !PULAR.has(m.texto));
const indice = [];
for (const t of telas) {
  try {
    if (!(await p.isVisible(`[id='${t.id}']`))) { await p.getByText("Operações", { exact: true }).click(); await esperarAjax(p); }
    await p.click(`[id='${t.id}']`); await esperarAjax(p);
    const dados = await lerCampos(p);
    dados.menu = t.texto;
    fs.writeFileSync(`${SAIDA}/${slug(t.texto)}.json`, JSON.stringify(dados, null, 2));
    await p.screenshot({ path: `ambiente/telas/${slug(t.texto)}.png`, fullPage: true });
    indice.push(`${t.texto}: ${dados.campos.length} campos, ${dados.acoes.length} ações, abas: ${dados.abas.join(", ") || "-"}`);
  } catch (e) { indice.push(`${t.texto}: ERRO ${e.message.split("\n")[0]}`); }
}
console.log(indice.join("\n"));
await b.close();
