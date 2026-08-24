import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { Agent } from './agent.entity';
import { Grant } from './grant.entity';
import { AuditLog } from './audit-log.entity';
import { Webhook } from './webhook.entity';
import { User } from './user.entity';

@Entity('organizations')
export class Organization {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @CreateDateColumn()
  created_at: Date;

  @Column({ default: 'autonomous' })
  default_approval_mode: 'autonomous' | 'human_in_the_loop';

  @OneToMany(() => Agent, (agent) => agent.organization)
  agents: Agent[];

  @OneToMany(() => User, (user) => user.organization)
  users: User[];

  @OneToMany(() => Grant, (grant) => grant.organization)
  grants: Grant[];

  @OneToMany(() => AuditLog, (log) => log.organization)
  audit_logs: AuditLog[];

  @OneToMany(() => Webhook, (webhook) => webhook.organization)
  webhooks: Webhook[];
}
