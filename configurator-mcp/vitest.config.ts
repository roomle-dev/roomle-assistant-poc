import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'configurator-mcp-server/tests/**/*.test.ts',
      'configurator-mcp-chat/tests/**/*.test.ts',
    ],
  },
});
