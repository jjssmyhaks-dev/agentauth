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

@Entity('trust_scores')
export class TrustScore {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  agent_id: string;

  @ManyToOne(() => Agent)
  @JoinColumn({ name: 'agent_id' })
  agent: Agent;

  // 0-100 score
  @Column({ type: 'int', default: 50 })
  score: number;

  @Column({ default: 'normal' })
  level: 'trusted' | 'normal' | 'questionable' | 'untrusted';

  @Column('timestamp', { nullable: true })
  last_calculated_at: Date;

  @Column('jsonb', { default: [] })
  contributing_factors: Array<{
    factor: string;
    delta: number;
    timestamp: string;
    context?: any;
  }>;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
