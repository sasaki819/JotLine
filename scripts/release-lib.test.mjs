/**
 * @file release-lib.test.mjs
 * @description リリース処理の純粋関数（release-lib.mjs）の単体テスト（Vitest）。
 */

import { describe, it, expect } from "vitest";
import {
	parseVersionTag,
	checkVersions,
	extractChangelogSection,
	buildPackageFileUrl,
	validateRelease,
} from "./release-lib.mjs";

const CHANGELOG = `# Changelog

Intro text.

## [1.0.10] - 2026-12-01

### Fixed
- Ten

## [1.1.0] - 2026-11-01

### Added
- Middle feature

## [1.0.0] - 2026-10-22

First release.

### Added
- Quick capture
`;

describe("parseVersionTag", () => {
	it("accepts vX.Y.Z tags", () => {
		expect(parseVersionTag("v1.0.0")).toBe("1.0.0");
		expect(parseVersionTag("v10.20.30")).toBe("10.20.30");
	});

	it("rejects other tags", () => {
		for (const tag of ["1.0.0", "v1.0", "v1.0.0-beta", "release-1", "v1.0.0.1", "", undefined]) {
			expect(parseVersionTag(tag)).toBeNull();
		}
	});
});

describe("checkVersions", () => {
	it("returns no errors when all versions match", () => {
		expect(checkVersions("1.0.0", "1.0.0", "1.0.0")).toEqual([]);
	});

	it("reports a mismatch of manifest.json only", () => {
		const errors = checkVersions("1.0.0", "0.9.0", "1.0.0");
		expect(errors).toHaveLength(1);
		expect(errors[0]).toContain("manifest.json");
	});

	it("reports a mismatch of package.json only", () => {
		const errors = checkVersions("1.0.0", "1.0.0", "0.9.0");
		expect(errors).toHaveLength(1);
		expect(errors[0]).toContain("package.json");
	});

	it("reports both mismatches", () => {
		expect(checkVersions("2.0.0", "1.0.0", "1.0.0")).toHaveLength(2);
	});
});

describe("extractChangelogSection", () => {
	it("extracts the first, middle and last sections", () => {
		expect(extractChangelogSection(CHANGELOG, "1.0.10")).toBe("### Fixed\n- Ten");
		expect(extractChangelogSection(CHANGELOG, "1.1.0")).toBe("### Added\n- Middle feature");
		expect(extractChangelogSection(CHANGELOG, "1.0.0")).toBe("First release.\n\n### Added\n- Quick capture");
	});

	it("does not confuse similar versions", () => {
		expect(extractChangelogSection(CHANGELOG, "1.0.1")).toBeNull();
		expect(extractChangelogSection(CHANGELOG, "1.0.0")).not.toContain("Ten");
	});

	it("returns null when the section is missing or empty", () => {
		expect(extractChangelogSection(CHANGELOG, "9.9.9")).toBeNull();
		expect(extractChangelogSection("## [2.0.0] - 2027-01-01\n\n## [1.0.0] - 2026-10-22\n- x\n", "2.0.0")).toBeNull();
	});

	it("handles CRLF line endings", () => {
		expect(extractChangelogSection("## [1.0.0] - 2026-10-22\r\n- a\r\n- b\r\n", "1.0.0")).toBe("- a\n- b");
	});
});

describe("buildPackageFileUrl", () => {
	it("builds the generic package file URL", () => {
		expect(buildPackageFileUrl("https://gitlab.example.com/api/v4", "42", "1.0.0", "main.js")).toBe(
			"https://gitlab.example.com/api/v4/projects/42/packages/generic/jotline/1.0.0/main.js"
		);
	});

	it("tolerates a trailing slash in the API URL", () => {
		expect(buildPackageFileUrl("https://gitlab.example.com/api/v4/", "42", "1.0.0", "manifest.json")).toBe(
			"https://gitlab.example.com/api/v4/projects/42/packages/generic/jotline/1.0.0/manifest.json"
		);
	});
});

describe("validateRelease", () => {
	const ok = { manifestVersion: "1.0.0", packageVersion: "1.0.0", changelog: CHANGELOG };

	it("passes with matching versions and a changelog section", () => {
		const result = validateRelease("v1.0.0", ok);
		expect(result.errors).toEqual([]);
		expect(result.version).toBe("1.0.0");
		expect(result.notes).toContain("Quick capture");
	});

	it("fails for a non-version tag", () => {
		const result = validateRelease("ci-test-1", ok);
		expect(result.version).toBeNull();
		expect(result.errors).toHaveLength(1);
	});

	it("fails for a version mismatch and a missing changelog section", () => {
		const result = validateRelease("v9.9.9", ok);
		expect(result.errors).toHaveLength(3);
	});

	it("fails when CHANGELOG.md is missing", () => {
		const result = validateRelease("v1.0.0", { ...ok, changelog: null });
		expect(result.errors).toEqual(["CHANGELOG.md was not found"]);
	});
});
