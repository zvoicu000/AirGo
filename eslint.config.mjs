/**
 * ESLint configuration for the project.
 *
 * This configuration is defined using `defineConfig` and includes settings for
 * TypeScript, JSON, Markdown, and Prettier integration.
 *
 * - TypeScript:
 *   - Uses `@typescript-eslint` plugin with recommended rules.
 *   - Enforces specific rules such as no unused variables, no console logs, 
 *     consistent use of semicolons, single quotes, and Prettier formatting.
 *
 * - JSON:
 *   - Applies the `json` plugin with recommended rules for JSON files.
 *
 * - Markdown:
 *   - Applies the `markdown` plugin with recommended rules for Markdown files.
 *
 * - Prettier:
 *   - Integrates Prettier for consistent code formatting.
 *   - Additional settings are configured in .prettierrc.json
 *
 */

import tseslint from "typescript-eslint";
import json from "@eslint/json";
import markdown from "@eslint/markdown";
import { defineConfig } from "eslint/config";
import tsparser from "@typescript-eslint/parser";
import prettierPlugin from "eslint-plugin-prettier";
import prettierConfig from "eslint-config-prettier";
import typescriptEslint from '@typescript-eslint/eslint-plugin';

export default defineConfig([
  {
    ignores: [
      'package-lock.json',
      '**/cdk.out',
      '**/cdk.out.frontend',
      '**/node_modules/**/*',
      'frontend',
      'dist',
    ],
  },
  tseslint.configs.recommended,
  {
    files: ["**/*.json"],
    plugins: { json },
    language: "json/json",
    extends: ["json/recommended"]
  },
  { 
    files: ["**/*.md"],
    plugins: { markdown },
    language: "markdown/commonmark",
    extends: ["markdown/recommended"],
    rules: { "markdown/no-missing-label-refs": "off" } },
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tsparser,
      sourceType: "module",
    },
    plugins: {
      "@typescript-eslint": typescriptEslint,
      prettier: prettierPlugin,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      ...prettierConfig.rules,
      '@typescript-eslint/no-unused-vars': 'error',
      "no-console": "warn",
      "semi": ["error", "always"],
      "quotes": ["error", "single"],
      "prettier/prettier": "error",
    },
  }
]);
