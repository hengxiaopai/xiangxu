import { integer, pgTable, timestamp } from "drizzle-orm/pg-core";

export const bootstrapSentinel = pgTable("infra_bootstrap_sentinel", {
  id: integer("id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
