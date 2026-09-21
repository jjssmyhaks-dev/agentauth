import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Organization } from './organization.entity';

/** Control-plane credentials. The raw key is shown once at creation; only
 *  its SHA-256 hash is stored. */
@Entity('api_keys')
@Index(['org_id'])
export class ApiKey {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  org_id: string;

  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'org_id' })
  organization: Organization;

  @Column()
  name: string;

  /** First 12 chars of the raw key — for identification in dashboards. */
  @Column()
  prefix: string;

  /** Hex SHA-256 of the raw key. Lookup happens by hash, never by prefix. */
  @Column()
  key_hash: string;

  @Column({ default: 'operator' })
  role: 'admin' | 'operator' | 'auditor';

  @Column({ default: 'active' })
  status: 'active' | 'revoked';

  @Column({ nullable: true })
  last_used_at: Date | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
