import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
  path: path.resolve(__dirname, "../.env"),
});

const url = (process.env.VECTOR_DB_URL || "").replace(/\/$/, "");
const apiKey = process.env.VECTOR_DB_API_KEY;

console.log("Qdrant URL configured:", Boolean(url));
console.log("Qdrant API key configured:", Boolean(apiKey));

if (!url || !apiKey) {
  console.error("❌ Qdrant configuration missing");
  process.exit(1);
}

const indexes = [
  {
    field_name: "corpus",
    field_schema: "keyword",
  },
  {
    field_name: "type",
    field_schema: "keyword",
  },
];

for (const index of indexes) {
  console.log(`\nCreating index: ${index.field_name}`);

  const response = await fetch(
    `${url}/collections/aman_portfolio/index?wait=true`,
    {
      method: "PUT",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(index),
    }
  );

  console.log("HTTP:", response.status);
  console.log(await response.text());
}