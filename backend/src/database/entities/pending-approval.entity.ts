import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Agent } from './agent.entity';

@Entity('pending_approvals')
export class PendingApproval {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  agent_id: string;

  @ManyToOne(() => Agent, (agent) => agent.pending_approvals)
  @JoinColumn({ name: 'agent_id' })
  agent: Agent;

  @Column()
  action: string;

  @Column()
  resource: string;

  @Column('jsonb', { nullable: true })
  context: any;

  @CreateDateColumn()
  requested_at: Date;

  @Column('timestamp', { nullable: true })
  decided_at: Date;

  @Column({ type: 'uuid', nullable: true })
  decided_by_user_id: string;

  @Column({ nullable: true })
  decision: 'approved' | 'denied';

  @Column({ nullable: true })
  reason: string;

  @Column({ default: 'pending' })
  status: 'pending' | 'approved' | 'denied';
}
