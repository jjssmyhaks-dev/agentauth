import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { SyncSource } from './sync-source.entity';

@Entity('sync_jobs')
export class SyncJob {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  source_id: string;

  @ManyToOne(() => SyncSource)
  @JoinColumn({ name: 'source_id' })
  source: SyncSource;

  @Column({ default: 'pending' })
  status: 'pending' | 'running' | 'completed' | 'failed';

  @Column({ type: 'int', default: 0 })
  agents_created: number;

  @Column({ type: 'int', default: 0 })
  agents_updated: number;

  @Column({ type: 'int', default: 0 })
  agents_unchanged: number;

  @Column('text', { nullable: true })
  error_message: string;

  @Column('jsonb', { default: {} })
  result: Record<string, any>;

  @CreateDateColumn()
  started_at: Date;

  @Column('timestamp', { nullable: true })
  completed_at: Date;
}
