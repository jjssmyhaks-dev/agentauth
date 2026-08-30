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

@Entity('agent_keys')
export class AgentKey {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  agent_id: string;

  @ManyToOne(() => Agent)
  @JoinColumn({ name: 'agent_id' })
  agent: Agent;

  @Column('text')
  public_key: string;

  @Column({ default: 'active' })
  status: 'active' | 'deprecated' | 'revoked';

  @Column({ nullable: true })
  revoked_reason: string;

  @CreateDateColumn()
  created_at: Date;

  @Column('timestamp', { nullable: true })
  deprecated_at: Date;

  @Column('timestamp', { nullable: true })
  grace_period_expires_at: Date;
}
