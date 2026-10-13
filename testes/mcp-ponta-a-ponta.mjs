// Chama o servidor MCP por stdio como o Claude Desktop faria: preencher_calculo com a ficha fictícia.
// Uso: node testes/mcp-ponta-a-ponta.mjs   (o PJe-Calc precisa estar aberto; saída em ambiente/saida/mcp)
import { spawn } from "node:child_process";
import fs from "node:fs";
import readline from "node:readline";

const ficha = JSON.parse(fs.readFileSync("exemplos/ficha-ficticia.json", "utf8"));
const srv = spawn("node", ["servidor/index.js"], { env: { ...process.env, PJECALC_SAIDA: "ambiente/saida/mcp" }, stdio: ["pipe", "pipe", "inherit"] });
const enviar = (m) => srv.stdin.write(JSON.stringify({ jsonrpc: "2.0", ...m }) + "\n");
let progresso = 0;
readline.createInterface({ input: srv.stdout }).on("line", (l) => {
  const m = JSON.parse(l);
  if (m.method === "notifications/progress") { progresso++; return; }
  if (m.id === 2) {
    console.log(m.result?.content?.[0]?.text ?? JSON.stringify(m.error));
    console.log(`(${progresso} avisos de progresso recebidos)`);
    srv.kill();
    process.exit(m.result && !m.result.isError ? 0 : 1);
  }
});
enviar({ id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "teste", version: "0" } } });
enviar({ method: "notifications/initialized" });
enviar({ id: 2, method: "tools/call", params: { name: "preencher_calculo", arguments: { ficha, revisado_pelo_advogado: true }, _meta: { progressToken: "t1" } } });
