import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Agent } from './agent.entity';

@Entity('agent_usage')
@Index(['agent_id', 'hour_bucket'], { unique: true })
export class AgentUsage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  agent_id: string;

  @ManyToOne(() => Agent)
  @JoinColumn({ name: 'agent_id' })
  agent: Agent;

  @Column({ type: 'uuid' })
  org_id: string;

  // Hour bucket for time-series aggregation (truncated to hour)
  @Column('timestamp')
  @Index()
  hour_bucket: Date;

  @Column({ type: 'int', default: 0 })
  tokens_issued: number;

  @Column({ type: 'int', default: 0 })
  actions_allowed: number;

  @Column({ type: 'int', default: 0 })
  actions_denied: number;

  @Column({ type: 'int', default: 0 })
  actions_pending: number;

  @Column({ type: 'int', default: 0 })
  approvals_requested: number;

  @Column({ type: 'int', default: 0 })
  approvals_granted: number;

  @Column({ type: 'int', default: 0 })
  approvals_denied: number;

  @Column('decimal', { precision: 8, scale: 2, default: 0 })
  avg_latency_ms: number;

  @Column('decimal', { precision: 10, scale: 6, default: 0 })
  estimated_cost: number;

  @CreateDateColumn()
  created_at: Date;
}
