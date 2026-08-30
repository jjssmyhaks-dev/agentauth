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

@Entity('trust_events')
export class TrustEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  agent_id: string;

  @ManyToOne(() => Agent)
  @JoinColumn({ name: 'agent_id' })
  agent: Agent;

  @Column()
  event_type: string; // new_ip | new_host_fingerprint | unusual_action_volume | off_hours_activity | permission_denied_spike | concurrent_key_use | key_rotated | session_mismatch

  @Column({ default: 'info' })
  severity: 'info' | 'warning' | 'critical';

  @Column('jsonb', { default: {} })
  raw_context: Record<string, any>;

  @Column({ type: 'int', default: 0 })
  trust_delta: number;

  @CreateDateColumn()
  timestamp: Date;
}
