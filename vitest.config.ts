import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const src = fileURLToPath(new URL("./src", import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup/db.ts"],
    globals: false,
  },
  resolve: {
    alias: {
      "@": src,
      // `server-only` ném lỗi khi import ngoài React Server Component.
      // Thay bằng module rỗng để test được tầng service.
      "server-only": fileURLToPath(new URL("./tests/setup/empty.ts", import.meta.url)),
    },
  },
});
