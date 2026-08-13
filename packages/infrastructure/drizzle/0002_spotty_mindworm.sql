CREATE SCHEMA IF NOT EXISTS "planning";
--> statement-breakpoint
CREATE TABLE "planning"."time_blocks" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"owner_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"timezone" text NOT NULL,
	"locked" boolean DEFAULT false NOT NULL,
	"revision" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "time_blocks_interval_valid" CHECK ("planning"."time_blocks"."end_at" > "planning"."time_blocks"."start_at"),
	CONSTRAINT "time_blocks_revision_positive" CHECK ("planning"."time_blocks"."revision" > 0)
);
--> statement-breakpoint
ALTER TABLE "planning"."time_blocks" ADD CONSTRAINT "time_blocks_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planning"."time_blocks" ADD CONSTRAINT "time_blocks_task_id_task_details_object_id_fk" FOREIGN KEY ("task_id") REFERENCES "core"."task_details"("object_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "time_blocks_owner_interval_idx" ON "planning"."time_blocks" USING btree ("owner_id","start_at","end_at");--> statement-breakpoint
CREATE INDEX "time_blocks_task_idx" ON "planning"."time_blocks" USING btree ("task_id");
