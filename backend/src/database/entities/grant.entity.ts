import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Agent } from './agent.entity';

@Entity('grants')
export class Grant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  agent_id: string;

  @ManyToOne(() => Agent, (agent) => agent.grants)
  @JoinColumn({ name: 'agent_id' })
  agent: Agent;

  @Column({ type: 'uuid' })
  org_id: string;

  @Column()
  resource_type: string;

  @Column()
  resource_pattern: string;

  @Column('simple-array')
  allowed_actions: string[];

  @Column({ type: 'uuid', nullable: true })
  created_by_user_id: string;

  @Column({ type: 'timestamp', nullable: true })
  expires_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  revoked_at: Date;

  @Column({ type: 'int', nullable: true })
  usage_cap: number;

  @Column({ type: 'int', default: 0 })
  usage_count: number;

  @Column({ default: 'active' })
  status: 'active' | 'expired' | 'revoked';

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
