// Ficha do cálculo: o que a IA monta a partir da sentença e o advogado revisa antes do preenchimento.
// Linguagem jurídica, não IDs de tela. O robô (robo.js) traduz a ficha para o PJe-Calc.
import * as z from "zod/v4";

// Verbas do Lançamento Expresso do PJe-Calc 2.16.0, com o nome exato da tela.
export const VERBAS_EXPRESSO = [
  "13º SALÁRIO", "ABONO PECUNIÁRIO", "ACORDO (MERA LIBERALIDADE)", "ACORDO (MULTA)", "ACORDO (VERBAS INDENIZATÓRIAS)",
  "ACORDO (VERBAS REMUNERATÓRIAS)", "ADICIONAL DE HORAS EXTRAS 50%", "ADICIONAL DE INSALUBRIDADE 10%",
  "ADICIONAL DE INSALUBRIDADE 20%", "ADICIONAL DE INSALUBRIDADE 40%", "ADICIONAL DE PERICULOSIDADE 30%",
  "ADICIONAL DE PRODUTIVIDADE 30%", "ADICIONAL DE RISCO 40%", "ADICIONAL DE SOBREAVISO", "ADICIONAL DE TRANSFERÊNCIA 25%",
  "ADICIONAL NOTURNO 20%", "AJUDA DE CUSTO", "AVISO PRÉVIO", "CESTA BÁSICA", "COMISSÃO", "DEVOLUÇÃO DE DESCONTOS INDEVIDOS",
  "DIFERENÇA SALARIAL", "DIÁRIAS - INTEGRAÇÃO AO SALÁRIO", "DIÁRIAS - PAGAMENTO", "FERIADO EM DOBRO", "FÉRIAS + 1/3",
  "GORJETA", "GRATIFICAÇÃO DE FUNÇÃO", "GRATIFICAÇÃO POR TEMPO DE SERVIÇO", "HORAS EXTRAS 100%", "HORAS EXTRAS 50%",
  "HORAS IN ITINERE", "INDENIZAÇÃO ADICIONAL", "INDENIZAÇÃO PIS - ABONO SALARIAL", "INDENIZAÇÃO POR DANO ESTÉTICO",
  "INDENIZAÇÃO POR DANO MATERIAL", "INDENIZAÇÃO POR DANO MORAL", "INTERVALO INTERJORNADAS", "INTERVALO INTRAJORNADA",
  "MULTA CONVENCIONAL", "MULTA DO ARTIGO 477 DA CLT", "PARTICIPAÇÃO NOS LUCROS OU RESULTADOS - PLR", "PRÊMIO PRODUÇÃO",
  "REPOUSO SEMANAL REMUNERADO", "RESTITUIÇÃO / INDENIZAÇÃO DE DESPESA", "SALDO DE EMPREITADA", "SALDO DE SALÁRIO",
  "SALÁRIO MATERNIDADE", "SALÁRIO RETIDO", "TÍQUETE-ALIMENTAÇÃO", "VALE TRANSPORTE", "VALOR PAGO - NÃO TRIBUTÁVEL",
  "VALOR PAGO - TRIBUTÁVEL",
];

export const INDICES = ["IPCAE", "SELIC", "IPCA", "TR", "INPC", "IGPM", "IPCAETR", "TUACDT", "TABELA_UNICA_JT_MENSAL", "SEM_CORRECAO"];
export const JUROS = ["TRD_SIMPLES", "SEM_JUROS", "TAXA_LEGAL", "SELIC", "JUROS_PADRAO", "JUROS_UM_PORCENTO", "JUROS_MEIO_PORCENTO", "TRD_COMPOSTOS"];

const data = z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/, "use DD/MM/AAAA");
const competencia = z.string().regex(/^\d{2}\/\d{4}$/, "use MM/AAAA");
const reais = z.number().nonnegative().describe("Valor em reais, com ponto decimal (ex.: 3250.5)");

