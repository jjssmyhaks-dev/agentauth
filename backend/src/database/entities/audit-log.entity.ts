import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Organization } from './organization.entity';

@Entity('audit_log')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  org_id: string;

  @ManyToOne(() => Organization, (org) => org.audit_logs)
  @JoinColumn({ name: 'org_id' })
  organization: Organization;

  @Column()
  actor_type: 'agent' | 'user';

  @Column({ type: 'uuid' })
  actor_id: string;

  @Column()
  action: string;

  @Column()
  resource: string;

  @Column()
  result: 'allowed' | 'denied' | 'pending';

  @CreateDateColumn()
  timestamp: Date;

  @Column('text', { nullable: true })
  prev_hash: string;

  @Column('text')
  hash: string;
}
