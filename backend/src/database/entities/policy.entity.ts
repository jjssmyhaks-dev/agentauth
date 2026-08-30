import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Organization } from './organization.entity';

@Entity('policies')
export class Policy {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  org_id: string;

  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'org_id' })
  organization: Organization;

  // agent_id | agent_group_id | org-wide
  @Column({ default: 'org' })
  scope: 'org' | 'agent' | 'agent_group';

  // Scoped target ID (agent_id or group_id) — null for org-wide
  @Column({ type: 'uuid', nullable: true })
  scope_target_id: string | null;

  @Column()
  trigger: string; // new_environment | trust_below_threshold | session_mismatch | off_hours | resource_sensitivity_high

  @Column('jsonb', { default: {} })
  condition: Record<string, any>;

  @Column()
  action: 'allow' | 'require_approval' | 'step_up' | 'deny';

  @Column({ type: 'int', default: 0 })
  priority: number;

  @Column({ default: true })
  enabled: boolean;

  @Column({ nullable: true })
  description: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
