import * as schema from "@infrastructure/database/schema/index.js";

import { drizzle } from "drizzle-orm/pglite";
import { PGlite } from "@electric-sql/pglite";

const client = new PGlite();

export const db = drizzle({ client, schema });

export async function closeDatabase(): Promise<void> {
  await client.close();
}
