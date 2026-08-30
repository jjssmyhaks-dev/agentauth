import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Organization } from './organization.entity';
import { Grant } from './grant.entity';
import { TokenIssued } from './token-issued.entity';
import { PendingApproval } from './pending-approval.entity';

@Entity('agents')
export class Agent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  org_id: string;

  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'org_id' })
  organization: Organization;

  @Column()
  name: string;

  @Column('text')
  public_key: string;

  @Column({ default: 'active' })
  status: 'active' | 'revoked';

  @Column({ default: 'internal' })
  agent_tier: 'internal' | 'external';

  @Column({ nullable: true })
  approval_mode_override: 'autonomous' | 'human_in_the_loop';

  // ── Usage tracking ──
  @Column({ type: 'int', default: 0 })
  token_count: number;

  @Column({ type: 'int', default: 0 })
  total_actions: number;

  @Column('timestamp', { nullable: true })
  last_active_at: Date;

  @Column({ type: 'int', default: 0 })
  approval_count: number;

  @Column({ type: 'int', default: 0 })
  denial_count: number;

  @Column('decimal', { precision: 5, scale: 2, nullable: true })
  avg_latency_ms: number;

  @Column('timestamp', { nullable: true })
  key_rotated_at: Date;

  @Column('timestamp', { nullable: true })
  key_revoked_at: Date;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => Grant, (grant) => grant.agent)
  grants: Grant[];

  @OneToMany(() => TokenIssued, (token) => token.agent)
  tokens_issued: TokenIssued[];

  @OneToMany(() => PendingApproval, (approval) => approval.agent)
  pending_approvals: PendingApproval[];
}
