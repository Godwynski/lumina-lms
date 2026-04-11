import nextConfig from "eslint-config-next";

/** @type {import('eslint').Linter.Config[]} */
const config = [
  ...nextConfig,
  {
    ignores: ["scripts/**/*", ".next/**/*", "next-env.d.ts"],
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
      "no-console": ["warn", { "allow": ["warn", "error", "info", "debug"] }],
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    files: ["components/qr-printer-modal.tsx"],
    rules: {
      "@next/next/no-img-element": "off",
    },
  },
];

export default config;
