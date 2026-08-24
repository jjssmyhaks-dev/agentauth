import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Organization } from './organization.entity';

@Entity('webhooks')
export class Webhook {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  org_id: string;

  @ManyToOne(() => Organization, (org) => org.webhooks)
  @JoinColumn({ name: 'org_id' })
  organization: Organization;

  @Column()
  url: string;

  @Column('simple-array')
  event_types: string[];

  @Column()
  secret: string;

  @CreateDateColumn()
  created_at: Date;

  @Column({ default: 'active' })
  status: 'active' | 'inactive';
}
