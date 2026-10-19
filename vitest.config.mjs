import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		alias: {
			// obsidian パッケージは型定義のみのため、テスト時は代替実装に差し替える
			obsidian: fileURLToPath(new URL("./src/__mocks__/obsidian.ts", import.meta.url)),
		},
	},
});
