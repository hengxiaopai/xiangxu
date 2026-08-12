import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      ".git/**",
      "**/.next/**",
      "**/.turbo/**",
      "**/coverage/**",
      "**/dist/**",
      "**/node_modules/**",
      "XIANGXU_Gate_3.9R_Codex_Chinese_Handoff_V1.0/**",
    ],
  },
  {
    files: ["tools/**/*.mjs", "packages/*/scripts/**/*.mjs"],
    languageOptions: {
      globals: {
        console: "readonly",
        fetch: "readonly",
        process: "readonly",
        setTimeout: "readonly",
        URL: "readonly",
      },
    },
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
);
