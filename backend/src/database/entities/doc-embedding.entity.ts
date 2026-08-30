import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('doc_embeddings')
export class DocEmbedding {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  content_hash: string;

  @Column('text')
  content: string;

  @Column('text')
  source: string; // 'docs' | 'audit' | 'policies'

  @Column({ type: 'int', nullable: true })
  source_id_number: number;

  @Column('jsonb', { default: {} })
  metadata: Record<string, any>;

  // pgvector column — stored as text, queried with raw SQL
  @Column('text', { nullable: true })
  embedding: string;

  @CreateDateColumn()
  created_at: Date;
}
