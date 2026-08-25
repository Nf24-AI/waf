import { describe, expect, it } from "vitest";

const token = process.env.NOTION_API_TOKEN;
const databaseId = process.env.NOTION_DATABASE_ID;
const configured = Boolean(token && databaseId);

/**
 * Live connection check. Skipped when Notion is not configured, so a fresh
 * clone can run `pnpm test` green before credentials exist. Set
 * NOTION_API_TOKEN and NOTION_DATABASE_ID to enable it.
 */
describe.skipIf(!configured)("Notion connection", () => {
  it("authenticates and can read the configured meeting database", async () => {
    const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": "2022-06-28",
      },
    });

    const body = await response.text();
    expect(response.status, body).toBe(200);
  }, 15_000);

  it("exposes every property the meeting adapter needs", async () => {
    const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": "2022-06-28",
      },
    });
    const database = (await response.json()) as {
      properties: Record<string, { type: string }>;
    };

    const types = Object.values(database.properties).map((property) => property.type);
    // The adapter matches by type, so the names may be Arabic or English.
    expect(types, "a title property").toContain("title");
    expect(types, "a date property").toContain("date");
    expect(types, "a url property for the external link").toContain("url");
    expect(
      types.includes("status") || types.includes("select"),
      "a status or select property"
    ).toBe(true);
  }, 15_000);
});
