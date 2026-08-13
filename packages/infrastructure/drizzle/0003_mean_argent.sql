CREATE SCHEMA IF NOT EXISTS "capture";
--> statement-breakpoint
CREATE SCHEMA IF NOT EXISTS "ai";
--> statement-breakpoint
CREATE TABLE "capture"."capture_items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"owner_id" uuid NOT NULL,
	"raw_payload_id" uuid NOT NULL,
	"parse_status" text DEFAULT 'pending' NOT NULL,
	"triage_status" text DEFAULT 'untriaged' NOT NULL,
	"revision" bigint DEFAULT 1 NOT NULL,
	"proposal_id" uuid,
	"materialized_object_ids" uuid[] DEFAULT ARRAY[]::uuid[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "capture_items_parse_status" CHECK ("capture"."capture_items"."parse_status" IN ('pending','parsed','failed','partial')),
	CONSTRAINT "capture_items_triage_status" CHECK ("capture"."capture_items"."triage_status" IN ('untriaged','proposal_ready','needs_review','accepted','archived')),
	CONSTRAINT "capture_items_revision_positive" CHECK ("capture"."capture_items"."revision" > 0)
);
--> statement-breakpoint
CREATE TABLE "ai"."proposal_targets" (
	"proposal_id" uuid NOT NULL,
	"target_type" text NOT NULL,
	"target_id" uuid NOT NULL,
	"base_revision" bigint NOT NULL,
	CONSTRAINT "proposal_targets_proposal_id_target_type_target_id_pk" PRIMARY KEY("proposal_id","target_type","target_id"),
	CONSTRAINT "proposal_targets_type" CHECK ("ai"."proposal_targets"."target_type" IN ('task','time_block','capture_item','raw_payload','proposal','plan_snapshot','execution_record','review_snapshot','change_record')),
	CONSTRAINT "proposal_targets_base_revision_positive" CHECK ("ai"."proposal_targets"."base_revision" > 0)
);
--> statement-breakpoint
CREATE TABLE "ai"."proposals" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"proposal_type" text NOT NULL,
	"structured_patch" jsonb NOT NULL,
	"rationale" text NOT NULL,
	"evidence_refs" jsonb NOT NULL,
	"impact_summary" text NOT NULL,
	"risk_level" text NOT NULL,
	"status" text NOT NULL,
	"created_by_type" text NOT NULL,
	"created_by_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "proposals_type" CHECK ("ai"."proposals"."proposal_type" IN ('classify','reprioritize','reschedule','relate','create','update','memory','review_suggestion')),
	CONSTRAINT "proposals_risk" CHECK ("ai"."proposals"."risk_level" IN ('low','medium','high')),
	CONSTRAINT "proposals_status" CHECK ("ai"."proposals"."status" IN ('draft','ready','applied','rejected','expired','cancelled')),
	CONSTRAINT "proposals_created_by_type" CHECK ("ai"."proposals"."created_by_type" IN ('user','system','ai','connector')),
	CONSTRAINT "proposals_text_nonempty" CHECK (length("ai"."proposals"."rationale") > 0 AND length("ai"."proposals"."impact_summary") > 0)
);
--> statement-breakpoint
CREATE TABLE "capture"."raw_payloads" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"owner_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"text_content" text NOT NULL,
	"content_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "raw_payloads_kind_text" CHECK ("capture"."raw_payloads"."kind" = 'text'),
	CONSTRAINT "raw_payloads_text_nonempty" CHECK (length("capture"."raw_payloads"."text_content") > 0),
	CONSTRAINT "raw_payloads_content_hash_sha256" CHECK ("capture"."raw_payloads"."content_hash" ~ '^sha256:[0-9a-f]{64}$')
);
--> statement-breakpoint
ALTER TABLE "capture"."capture_items" ADD CONSTRAINT "capture_items_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capture"."capture_items" ADD CONSTRAINT "capture_items_raw_payload_id_raw_payloads_id_fk" FOREIGN KEY ("raw_payload_id") REFERENCES "capture"."raw_payloads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai"."proposal_targets" ADD CONSTRAINT "proposal_targets_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "ai"."proposals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capture"."raw_payloads" ADD CONSTRAINT "raw_payloads_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "capture_items_raw_payload_unique" ON "capture"."capture_items" USING btree ("raw_payload_id");--> statement-breakpoint
CREATE INDEX "capture_items_owner_triage_idx" ON "capture"."capture_items" USING btree ("owner_id","triage_status","created_at");--> statement-breakpoint
CREATE INDEX "proposal_targets_target_idx" ON "ai"."proposal_targets" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "proposals_status_created_idx" ON "ai"."proposals" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "raw_payloads_owner_created_idx" ON "capture"."raw_payloads" USING btree ("owner_id","created_at");
