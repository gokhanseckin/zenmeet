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
    // Design wireframes, not app code:
    "Zenmeet-designs/**",
  ]),
  {
    rules: {
      // Deliberate `as any` supabase-join casts until generated DB types exist.
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
]);

export default eslintConfig;
