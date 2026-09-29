import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  // Next compiles JSX with the automatic runtime; match it so a .tsx test can render a component
  // without importing React (esbuild's default here is the classic React.createElement transform).
  esbuild: {
    jsx: "automatic",
  },
  test: {
    environment: "node",
  },
});
