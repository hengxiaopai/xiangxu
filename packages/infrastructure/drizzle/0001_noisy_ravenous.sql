CREATE SCHEMA IF NOT EXISTS "identity";
--> statement-breakpoint
CREATE SCHEMA IF NOT EXISTS "core";
--> statement-breakpoint
CREATE SCHEMA IF NOT EXISTS "audit";
--> statement-breakpoint
CREATE SCHEMA IF NOT EXISTS "infra";
--> statement-breakpoint
CREATE TABLE "audit"."change_records" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"target_type" text NOT NULL,
	"target_id" uuid NOT NULL,
	"base_revision" bigint NOT NULL,
	"new_revision" bigint NOT NULL,
	"actor_type" text NOT NULL,
	"actor_id" uuid NOT NULL,
	"command" text NOT NULL,
	"changed_field_families" jsonb NOT NULL,
	"patch_before" jsonb NOT NULL,
	"patch_after" jsonb NOT NULL,
	"source_context" jsonb NOT NULL,
	"command_id" uuid NOT NULL,
	"correlation_id" uuid NOT NULL,
	"proposal_id" uuid,
	"undo_of" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "change_records_revisions_positive" CHECK ("audit"."change_records"."base_revision" > 0 AND "audit"."change_records"."new_revision" > 0),
	CONSTRAINT "change_records_actor_type" CHECK ("audit"."change_records"."actor_type" IN ('user', 'system', 'connector'))
);
--> statement-breakpoint
CREATE TABLE "identity"."device_sessions" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "device_sessions_expiry_after_creation" CHECK ("identity"."device_sessions"."expires_at" > "identity"."device_sessions"."created_at")
);
--> statement-breakpoint
CREATE TABLE "infra"."idempotency_keys" (
	"actor_type" text NOT NULL,
	"actor_id" uuid NOT NULL,
	"command_type" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"request_fingerprint" text NOT NULL,
	"state" text DEFAULT 'in_progress' NOT NULL,
	"stored_status" integer,
	"stored_body" jsonb,
	"stored_etag_revision" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "idempotency_keys_actor_type_actor_id_command_type_idempotency_key_pk" PRIMARY KEY("actor_type","actor_id","command_type","idempotency_key"),
	CONSTRAINT "idempotency_actor_type" CHECK ("infra"."idempotency_keys"."actor_type" IN ('user', 'system', 'ai', 'connector')),
	CONSTRAINT "idempotency_state" CHECK ("infra"."idempotency_keys"."state" IN ('in_progress', 'completed')),
	CONSTRAINT "idempotency_etag_positive" CHECK ("infra"."idempotency_keys"."stored_etag_revision" IS NULL OR "infra"."idempotency_keys"."stored_etag_revision" > 0)
);
--> statement-breakpoint
CREATE TABLE "core"."objects" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"object_type" text NOT NULL,
	"title" text NOT NULL,
	"owner_id" uuid NOT NULL,
	"status" text NOT NULL,
	"source_kind" text DEFAULT 'manual' NOT NULL,
	"schema_version" smallint DEFAULT 1 NOT NULL,
	"revision" bigint DEFAULT 1 NOT NULL,
	"created_by_type" text NOT NULL,
	"created_by_id" uuid NOT NULL,
	"updated_by_type" text NOT NULL,
	"updated_by_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "objects_type_task" CHECK ("core"."objects"."object_type" = 'task'),
	CONSTRAINT "objects_task_status" CHECK ("core"."objects"."status" IN ('open', 'in_progress', 'waiting', 'completed', 'cancelled')),
	CONSTRAINT "objects_source_kind" CHECK ("core"."objects"."source_kind" IN ('manual', 'capture', 'connector', 'import', 'ai_assisted', 'system')),
	CONSTRAINT "objects_actor_types" CHECK ("core"."objects"."created_by_type" IN ('user', 'system', 'ai', 'connector') AND "core"."objects"."updated_by_type" IN ('user', 'system', 'ai', 'connector')),
	CONSTRAINT "objects_revision_positive" CHECK ("core"."objects"."revision" > 0),
	CONSTRAINT "objects_schema_version_positive" CHECK ("core"."objects"."schema_version" > 0)
);
--> statement-breakpoint
CREATE TABLE "infra"."outbox_events" (
	"sequence" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "infra"."outbox_events_sequence_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"id" uuid DEFAULT uuidv7() NOT NULL,
	"topic" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" uuid NOT NULL,
	"revision" bigint,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"claimed_at" timestamp with time zone,
	"claimed_by" text,
	"published_at" timestamp with time zone,
	"last_error" text,
	"command_id" uuid NOT NULL,
	"correlation_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "outbox_events_topic" CHECK ("infra"."outbox_events"."topic" IN ('object.changed', 'proposal.ready')),
	CONSTRAINT "outbox_events_status" CHECK ("infra"."outbox_events"."status" IN ('pending', 'claimed', 'published', 'failed')),
	CONSTRAINT "outbox_events_attempts_nonnegative" CHECK ("infra"."outbox_events"."attempts" >= 0),
	CONSTRAINT "outbox_events_revision_positive" CHECK ("infra"."outbox_events"."revision" IS NULL OR "infra"."outbox_events"."revision" > 0)
);
--> statement-breakpoint
CREATE TABLE "core"."task_details" (
	"object_id" uuid PRIMARY KEY NOT NULL,
	"commitment_state" text NOT NULL,
	"due_on" date,
	"due_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	CONSTRAINT "task_details_commitment" CHECK ("core"."task_details"."commitment_state" IN ('committed', 'someday')),
	CONSTRAINT "task_details_single_due" CHECK ("core"."task_details"."due_on" IS NULL OR "core"."task_details"."due_at" IS NULL)
);
--> statement-breakpoint
CREATE TABLE "identity"."users" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"dev_subject" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "identity"."device_sessions" ADD CONSTRAINT "device_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."objects" ADD CONSTRAINT "objects_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."task_details" ADD CONSTRAINT "task_details_object_id_objects_id_fk" FOREIGN KEY ("object_id") REFERENCES "core"."objects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "change_records_target_idx" ON "audit"."change_records" USING btree ("target_type","target_id","created_at");--> statement-breakpoint
CREATE INDEX "change_records_correlation_idx" ON "audit"."change_records" USING btree ("correlation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "device_sessions_token_hash_unique" ON "identity"."device_sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "device_sessions_user_active_idx" ON "identity"."device_sessions" USING btree ("user_id","expires_at");--> statement-breakpoint
CREATE INDEX "idempotency_created_idx" ON "infra"."idempotency_keys" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "objects_owner_lookup_idx" ON "core"."objects" USING btree ("owner_id","object_type","status","deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "outbox_events_id_unique" ON "infra"."outbox_events" USING btree ("id");--> statement-breakpoint
CREATE INDEX "outbox_events_pending_idx" ON "infra"."outbox_events" USING btree ("status","available_at","sequence");--> statement-breakpoint
CREATE INDEX "outbox_events_correlation_idx" ON "infra"."outbox_events" USING btree ("correlation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_dev_subject_unique" ON "identity"."users" USING btree ("dev_subject");
--> statement-breakpoint
CREATE FUNCTION "audit"."reject_change_record_mutation"() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	RAISE EXCEPTION 'audit.change_records is append-only';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "change_records_append_only"
BEFORE UPDATE OR DELETE ON "audit"."change_records"
FOR EACH ROW EXECUTE FUNCTION "audit"."reject_change_record_mutation"();
