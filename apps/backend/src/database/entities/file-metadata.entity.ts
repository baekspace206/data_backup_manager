import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('file_metadata')
@Index(['uploadDate'])
@Index(['fileType'])
@Index(['originalName'])
@Index(['checksum'])
export class FileMetadataEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 512 })
  originalName: string;

  @Column({ type: 'varchar', length: 100 })
  mimeType: string;

  @Column({ type: 'bigint' })
  size: number;

  @Column({ type: 'timestamp with time zone' })
  uploadDate: Date;

  @Column({ type: 'varchar', length: 1024 })
  filePath: string;

  @Column({
    type: 'enum',
    enum: ['image', 'video'],
    enumName: 'file_type_enum'
  })
  fileType: 'image' | 'video';

  @Column({ type: 'varchar', length: 64, nullable: true })
  checksum: string;

  @Column({ type: 'varchar', length: 1024, nullable: true })
  thumbnailPath: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @Column({ type: 'varchar', length: 100, nullable: true })
  tags: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt: Date;

  // Virtual properties for compatibility
  get uploadedAt(): Date {
    return this.uploadDate;
  }

  set uploadedAt(date: Date) {
    this.uploadDate = date;
  }
}