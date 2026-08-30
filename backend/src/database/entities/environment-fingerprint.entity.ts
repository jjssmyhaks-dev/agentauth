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

@Entity('environment_fingerprints')
export class EnvironmentFingerprint {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  agent_id: string;

  @ManyToOne(() => Agent)
  @JoinColumn({ name: 'agent_id' })
  agent: Agent;

  @Column()
  fingerprint_hash: string;

  // Human-readable environment description
  @Column('jsonb', { default: {} })
  environment_info: {
    os?: string;
    arch?: string;
    container_id?: string;
    ip_range?: string;
    asn?: string;
    attestation_token?: string;
    platform?: string;
  };

  @Column({ default: false })
  trusted: boolean;

  @Column({ type: 'int', default: 0 })
  use_count: number;

  @CreateDateColumn()
  first_seen_at: Date;

  @UpdateDateColumn()
  last_seen_at: Date;
}
