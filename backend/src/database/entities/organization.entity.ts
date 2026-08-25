import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';

@Entity('organizations')
export class Organization {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ default: 'autonomous' })
  default_approval_mode: 'autonomous' | 'human_in_the_loop';

  @Column({ type: 'jsonb', default: '{}' })
  action_overrides: Record<string, string>;

  @Column({ type: 'jsonb', nullable: true })
  settings: {
    token_ttl_minutes?: number;
    ip_allowlist?: string[];
  };

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
