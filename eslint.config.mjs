import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

export default [
  ...nextCoreWebVitals,
  ...nextTypeScript,
  {
    rules: {
      // react-hooks v5 rules not yet stable in this plugin version
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/immutability": "off",
      "react-hooks/incompatible-library": "off",

      // Respect the _prefix convention for intentionally unused identifiers
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],

      // Prevent accidental console output leaking sensitive data in production.
      // groupCollapsed/groupEnd/table are allowed because they are only used
      // inside process.env.NODE_ENV !== "development" guards for perf traces.
      "no-console": ["warn", { allow: ["warn", "error", "groupCollapsed", "groupEnd", "table"] }],
    },
  },
];
