import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";
import perfectionist from "eslint-plugin-perfectionist";

export default tseslint.config(
  {
    ignores: ["dist/**", "node_modules/**", "coverage/**", "db/migrations/**"],
  },
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: { allowDefaultProject: ["eslint.config.js", "scripts/*.mjs"] },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    plugins: { perfectionist },
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@typescript-eslint/consistent-type-imports": "error",
      "no-console": "error",
      "perfectionist/sort-imports": [
        "error",
        {
          type: "line-length",
          order: "asc",
          newlinesBetween: 1,
          groups: [
            "infrastructure-type",
            "infrastructure",
            "core-type",
            "core",
            "shared-type",
            "shared",
            "features-type",
            "features",
            ["type-parent", "type-sibling", "type-index"],
            ["parent", "sibling", "index"],
            "side-effect",
            ["type-builtin", "type-external"],
            ["builtin", "external"],
            "unknown",
          ],
          customGroups: [
            { groupName: "infrastructure-type", elementNamePattern: "^@infrastructure/", modifiers: ["type"] },
            { groupName: "infrastructure", elementNamePattern: "^@infrastructure/" },
            { groupName: "core-type", elementNamePattern: "^@core/", modifiers: ["type"] },
            { groupName: "core", elementNamePattern: "^@core/" },
            { groupName: "shared-type", elementNamePattern: "^@shared/", modifiers: ["type"] },
            { groupName: "shared", elementNamePattern: "^@shared/" },
            { groupName: "features-type", elementNamePattern: "^@features/", modifiers: ["type"] },
            { groupName: "features", elementNamePattern: "^@features/" },
          ],
        },
      ],
    },
  },
  {
    // Build-verification scripts run against dist/, which is outside tsconfig, so the
    // type-aware rules have nothing to resolve. They also reassign console.error on
    // purpose, to capture what Sapphire's loader reports.
    files: ["scripts/*.mjs"],
    rules: {
      "no-console": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-return": "off",
    },
  },
  prettier,
);