export const Ficha = z.object({
  processo: z.object({
    numero: z.string().regex(/^\d{7}-\d{2}\.\d{4}\.5\.\d{2}\.\d{4}$/, "use o número CNJ, ex.: 0010234-56.2024.5.15.0001").optional(),
    valor_causa: reais.optional(),
    reclamante: z.object({
      nome: z.string().min(3).describe("Exatamente como no cadastro do PJe: o PJe recusa cálculo com parte divergente"),
      cpf: z.string().regex(/^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/).optional(),
      pis: z.string().optional(),
    }),
    reclamada: z.object({
      nome: z.string().min(3),
      cnpj: z.string().regex(/^\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}$/).optional(),
      cpf: z.string().regex(/^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/).optional(),
    }),
  }),
  contrato: z.object({
    estado: z.string().length(2).describe("UF da prestação de serviços, ex.: SP"),
    municipio: z.string().min(2).describe("Município da prestação de serviços (feriados municipais)"),
    admissao: data,
    demissao: data.optional(),
    ajuizamento: data,
    inicio_calculo: data.optional().describe("Só se a sentença limitar o período (ex.: prescrição)"),
    fim_calculo: data.optional(),
    carga_horaria_mensal: z.number().positive().default(220),
    maior_remuneracao: reais,
    ultima_remuneracao: reais.optional(),
    regime: z.enum(["INTEGRAL", "PARCIAL", "INTERMITENTE"]).default("INTEGRAL"),
    aviso_previo: z.enum(["CALCULADO", "NAO_APURAR"]).default("CALCULADO").describe("CALCULADO: Lei 12.506/2011, 30 dias + 3 por ano"),
    projetar_aviso_indenizado: z.boolean().default(true),
    prescricao_quinquenal: z.boolean().default(false),
  }),
  salarios: z.array(z.object({ de: competencia, ate: competencia, valor: reais })).min(1)
    .describe("Evolução salarial, em faixas contínuas da admissão até a demissão"),
  fgts_sobre_salarios: z.boolean().default(false).describe("Marque só se a sentença condenar ao FGTS não depositado sobre os salários do contrato"),
  verbas: z.array(z.object({
    nome: z.enum(VERBAS_EXPRESSO),
    de: data.optional().describe("Início do período deferido; se omitido, o PJe-Calc usa o contrato"),
    ate: data.optional(),
    horas_por_mes: z.number().positive().optional().describe("Quantidade mensal de horas (horas extras, intervalo, adicional noturno)"),
    adicional: z.number().positive().max(200).optional()
      .describe("Horas extras: adicional em % quando diferente do nome da verba (ex.: 60 pela convenção coletiva)"),
    valor: reais.optional().describe("Valor fixo deferido (ex.: dano moral). Torna a verba INFORMADA"),
    reflexos: z.array(z.string()).optional()
      .describe("Reflexos deferidos, pelo começo do nome no PJe-Calc: ex. ['REPOUSO', '13º', 'FÉRIAS', 'AVISO']. Omitido: mantém o padrão do PJe-Calc"),
  })).min(1),
  fgts: z.object({
    destino: z.enum(["PAGAR", "DEPOSITAR"]).default("DEPOSITAR"),
    multa: z.enum(["40", "20", "NAO"]).default("40").describe("Multa rescisória: 40% (dispensa sem justa causa), 20% (acordo, art. 484-A) ou NAO"),
    multa_467: z.boolean().default(false),
    depositos: z.array(z.object({ data, valor: reais })).default([])
      .describe("Depósitos de FGTS já feitos (extrato da conta vinculada), para deduzir do devido"),
  }).default({ destino: "DEPOSITAR", multa: "40", multa_467: false, depositos: [] }),
  correcao: z.object({
    indices: z.array(z.object({ indice: z.enum(INDICES), a_partir_de: data.optional() })).min(1)
      .describe("O primeiro vale desde o início; os seguintes, a partir da data indicada"),
    juros: z.array(z.object({ tabela: z.enum(JUROS), a_partir_de: data.optional() })).min(1),
    juros_fase_pre_judicial: z.boolean().default(true),
  }).optional().describe("Omitido: mantém o padrão do PJe-Calc"),
  honorarios: z.array(z.object({
    devedor: z.enum(["RECLAMADO", "RECLAMANTE"]),
    percentual: z.number().positive().max(20),
    credor: z.string().min(3).describe("Nome do advogado ou da sociedade credora (obrigatório no PJe-Calc)"),
  })).default([]),
  data_liquidacao: data.optional().describe("Omitido: o PJe-Calc usa o último dia do mês corrente"),
});

