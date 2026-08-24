import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Agent } from './agent.entity';
import { Organization } from './organization.entity';

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

  @ManyToOne(() => Organization, (org) => org.grants)
  @JoinColumn({ name: 'org_id' })
  organization: Organization;

  @Column()
  resource_type: string;

  @Column()
  resource_pattern: string;

  @Column('simple-array')
  allowed_actions: string[];

  @Column({ type: 'uuid' })
  created_by_user_id: string;

  @Column('timestamp', { nullable: true })
  expires_at: Date;

  @Column('timestamp', { nullable: true })
  revoked_at: Date;

  @Column({ nullable: true })
  usage_cap: number;

  @Column({ default: 0 })
  usage_count: number;

  @CreateDateColumn()
  created_at: Date;

  @Column({ default: 'active' })
  status: 'active' | 'expired' | 'revoked';
}
