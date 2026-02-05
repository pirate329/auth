import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';
import { User } from 'src/auth/entities/user.entity';
import { Plan } from '../../plans/entities/plan.entity';

@Entity('user_plans')
@Unique(['user', 'isActive']) // Ensure only one active plan at a time
export class UserPlan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Each user can have only one active plan
  @ManyToOne(() => User, (user) => user.userPlans, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Plan, (plan) => plan.userPlans)
  @JoinColumn({ name: 'plan_id' })
  plan: Plan;

  @Column({ type: 'timestamp', nullable: true })
  startDate: Date;

  @Column({ type: 'timestamp', nullable: true })
  endDate: Date;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
