// Regra de avos do 13º e das férias (fração de 15 dias ou mais). Uso: node testes/avos.test.mjs
import assert from "node:assert/strict";
import { avos } from "../servidor/robo.js";
const d = (s) => { const [a, b, c] = s.split("/").map(Number); return new Date(c, b - 1, a); };
const casos = [
  ["13º SALÁRIO", "25/03/2024", "04/11/2024", "01/01/2024", "31/12/2024", 7],
  ["FÉRIAS + 1/3", "25/03/2024", "04/11/2024", "25/03/2024", "24/03/2025", 7],
  ["13º SALÁRIO", "01/01/2024", "31/12/2024", "01/01/2024", "31/12/2024", 12],
  ["FÉRIAS + 1/3", "25/03/2024", "24/03/2025", "25/03/2024", "24/03/2025", 12],
  ["13º SALÁRIO", "16/03/2024", "14/04/2024", "01/01/2024", "31/12/2024", 1],
  ["FÉRIAS + 1/3", "25/03/2024", "08/04/2024", "25/03/2024", "24/03/2025", 1],
  ["FÉRIAS + 1/3", "25/03/2024", "07/04/2024", "25/03/2024", "24/03/2025", 0],
];
for (const [tipo, a, b, i, f, esperado] of casos) assert.equal(avos(tipo, d(a), d(b), d(i), d(f)), esperado, `${tipo} ${a}–${b}`);
console.log(`avos: ${casos.length} casos ok`);
