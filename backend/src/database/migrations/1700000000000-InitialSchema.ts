import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1700000000000 implements MigrationInterface {
  name = 'InitialSchema1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Organizations
    await queryRunner.query(`
      CREATE TABLE "organizations" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" varchar NOT NULL,
        "default_approval_mode" varchar NOT NULL DEFAULT 'human_in_the_loop',
        "action_overrides" jsonb DEFAULT '{}',
        "created_at" timestamp DEFAULT now()
      )
    `);

    // Users
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "org_id" uuid NOT NULL,
        "email" varchar NOT NULL,
        "role" varchar NOT NULL DEFAULT 'member',
        "created_at" timestamp DEFAULT now(),
        CONSTRAINT "fk_users_org" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX "idx_users_email" ON "users" ("email")`);

    // Agents
    await queryRunner.query(`
      CREATE TABLE "agents" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "org_id" uuid NOT NULL,
        "name" varchar NOT NULL,
        "public_key" text NOT NULL,
        "status" varchar NOT NULL DEFAULT 'active',
        "approval_mode_override" varchar,
        "key_rotated_at" timestamp,
        "key_revoked_at" timestamp,
        "created_at" timestamp DEFAULT now(),
        CONSTRAINT "fk_agents_org" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_agents_org" ON "agents" ("org_id")`);
    await queryRunner.query(`CREATE INDEX "idx_agents_status" ON "agents" ("status")`);

    // Grants
    await queryRunner.query(`
      CREATE TABLE "grants" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "agent_id" uuid NOT NULL,
        "resource_type" varchar NOT NULL,
        "resource_pattern" varchar NOT NULL DEFAULT '*',
        "allowed_actions" jsonb NOT NULL DEFAULT '[]',
        "created_by_user_id" uuid,
        "expires_at" timestamp,
        "revoked_at" timestamp,
        "usage_cap" integer,
        "usage_count" integer NOT NULL DEFAULT 0,
        "status" varchar NOT NULL DEFAULT 'active',
        "created_at" timestamp DEFAULT now(),
        CONSTRAINT "fk_grants_agent" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_grants_agent" ON "grants" ("agent_id")`);
    await queryRunner.query(`CREATE INDEX "idx_grants_status" ON "grants" ("status")`);

    // Tokens Issued
    await queryRunner.query(`
      CREATE TABLE "tokens_issued" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "agent_id" uuid NOT NULL,
        "jti" varchar NOT NULL,
        "issued_at" timestamp DEFAULT now(),
        "expires_at" timestamp NOT NULL,
        "scopes_snapshot" jsonb DEFAULT '[]',
        CONSTRAINT "fk_tokens_agent" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX "idx_tokens_jti" ON "tokens_issued" ("jti")`);

    // Pending Approvals
    await queryRunner.query(`
      CREATE TABLE "pending_approvals" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "agent_id" uuid NOT NULL,
        "action" varchar NOT NULL,
        "resource" varchar NOT NULL,
        "context" jsonb DEFAULT '{}',
        "status" varchar NOT NULL DEFAULT 'pending',
        "decision" varchar,
        "decided_by_user_id" uuid,
        "decided_at" timestamp,
        "reason" varchar,
        "requested_at" timestamp DEFAULT now(),
        CONSTRAINT "fk_approvals_agent" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_approvals_status" ON "pending_approvals" ("status")`);

    // Audit Log
    await queryRunner.query(`
      CREATE TABLE "audit_log" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "org_id" uuid NOT NULL,
        "actor_type" varchar NOT NULL,
        "actor_id" varchar NOT NULL,
        "action" varchar NOT NULL,
        "resource" varchar NOT NULL,
        "result" varchar NOT NULL,
        "timestamp" timestamp DEFAULT now(),
        "prev_hash" varchar,
        "hash" varchar NOT NULL,
        CONSTRAINT "fk_audit_org" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_audit_org" ON "audit_log" ("org_id")`);
    await queryRunner.query(`CREATE INDEX "idx_audit_timestamp" ON "audit_log" ("timestamp")`);

    // Webhooks
    await queryRunner.query(`
      CREATE TABLE "webhooks" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "org_id" uuid NOT NULL,
        "url" varchar NOT NULL,
        "event_types" jsonb NOT NULL DEFAULT '[]',
        "secret" varchar NOT NULL,
        "status" varchar NOT NULL DEFAULT 'active',
        "failure_count" integer NOT NULL DEFAULT 0,
        "created_at" timestamp DEFAULT now(),
        CONSTRAINT "fk_webhooks_org" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_webhooks_org" ON "webhooks" ("org_id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "webhooks"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_log"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "pending_approvals"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tokens_issued"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "grants"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "agents"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "organizations"`);
  }
}
