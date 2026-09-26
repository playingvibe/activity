import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

/**
 * The Activity's linter. The root `eslint.config.js` ignores `activity/`, which is its own package
 * with its own dependencies, so this one has to exist here. It leans on TypeScript for what it
 * already checks (unused locals, strictness) and adds what tsc cannot see: hook rules, dead
 * conditions and the usual footguns.
 */
export default tseslint.config(
  { ignores: ["dist/**", "node_modules/**"] },
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: { globals: globals.browser },
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // tsc's noUnusedLocals already reports these, with the leading-underscore escape hatch.
      "@typescript-eslint/no-unused-vars": "off",
    },
  }
);
