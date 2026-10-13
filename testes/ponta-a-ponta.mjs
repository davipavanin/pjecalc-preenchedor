// Teste de ponta a ponta contra o PJe-Calc local, só com dados fictícios:
// ficha → preencher → liquidar → .PJC liquidado + PDF oficial.
// Uso: node testes/ponta-a-ponta.mjs [ficha.json] [--visivel]   (o PJe-Calc precisa estar aberto)
import fs from "node:fs";
import path from "node:path";
import { Ficha, conferir } from "../servidor/ficha.js";
import { verificar, abrirNavegador, preencher, liquidar, exportarPJC, imprimirPDF } from "../servidor/robo.js";

const arq = process.argv.slice(2).find((a) => a.endsWith(".json")) || "exemplos/ficha-ficticia.json";
const ficha = Ficha.parse(JSON.parse(fs.readFileSync(arq, "utf8")));
const problemas = conferir(ficha);
if (problemas.length) { console.error("Ficha com problemas:", problemas); process.exit(1); }

const estado = await verificar();
if (!estado.pronto) { console.error(estado.motivo); process.exit(1); }

const inicio = Date.now();
const log = (m) => console.log(`[${((Date.now() - inicio) / 1000).toFixed(0)}s] ${m}`);
const { navegador, p } = await abrirNavegador({ visivel: process.argv.includes("--visivel") });
let falhou = false;
try {
  const numero = await preencher(p, ficha, log);
  const r = await liquidar(p, ficha.data_liquidacao);
  log(`Liquidação: ${r.ok ? "OK" : "COM PENDÊNCIAS"} em ${r.data_liquidacao}. ${r.mensagens.join(" ")}`);
  for (const x of r.pendencias) log(`  ${x.tipo.toUpperCase()}: ${x.texto}`);
  if (!r.ok) throw new Error("liquidação não concluída");
  const pasta = path.resolve("ambiente/saida", `teste-calculo-${numero}`);
  fs.mkdirSync(pasta, { recursive: true });
  log(`PJC: ${await exportarPJC(p, pasta)}`);
  log(`PDF: ${await imprimirPDF(p, pasta)}`);
} catch (e) {
  falhou = true;
  console.error("FALHOU:", e.message);
  await p.screenshot({ path: "ambiente/saida/falha.png", fullPage: true }).catch(() => {});
} finally {
  await navegador.close();
}
process.exit(falhou ? 1 : 0);
