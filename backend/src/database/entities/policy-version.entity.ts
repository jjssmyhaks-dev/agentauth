import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

/** Immutable audit trail of every policy state, with the diff vs the previous. */
@Entity('policy_versions')
export class PolicyVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Not a FK on purpose: versions outlive the policy row (deletion tombstones).
  @Column({ type: 'uuid' })
  policy_id: string;

  // 1 = created; monotonically increasing per policy
  @Column({ type: 'int' })
  version: number;

  /** Full policy state at this version (final state for deletion tombstones). */
  @Column('jsonb')
  snapshot: Record<string, any>;

  /** Changed fields only: { field: { from, to } }. Empty for the creation version. */
  @Column('jsonb', { default: {} })
  diff: Record<string, { from: any; to: any }>;

  @Column({ default: 'created' })
  change_type: 'created' | 'updated' | 'enabled' | 'disabled' | 'deleted';

  /** Actor id/email (or 'system'). */
  @Column({ nullable: true })
  changed_by: string | null;

  @CreateDateColumn()
  created_at: Date;
}
