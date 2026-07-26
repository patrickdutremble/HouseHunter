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
  ]),
  {
    rules: {
      // These React Compiler-era rules flag common, working patterns
      // (hydration-mount guards, data-loading effects, popover refs). Keep
      // them visible as warnings rather than failing the lint/build.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      // Honor the leading-underscore convention for intentionally-unused
      // arguments and variables (e.g. stub callbacks in tests).
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
]);

export default eslintConfig;
