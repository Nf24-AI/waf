/**
 * Creates the Meeting Prep database in Notion with the exact schema the
 * adapter expects, then prints the id to put in NOTION_DATABASE_ID.
 *
 *   1. Create an internal integration at notion.so/my-integrations
 *   2. Put its secret in NOTION_API_TOKEN
 *   3. Open the Notion page that should hold the database, and connect the
 *      integration to it (••• menu -> Connections)
 *   4. NOTION_PARENT_PAGE_ID=<that page id> npx tsx scripts/setup-notion.ts
 *
 * Safe to re-run: it only ever creates a new database, never edits one.
 */
import "dotenv/config";

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

const token = process.env.NOTION_API_TOKEN ?? "";
const parentPageId = (process.env.NOTION_PARENT_PAGE_ID ?? "").replace(/-/g, "");

async function notion<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${NOTION_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`Notion API ${response.status}: ${body}`);
  return (body ? JSON.parse(body) : undefined) as T;
}

async function main() {
  if (!token) {
    console.error("NOTION_API_TOKEN is not set. Add it to .env first.");
    process.exit(1);
  }
  if (!parentPageId) {
    console.error(
      "NOTION_PARENT_PAGE_ID is not set.\n" +
        "Open the Notion page that should hold the database, copy the 32-character\n" +
        "id from its URL, connect your integration to that page, then re-run."
    );
    process.exit(1);
  }

  const me = await notion<{ name?: string }>("/users/me");
  console.log(`Authenticated as integration: ${me.name ?? "(unnamed)"}`);

  const database = await notion<{ id: string; url?: string }>("/databases", {
    method: "POST",
    body: JSON.stringify({
      parent: { type: "page_id", page_id: parentPageId },
      title: [{ type: "text", text: { content: "Meeting Prep" } }],
      properties: {
        // Property names and types match what server/notion.ts reads and writes.
        Name: { title: {} },
        Date: { date: {} },
        Type: {
          select: {
            options: [
              { name: "داخلي" }, { name: "مع شريك تأميني" }, { name: "إدارة" },
              { name: "Internal" }, { name: "Partner" }, { name: "Leadership" },
              { name: "أخرى" },
            ],
          },
        },
        Attendees: { rich_text: {} },
        Status: {
          select: {
            options: [
              { name: "Not started" }, { name: "In progress" }, { name: "Done" },
            ],
          },
        },
        Summary: { rich_text: {} },
        "External link": { url: {} },
      },
    }),
  });

  console.log("\nDatabase created.");
  console.log(`  URL: ${database.url ?? "(not returned)"}`);
  console.log(`\nAdd this line to .env:\n  NOTION_DATABASE_ID=${database.id.replace(/-/g, "")}\n`);
}

main().catch((error) => {
  console.error("\nSetup failed:", error instanceof Error ? error.message : error);
  console.error(
    "\nIf this is a 404, the integration is not connected to the parent page.\n" +
      "Open the page in Notion, use the ••• menu -> Connections, and add your integration."
  );
  process.exit(1);
});
