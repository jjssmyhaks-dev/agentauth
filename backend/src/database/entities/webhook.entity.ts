import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('webhooks')
export class Webhook {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  org_id: string;

  @Column()
  url: string;

  @Column('simple-array')
  event_types: string[];

  @Column()
  secret: string;

  @Column({ default: 'active' })
  status: 'active' | 'disabled';

  @Column({ type: 'int', default: 0 })
  failure_count: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
