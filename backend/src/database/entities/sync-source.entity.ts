import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Organization } from './organization.entity';

@Entity('sync_sources')
export class SyncSource {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  org_id: string;

  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'org_id' })
  organization: Organization;

  @Column()
  name: string;

  @Column({ default: 'generic' })
  type: string; // generic | langchain | crewai | custom

  @Column('jsonb', { default: {} })
  config: Record<string, any>;

  @Column({ default: 'idle' })
  status: 'idle' | 'syncing' | 'error';

  @Column('timestamp', { nullable: true })
  last_sync_at: Date;

  @Column({ type: 'int', default: 0 })
  total_agents_synced: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
