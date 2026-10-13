#!/usr/bin/env node
// Servidor MCP (stdio) do PJe-Calc Preenchedor. Ferramentas finas sobre ficha.js (regras) e robo.js (tela).
// stdout é do protocolo MCP: nada de console.log aqui; diagnóstico vai para stderr.
import { McpServer } from "@modelcontextprotocol/server";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import * as z from "zod/v4";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Ficha, conferir, regional } from "./ficha.js";
import { verificar, abrirNavegador, abrirCalculo, preencher, liquidar, exportarPJC, imprimirPDF, brl } from "./robo.js";

const PASTA = process.env.PJECALC_SAIDA || path.join(os.homedir(), "Documents", "PJe-Calc Preenchedor");
const VISIVEL = ["1", "true"].includes(process.env.PJECALC_VISIVEL);

const texto = (t, extra) => ({ content: [{ type: "text", text: t }], ...extra });
const falha = (t) => texto(t, { isError: true });

// Um robô por vez: dois preenchimentos simultâneos na mesma instância do PJe-Calc se atropelam.
let ocupado = false;

// Preenchimento leva minutos: avisa o progresso ao cliente (e reinicia o timeout dele) a cada passo e a cada 15 s.
function progresso(ctx) {
  const token = ctx?.mcpReq?._meta?.progressToken;
  const linhas = [];
  let n = 0;
  const enviar = (msg) => token !== undefined && ctx.mcpReq.notify({ method: "notifications/progress", params: { progressToken: token, progress: ++n, message: msg } }).catch(() => {});
  const pulso = setInterval(() => enviar("PJe-Calc processando..."), 15000);
  return { log: (m) => { linhas.push(m); console.error(m); enviar(m); }, linhas, fim: () => clearInterval(pulso) };
}

function pastaDoCalculo(nome) {
  const p = path.join(PASTA, nome.replace(/[^\w.\- ]/g, "_"));
  fs.mkdirSync(p, { recursive: true });
  return p;
}

function resumo(f) {
  const c = f.contrato;
  return [
    `Processo ${f.processo.numero ?? "(sem número)"}: ${f.processo.reclamante.nome} x ${f.processo.reclamada.nome}.`,
    `Contrato ${c.admissao} a ${c.demissao ?? "(vigente)"}, ${c.municipio}/${c.estado}, ajuizamento ${c.ajuizamento}${c.prescricao_quinquenal ? ", com prescrição quinquenal" : ""}.`,
    `Salários: ${f.salarios.map((s) => `${s.de}–${s.ate} R$ ${brl(s.valor)}`).join("; ")}.`,
    `Verbas: ${f.verbas.map((v) => v.nome + (v.valor !== undefined ? ` (R$ ${brl(v.valor)})` : "") + (v.horas_por_mes ? ` (${v.horas_por_mes} h/mês)` : "") + (v.adicional ? ` (adicional de ${v.adicional}%)` : "") + (v.de || v.ate ? ` [${v.de ?? "início"} a ${v.ate ?? "fim"}]` : "") + (v.reflexos ? ` [reflexos: ${v.reflexos.join(", ")}]` : "")).join("; ")}.`,
    `FGTS: ${f.fgts.destino === "PAGAR" ? "pagar" : "depositar"}${f.fgts.multa !== "NAO" ? ` + multa de ${f.fgts.multa}%` : ", sem multa"}${f.fgts.multa_467 ? " + art. 467" : ""}${f.fgts.depositos.length ? `, deduzindo R$ ${brl(f.fgts.depositos.reduce((t, d) => t + d.valor, 0))} já depositados` : ""}.`,
    `Tabelas de correção e juros: ${regional(f)} (atualizadas antes de calcular).`,
    f.correcao ? `Correção: ${f.correcao.indices.map((x) => x.indice + (x.a_partir_de ? ` desde ${x.a_partir_de}` : "")).join(" → ")}; juros: ${f.correcao.juros.map((x) => x.tabela + (x.a_partir_de ? ` desde ${x.a_partir_de}` : "")).join(" → ")}.` : "Correção e juros: padrão do PJe-Calc.",
    f.honorarios.length ? `Honorários: ${f.honorarios.map((h) => `${h.percentual}% pelo ${h.devedor.toLowerCase()}`).join("; ")}.` : "Sem honorários.",
  ].join("\n");
}

// Liquida, exporta .PJC e imprime o PDF de um cálculo já aberto na página p.
async function liquidarEExportar(p, numero, data, nomePasta, log) {
  log("Liquidando (pode levar alguns minutos)...");
  const r = await liquidar(p, data);
  const pend = r.pendencias.map((x) => `${x.tipo.toUpperCase()}: ${x.texto}`);
  if (!r.ok) return { ok: false, numero, pend, mensagens: r.mensagens };
  const pasta = pastaDoCalculo(nomePasta);
  log("Exportando o .PJC...");
  const pjc = await exportarPJC(p, pasta);
  log("Gerando o PDF oficial...");
  const pdf = await imprimirPDF(p, pasta);
  return { ok: true, numero, data: r.data_liquidacao, pend, pjc, pdf };
}

