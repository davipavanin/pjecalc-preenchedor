// Mapeia os campos das telas do PJe-Calc Cidadão local para JSON.
// Uso: node ferramentas/mapear.mjs [--canal msedge|chrome] [--visivel]
// Saída: docs/pesquisa/mapa-2.16.0/<tela>.json
import { chromium } from "playwright-core";
import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";

const BASE = "http://localhost:9257/pjecalc";
const SAIDA = "docs/pesquisa/mapa-2.16.0";
const canal = process.argv.includes("--canal") ? process.argv[process.argv.indexOf("--canal") + 1] : "msedge";

// Lê os campos visíveis da página: id, tipo, rótulo, opções, obrigatoriedade e se dispara AJAX.
export async function lerCampos(page) {
  return page.evaluate(() => {
    const visivel = (e) => !!(e.offsetWidth || e.offsetHeight || e.getClientRects().length);
    const rotulo = (e) => {
      const l = e.id && document.querySelector(`label[for="${CSS.escape(e.id)}"]`);
      if (l) return l.textContent.trim();
      let n = e.closest("td,div,span");
      for (let i = 0; n && i < 4; i++, n = n.parentElement) {
        const t = [...n.childNodes].filter((c) => c.nodeType === 3 || /^(LABEL|SPAN|B|STRONG)$/.test(c.nodeName))
          .map((c) => c.textContent.trim()).filter(Boolean).join(" ");
        if (t) return t.slice(0, 80);
      }
      return "";
    };
    const campos = [...document.querySelectorAll("input,select,textarea")]
      .filter((e) => e.type !== "hidden" && visivel(e) && !/^formulario:(searchText|zoom)/.test(e.id) && e.id !== "selAcheFacil")
      .map((e) => ({
        id: e.id, nome: e.name, tag: e.tagName.toLowerCase(), tipo: e.type, rotulo: rotulo(e),
        valor: e.type === "radio" || e.type === "checkbox" ? e.value : undefined,
        marcado: e.type === "radio" || e.type === "checkbox" ? e.checked : undefined,
        opcoes: e.tagName === "SELECT" ? [...e.options].map((o) => [o.value, o.text.trim()]) : undefined,
        maxlength: e.maxLength > 0 ? e.maxLength : undefined,
        ajax: /A4J|RichFaces|ajax/i.test((e.getAttribute("onchange") || "") + (e.getAttribute("onblur") || "") + (e.getAttribute("onclick") || "")) || undefined,
        mascara: /mascara|mask|Formata/i.test((e.getAttribute("onkeypress") || "") + (e.getAttribute("onkeyup") || "") + (e.getAttribute("onkeydown") || "")) || undefined,
      }));
    const acoes = [...document.querySelectorAll("a,input[type=button],input[type=submit],input[type=image],button")]
      .filter((e) => visivel(e) && (e.onclick || e.getAttribute("onclick")) && !/j_id38/.test(e.id))
      .map((e) => ({ id: e.id, texto: (e.value || e.title || e.alt || e.textContent || "").trim().replace(/\s+/g, " ").slice(0, 60) }))
      .filter((a) => a.texto);
    const abas = [...document.querySelectorAll("td.rich-tab-header, .rich-tab-header")].map((t) => t.textContent.trim());
    const titulo = (document.querySelector(".rich-panel-header, h1, .titulo") || {}).textContent;
    return { url: location.pathname, titulo: (titulo || "").trim(), abas, campos, acoes };
  });
}

export async function menuDoCalculo(page) {
  return page.evaluate(() => [...document.querySelectorAll("a[id*='j_id38']")]
    .map((a) => ({ id: a.id, texto: a.textContent.trim().replace(/\s+/g, " ") })).filter((a) => a.texto));
}

export async function esperarAjax(page) {
  // O PJe-Calc mostra a janela "Processando..." (formulario:msgAguarde) durante cada requisição AJAX;
  // ela cobre a tela e engole cliques. Espera ela aparecer (se for aparecer) e sumir.
  await page.waitForTimeout(150);
  await page.waitForFunction(() => {
    const d = document.getElementById("formulario:msgAguardeCDiv");
    return !d || getComputedStyle(d).display === "none" || d.offsetParent === null;
  }, null, { timeout: 60000 });
  await page.waitForLoadState("networkidle").catch(() => {});
}

// Datas: a máscara (jquery.maskedinput) se instala no foco com atraso; digitar antes embaralha.
// Escape desfaz o valor. Regra: focar, esperar, digitar só os dígitos, Tab.
export async function digitarData(page, id, ddmmaaaa) {
  const sel = `[id='formulario:${id}']`;
  await page.focus(sel);
  await page.waitForTimeout(400);
  await page.keyboard.type(ddmmaaaa.replace(/\D/g, ""), { delay: 40 });
  await page.keyboard.press("Tab");
  await esperarAjax(page);
  return page.inputValue(sel);
}

// Cria e salva um cálculo fictício mínimo (libera o menu do cálculo).
export async function criarCalculoFicticio(page) {
  await page.goto(BASE + "/pages/principal.jsf");
  await page.getByRole("link", { name: "Criar Novo Cálculo" }).click();
  await page.waitForURL(/calculo\.jsf/); await esperarAjax(page);
  await page.fill("[id='formulario:reclamanteNome']", "RECLAMANTE FICTICIO");
  await page.fill("[id='formulario:reclamadoNome']", "RECLAMADA FICTICIA LTDA");
  await page.getByText("Parâmetros do Cálculo", { exact: true }).click(); await esperarAjax(page);
  await page.selectOption("[id='formulario:estado']", { label: "SP" }); await esperarAjax(page);
  await page.selectOption("[id='formulario:municipio']", { label: "CAMPINAS" }); await esperarAjax(page);
  await digitarData(page, "dataAdmissaoInputDate", "01/03/2021");
  await digitarData(page, "dataDemissaoInputDate", "15/05/2024");
  await digitarData(page, "dataAjuizamentoInputDate", "10/09/2024");
  await page.fill("[id='formulario:valorCargaHorariaPadrao']", "220");
  await page.click("[id='formulario:salvar']"); await esperarAjax(page);
  return page.inputValue("[id='formulario:idCalculo']");
}

export async function irPara(page, texto) {
  const m = (await menuDoCalculo(page)).find((x) => x.texto === texto);
  const sel = `[id='${m.id}']`;
  if (!(await page.isVisible(sel))) { await page.getByText("Operações", { exact: true }).click(); await esperarAjax(page); }
  await page.click(sel); await esperarAjax(page);
}

function salvar(nome, dados) {
  fs.mkdirSync(SAIDA, { recursive: true });
  const arq = path.join(SAIDA, nome.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/gi, "-").toLowerCase() + ".json");
  fs.writeFileSync(arq, JSON.stringify(dados, null, 2));
  console.log("gravado", arq, dados.campos.length, "campos");
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const browser = await chromium.launch({ channel: canal, headless: !process.argv.includes("--visivel") });
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  await page.goto(BASE + "/pages/principal.jsf");
  await page.getByRole("link", { name: "Criar Novo Cálculo" }).click();
  await page.waitForURL(/calculo\.jsf/);
  await esperarAjax(page);
  salvar("dados-do-calculo--dados-do-processo", await lerCampos(page));
  await page.getByText("Parâmetros do Cálculo", { exact: true }).click();
  await esperarAjax(page);
  salvar("dados-do-calculo--parametros", await lerCampos(page));
  console.log(JSON.stringify(await menuDoCalculo(page)));
  await browser.close();
}
