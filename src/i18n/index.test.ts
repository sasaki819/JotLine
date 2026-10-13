import { describe, it, expect } from "vitest";
import { t } from "./index";

describe("i18n module", () => {
	it("returns fallback English or localized string for keys", () => {
		const appTitle = t("APP_TITLE");
		expect(appTitle).toBe("JotLine");

		const cancel = t("CANCEL");
		expect(cancel).toBeTruthy();
	});

	it("formats parameter functions correctly", () => {
		const selected = t("SELECTED_COUNT", 3);
		expect(selected).toContain("3");

		const notice = t("NOTICE_COPIED_ALL", 5);
		expect(notice).toContain("5");
	});
});