function relatorio(r, linhas) {
  if (!r.ok)
    return falha([
      `O cálculo nº ${r.numero} foi criado no PJe-Calc, mas a liquidação não fechou. Nada foi exportado.`,
      ...r.pend, ...r.mensagens,
      `O advogado pode abrir o cálculo nº ${r.numero} no PJe-Calc, corrigir o que falta e depois pedir "liquidar_e_exportar" com esse número.`,
      "", "Passos feitos:", ...linhas,
    ].join("\n"));
  return texto([
    `Cálculo nº ${r.numero} liquidado em ${r.data} pelo PJe-Calc oficial.`,
    `PDF: ${r.pdf}`, `PJC: ${r.pjc}`,
    ...(r.pend.length ? ["Alertas do PJe-Calc (revise):", ...r.pend] : []),
    "Antes de juntar no PJe, o advogado confere o PDF; o PJe-Calc é a fonte do valor.",
    "", "Passos feitos:", ...linhas,
  ].join("\n"));
}

const server = new McpServer({ name: "pje-calc-preenchedor", version: "0.1.0" });

server.registerTool("verificar_pjecalc", {
  title: "Verificar o PJe-Calc",
  description: "Confere se o PJe-Calc Cidadão está aberto neste computador e se a versão é uma das testadas. Chame antes de preencher.",
  inputSchema: z.object({}),
  annotations: { readOnlyHint: true },
}, async () => {
  const e = await verificar();
  return e.pronto ? texto(`PJe-Calc ${e.versao} aberto e pronto.`) : falha(e.motivo);
});

server.registerTool("conferir_ficha", {
  title: "Conferir a ficha do cálculo",
  description: "Valida a ficha do cálculo (formato e regras que o PJe-Calc só acusaria na liquidação) e devolve um resumo em linguagem jurídica para o advogado revisar. Não toca no PJe-Calc.",
  inputSchema: z.object({ ficha: Ficha }),
  annotations: { readOnlyHint: true },
}, async ({ ficha }) => {
  const problemas = conferir(ficha);
  return problemas.length
    ? falha(`A ficha tem ${problemas.length} problema(s):\n- ${problemas.join("\n- ")}`)
    : texto(`Ficha sem problemas. Resumo para o advogado revisar:\n\n${resumo(ficha)}`);
});

server.registerTool("preencher_calculo", {
  title: "Preencher e liquidar no PJe-Calc",
  description: "Cria um cálculo novo no PJe-Calc aberto neste computador a partir da ficha, liquida e salva o PDF oficial e o .PJC na pasta Documentos/PJe-Calc Preenchedor. Só chame depois que o advogado leu o resumo de conferir_ficha e aprovou expressamente. Leva alguns minutos.",
  inputSchema: z.object({
    ficha: Ficha,
    revisado_pelo_advogado: z.literal(true).describe("true somente se o advogado aprovou o resumo da ficha nesta conversa"),
  }),
  annotations: { destructiveHint: false, idempotentHint: false },
}, async ({ ficha }, ctx) => {
  const problemas = conferir(ficha);
  if (problemas.length) return falha(`Corrija a ficha antes:\n- ${problemas.join("\n- ")}`);
  if (ocupado) return falha("Já há um preenchimento em andamento. Espere terminar.");
  const e = await verificar();
  if (!e.pronto) return falha(e.motivo);
  ocupado = true;
  const pg = progresso(ctx);
  let navegador, p, numero;
  try {
    ({ navegador, p } = await abrirNavegador({ visivel: VISIVEL }));
    numero = await preencher(p, ficha, pg.log);
    const nome = `${ficha.processo.numero ?? "sem-numero"} - calculo ${numero}`;
    return relatorio(await liquidarEExportar(p, numero, ficha.data_liquidacao, nome, pg.log), pg.linhas);
  } catch (err) {
    return falha([
      `O preenchimento parou: ${err.message}`,
      numero ? `O cálculo nº ${numero} ficou incompleto no PJe-Calc; o advogado pode completá-lo à mão ou excluí-lo.` : "Nenhum cálculo foi criado.",
      "", "Passos feitos:", ...pg.linhas,
    ].join("\n"));
  } finally {
    pg.fim();
    ocupado = false;
    await navegador?.close().catch(() => {});
  }
});

server.registerTool("liquidar_e_exportar", {
  title: "Liquidar e exportar um cálculo existente",
  description: "Para um cálculo que o advogado completou ou corrigiu à mão no PJe-Calc: abre pelo número, liquida e salva o PDF oficial e o .PJC. O cálculo precisa aparecer em 'Cálculos Recentes'.",
  inputSchema: z.object({
    numero: z.number().int().positive().describe("Número do cálculo no PJe-Calc"),
    data_liquidacao: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/).optional().describe("DD/MM/AAAA; omitido, usa a do PJe-Calc"),
  }),
  annotations: { destructiveHint: false },
}, async ({ numero, data_liquidacao }, ctx) => {
  if (ocupado) return falha("Já há um preenchimento em andamento. Espere terminar.");
  const e = await verificar();
  if (!e.pronto) return falha(e.motivo);
  ocupado = true;
  const pg = progresso(ctx);
  let navegador, p;
  try {
    ({ navegador, p } = await abrirNavegador({ visivel: VISIVEL }));
    await abrirCalculo(p, numero);
    return relatorio(await liquidarEExportar(p, String(numero), data_liquidacao, `calculo ${numero}`, pg.log), pg.linhas);
  } catch (err) {
    return falha(`Parou: ${err.message}`);
  } finally {
    pg.fim();
    ocupado = false;
    await navegador?.close().catch(() => {});
  }
});

await server.connect(new StdioServerTransport());
