import type * as schema from "@infrastructure/database/schema/index.js";

import type { PgDatabase } from "drizzle-orm/pg-core";
import type { NodePgQueryResultHKT } from "drizzle-orm/node-postgres";

export type DbExecutor = PgDatabase<NodePgQueryResultHKT, typeof schema>;
