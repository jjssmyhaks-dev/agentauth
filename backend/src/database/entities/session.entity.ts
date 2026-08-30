import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Agent } from './agent.entity';

@Entity('sessions')
export class Session {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  agent_id: string;

  @ManyToOne(() => Agent)
  @JoinColumn({ name: 'agent_id' })
  agent: Agent;

  @Column({ type: 'uuid', nullable: true })
  token_jti: string;

  // Context fingerprint bound at issuance time
  @Column('jsonb', { default: {} })
  context_fingerprint: {
    source_ip?: string;
    ip_range?: string;
    host_fingerprint?: string;
    orchestrator_id?: string;
  };

  @Column({ default: 'active' })
  status: 'active' | 'revoke_pending' | 'revoked';

  @Column({ nullable: true })
  revoke_reason: string;

  @Column('timestamp', { nullable: true })
  revoked_at: Date;

  @Column('timestamp', { nullable: true })
  expires_at: Date;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
