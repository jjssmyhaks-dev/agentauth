import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRLSPolicies1700000000001 implements MigrationInterface {
  name = 'AddRLSPolicies1700000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enable RLS on all org-scoped tables
    const tables = [
      'users',
      'agents',
      'grants',
      'tokens_issued',
      'pending_approvals',
      'audit_log',
      'webhooks',
    ];

    for (const table of tables) {
      // Enable RLS
      await queryRunner.query(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);

      // Create policy: org_id must match the current setting
      // Uses SET app.current_org_id = '<uuid>' before queries
      await queryRunner.query(`
        CREATE POLICY "org_isolation_${table}" ON "${table}"
        FOR ALL
        USING ("org_id" = current_setting('app.current_org_id')::uuid)
        WITH CHECK ("org_id" = current_setting('app.current_org_id')::uuid)
      `);
    }

    // Grant usage to the application role
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'agentauth_app') THEN
          CREATE ROLE agentauth_app LOGIN;
        END IF;
      END $$;
    `);

    for (const table of tables) {
      await queryRunner.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON "${table}" TO agentauth_app`);
    }

    // Create a helper function to set org context
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION set_org_context(org_id UUID)
      RETURNS void AS $$
      BEGIN
        PERFORM set_config('app.current_org_id', org_id::text, true);
      END;
      $$ LANGUAGE plpgsql;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP FUNCTION IF EXISTS set_org_context`);

    const tables = [
      'users',
      'agents',
      'grants',
      'tokens_issued',
      'pending_approvals',
      'audit_log',
      'webhooks',
    ];

    for (const table of tables) {
      await queryRunner.query(`DROP POLICY IF EXISTS "org_isolation_${table}" ON "${table}"`);
      await queryRunner.query(`ALTER TABLE "${table}" DISABLE ROW LEVEL SECURITY`);
    }

    await queryRunner.query(`DROP ROLE IF EXISTS agentauth_app`);
  }
}