const dia = (s) => { const [d, m, a] = s.split("/").map(Number); return new Date(a, m - 1, d); };
const mes = (s) => { const [m, a] = s.split("/").map(Number); return a * 12 + m - 1; };

// TRT do processo, pelo número CNJ (J = 5, TR = região): "0010817-47.2026.5.15.0042" → "TRT15".
export const regional = (f) => { const m = f.processo.numero?.match(/\.5\.(\d{2})\.\d{4}$/); return m ? `TRT${Number(m[1])}` : null; };

// Regras que o PJe-Calc só acusaria na liquidação (ou nunca): devolve a lista de problemas.
export function conferir(ficha) {
  const f = ficha, c = f.contrato, erros = [];
  if (f.processo.numero) {
    const [, n, d, a, j, t, o] = f.processo.numero.match(/^(\d{7})-(\d{2})\.(\d{4})\.(\d)\.(\d{2})\.(\d{4})$/);
    if (BigInt(n + a + j + t + o + d) % 97n !== 1n) erros.push(`Número do processo ${f.processo.numero} com dígito verificador inválido (confira a digitação).`);
  }
  if (c.demissao && dia(c.demissao) < dia(c.admissao)) erros.push("Demissão anterior à admissão.");
  if (dia(c.ajuizamento) < dia(c.admissao)) erros.push("Ajuizamento anterior à admissão.");
  const faixas = [...f.salarios].sort((a, b) => mes(a.de) - mes(b.de));
  faixas.forEach((s, i) => {
    if (mes(s.ate) < mes(s.de)) erros.push(`Faixa salarial ${s.de}–${s.ate} invertida.`);
    if (i && mes(s.de) !== mes(faixas[i - 1].ate) + 1) erros.push(`Faixas salariais com buraco ou sobreposição entre ${faixas[i - 1].ate} e ${s.de}.`);
  });
  const [, ma, aa] = c.admissao.split("/");
  if (mes(faixas[0].de) > mes(`${ma}/${aa}`)) erros.push("A evolução salarial começa depois da admissão.");
  if (c.demissao) {
    const [, md, ad] = c.demissao.split("/");
    if (mes(faixas.at(-1).ate) < mes(`${md}/${ad}`)) erros.push("A evolução salarial termina antes da demissão.");
  }
  for (const v of f.verbas) {
    if (v.de && v.ate && dia(v.ate) < dia(v.de)) erros.push(`${v.nome}: período invertido.`);
    if (/HORAS EXTRAS|INTERVALO|NOTURNO|IN ITINERE|SOBREAVISO/.test(v.nome) && !v.horas_por_mes && !v.valor)
      erros.push(`${v.nome}: falta a quantidade de horas por mês (ou um valor fixo).`);
    if (v.adicional && !/^HORAS EXTRAS/.test(v.nome)) erros.push(`${v.nome}: "adicional" só vale para horas extras.`);
    if (/^INDENIZAÇÃO POR DANO|^MULTA CONVENCIONAL|^AJUDA DE CUSTO|^RESTITUIÇÃO/.test(v.nome) && v.valor === undefined)
      erros.push(`${v.nome}: falta o valor deferido.`);
  }
  if (!regional(f)) erros.push("Informe o número CNJ do processo: dele sai o TRT cujas tabelas de correção e juros o PJe-Calc vai usar.");
  const nomes = f.verbas.map((v) => v.nome);
  if (new Set(nomes).size !== nomes.length) erros.push("Verba repetida: o Lançamento Expresso aceita cada verba uma vez.");
  if (f.correcao) {
    for (const lista of [f.correcao.indices, f.correcao.juros])
      lista.slice(1).forEach((x, i) => { if (!x.a_partir_de) erros.push(`Correção/juros: o item ${i + 2} precisa de data "a partir de".`); });
  }
  return erros;
}
