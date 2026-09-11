import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // L'ambiente virtuale Python (data-layer/venv) porta dentro file .js di
    // terze parti (matplotlib) che non sono codice del progetto.
    "data-layer/venv/**",
  ]),
]);

export default eslintConfig;
