CREATE SCHEMA IF NOT EXISTS "knowledge";
--> statement-breakpoint
CREATE TABLE "knowledge"."libraries" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by_type" text NOT NULL,
	"created_by_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "libraries_name_nonempty" CHECK (length(btrim("knowledge"."libraries"."name")) > 0),
	CONSTRAINT "libraries_created_by_user" CHECK ("knowledge"."libraries"."created_by_type" = 'user' AND "knowledge"."libraries"."created_by_id" = "knowledge"."libraries"."owner_id")
);
--> statement-breakpoint
ALTER TABLE "knowledge"."libraries" ADD CONSTRAINT "libraries_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "libraries_owner_created_idx" ON "knowledge"."libraries" USING btree ("owner_id","created_at");
