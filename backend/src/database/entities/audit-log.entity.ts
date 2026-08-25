import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('audit_log')
@Index(['org_id', 'timestamp'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  org_id: string;

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

  @Column()
  timestamp: Date;

  @Column()
  prev_hash: string;

  @Column()
  hash: string;

  @CreateDateColumn()
  created_at: Date;
}
