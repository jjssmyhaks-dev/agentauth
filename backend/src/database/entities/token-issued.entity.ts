import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Agent } from './agent.entity';

@Entity('tokens_issued')
export class TokenIssued {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  agent_id: string;

  @ManyToOne(() => Agent, (agent) => agent.tokens_issued)
  @JoinColumn({ name: 'agent_id' })
  agent: Agent;

  @Column({ unique: true })
  jti: string;

  @CreateDateColumn()
  issued_at: Date;

  @Column('timestamp')
  expires_at: Date;

  @Column('jsonb')
  scopes_snapshot: any;
}
