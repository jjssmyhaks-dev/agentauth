import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  JoinTable,
  ManyToMany,
} from 'typeorm';
import { Organization } from './organization.entity';
import { Agent } from './agent.entity';

@Entity('agent_groups')
export class AgentGroup {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  org_id: string;

  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'org_id' })
  organization: Organization;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  // Dynamic filter: if set, agents are matched by attributes at policy-check time
  @Column('jsonb', { nullable: true })
  filter: Record<string, any> | null;

  @ManyToMany(() => Agent)
  @JoinTable({
    name: 'agent_group_members',
    joinColumn: { name: 'group_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'agent_id', referencedColumnName: 'id' },
  })
  members: Agent[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
