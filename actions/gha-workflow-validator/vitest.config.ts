import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    server: {
      deps: {
        // The workflow parser ships ESM that imports JSON without an import
        // attribute. Vite can transform it; Node's ESM loader cannot.
        inline: [/@actions\/workflow-parser/, /@actions\/expressions/],
      },
    },
  },
});
