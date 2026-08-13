CREATE TABLE "planning"."execution_records" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"owner_id" uuid NOT NULL,
	"target_object_id" uuid NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone NOT NULL,
	"duration_minutes" integer NOT NULL,
	"outcome" text NOT NULL,
	"source" text NOT NULL,
	"plan_snapshot_id" uuid,
	"time_block_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "execution_records_interval_valid" CHECK ("planning"."execution_records"."ended_at" > "planning"."execution_records"."started_at"),
	CONSTRAINT "execution_records_duration_positive" CHECK ("planning"."execution_records"."duration_minutes" > 0),
	CONSTRAINT "execution_records_outcome" CHECK ("planning"."execution_records"."outcome" IN ('completed','partial','stopped','interrupted')),
	CONSTRAINT "execution_records_source" CHECK ("planning"."execution_records"."source" IN ('focus_mode','manual','import'))
);
--> statement-breakpoint
CREATE TABLE "planning"."plan_snapshot_items" (
	"plan_snapshot_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"item_order" integer NOT NULL,
	"time_block_ids" uuid[] DEFAULT ARRAY[]::uuid[] NOT NULL,
	CONSTRAINT "plan_snapshot_items_plan_snapshot_id_task_id_pk" PRIMARY KEY("plan_snapshot_id","task_id"),
	CONSTRAINT "plan_snapshot_items_order_positive" CHECK ("planning"."plan_snapshot_items"."item_order" > 0)
);
--> statement-breakpoint
CREATE TABLE "planning"."plan_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"owner_id" uuid NOT NULL,
	"local_date" date NOT NULL,
	"timezone" text NOT NULL,
	"version" integer NOT NULL,
	"capacity_minutes" integer NOT NULL,
	"assumptions_and_evidence" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"committed_by_type" text NOT NULL,
	"committed_by_id" uuid NOT NULL,
	"committed_at" timestamp with time zone NOT NULL,
	CONSTRAINT "plan_snapshots_version_positive" CHECK ("planning"."plan_snapshots"."version" > 0),
	CONSTRAINT "plan_snapshots_capacity_nonnegative" CHECK ("planning"."plan_snapshots"."capacity_minutes" >= 0),
	CONSTRAINT "plan_snapshots_committed_by_type" CHECK ("planning"."plan_snapshots"."committed_by_type" IN ('user','system','connector'))
);
--> statement-breakpoint
CREATE TABLE "planning"."review_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"owner_id" uuid NOT NULL,
	"local_date" date NOT NULL,
	"timezone" text NOT NULL,
	"version" integer NOT NULL,
	"baseline_plan_snapshot_id" uuid NOT NULL,
	"final_plan_snapshot_id" uuid NOT NULL,
	"execution_record_ids" uuid[] DEFAULT ARRAY[]::uuid[] NOT NULL,
	"what_changed" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"deterministic_metrics" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ai_insight_refs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"tomorrow_proposal_id" uuid,
	"user_reflection_note_id" uuid,
	"created_by_type" text NOT NULL,
	"created_by_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "review_snapshots_version_positive" CHECK ("planning"."review_snapshots"."version" > 0),
	CONSTRAINT "review_snapshots_created_by_type" CHECK ("planning"."review_snapshots"."created_by_type" IN ('user','system','connector'))
);
--> statement-breakpoint
ALTER TABLE "planning"."execution_records" ADD CONSTRAINT "execution_records_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planning"."execution_records" ADD CONSTRAINT "execution_records_target_object_id_task_details_object_id_fk" FOREIGN KEY ("target_object_id") REFERENCES "core"."task_details"("object_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planning"."execution_records" ADD CONSTRAINT "execution_records_plan_snapshot_id_plan_snapshots_id_fk" FOREIGN KEY ("plan_snapshot_id") REFERENCES "planning"."plan_snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planning"."execution_records" ADD CONSTRAINT "execution_records_time_block_id_time_blocks_id_fk" FOREIGN KEY ("time_block_id") REFERENCES "planning"."time_blocks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planning"."plan_snapshot_items" ADD CONSTRAINT "plan_snapshot_items_plan_snapshot_id_plan_snapshots_id_fk" FOREIGN KEY ("plan_snapshot_id") REFERENCES "planning"."plan_snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planning"."plan_snapshot_items" ADD CONSTRAINT "plan_snapshot_items_task_id_task_details_object_id_fk" FOREIGN KEY ("task_id") REFERENCES "core"."task_details"("object_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planning"."plan_snapshots" ADD CONSTRAINT "plan_snapshots_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planning"."review_snapshots" ADD CONSTRAINT "review_snapshots_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planning"."review_snapshots" ADD CONSTRAINT "review_snapshots_baseline_plan_snapshot_id_plan_snapshots_id_fk" FOREIGN KEY ("baseline_plan_snapshot_id") REFERENCES "planning"."plan_snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planning"."review_snapshots" ADD CONSTRAINT "review_snapshots_final_plan_snapshot_id_plan_snapshots_id_fk" FOREIGN KEY ("final_plan_snapshot_id") REFERENCES "planning"."plan_snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planning"."review_snapshots" ADD CONSTRAINT "review_snapshots_tomorrow_proposal_id_proposals_id_fk" FOREIGN KEY ("tomorrow_proposal_id") REFERENCES "ai"."proposals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "execution_records_owner_started_idx" ON "planning"."execution_records" USING btree ("owner_id","started_at");--> statement-breakpoint
CREATE INDEX "execution_records_target_idx" ON "planning"."execution_records" USING btree ("target_object_id","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "plan_snapshot_items_order_unique" ON "planning"."plan_snapshot_items" USING btree ("plan_snapshot_id","item_order");--> statement-breakpoint
CREATE UNIQUE INDEX "plan_snapshots_owner_date_version_unique" ON "planning"."plan_snapshots" USING btree ("owner_id","local_date","version");--> statement-breakpoint
CREATE INDEX "plan_snapshots_owner_date_lookup_idx" ON "planning"."plan_snapshots" USING btree ("owner_id","local_date","version");--> statement-breakpoint
CREATE UNIQUE INDEX "review_snapshots_owner_date_version_unique" ON "planning"."review_snapshots" USING btree ("owner_id","local_date","version");--> statement-breakpoint
CREATE INDEX "review_snapshots_owner_date_lookup_idx" ON "planning"."review_snapshots" USING btree ("owner_id","local_date","version");