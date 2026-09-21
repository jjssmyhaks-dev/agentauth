import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * On-behalf-of delegation: an authenticated agent (or the dashboard acting
 * for a human principal) mints a child token for a sub-agent. Every link is
 * recorded so a permission check can be traced back through the chain to the
 * original principal.
 */
@Entity('delegated_tokens')
@Index(['child_agent_id'])
@Index(['parent_jti'])
export class DelegatedToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  org_id: string;

  /** The agent that minted the delegation (chain parent). */
  @Column({ type: 'uuid' })
  parent_agent_id: string;

  /** jti of the parent token used to authorize the mint. */
  @Column()
  parent_jti: string;

  /** Chain depth: 1 for a first-level delegation, 2+ for sub-delegation. */
  @Column({ type: 'int', default: 1 })
  depth: number;

  /** The sub-agent receiving the delegated token. */
  @Column({ type: 'uuid' })
  child_agent_id: string;

  /** jti of the child token (set after issuance). */
  @Column({ nullable: true })
  child_jti: string | null;

  /** Narrowed scopes — must be a subset of the parent's effective scopes. */
  @Column('jsonb')
  scopes: Array<{
    resource_type: string;
    resource_pattern: string;
    allowed_actions: string[];
  }>;

  /** Original principal trace: the human or agent that started the chain. */
  @Column({ nullable: true })
  root_principal_type: 'user' | 'agent' | null;

  @Column({ type: 'uuid', nullable: true })
  root_principal_id: string | null;

  /** Purpose — makes every delegation auditable and revocable by intent. */
  @Column({ nullable: true })
  purpose: string | null;

  @Column({ nullable: true })
  expires_at: Date | null;

  @Column({ default: 'active' })
  status: 'active' | 'revoked';

  @CreateDateColumn()
  created_at: Date;
}
