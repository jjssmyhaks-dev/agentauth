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

  @Column()
  jti: string;

  @CreateDateColumn()
  issued_at: Date;

  @Column()
  expires_at: Date;

  @Column({ type: 'jsonb', default: '[]' })
  scopes_snapshot: any[];

  @Column({ nullable: true })
  revoked: boolean;
}
