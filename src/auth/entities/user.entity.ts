import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, ManyToOne,  JoinColumn } from 'typeorm';
import { Session } from './session.entity';
import { Plan } from 'src/plans/entities/plan.entity';
import { UserPlan } from 'src/users/entities/user-plan.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column({ unique: true })
  email: string;

  @Column()
  passwordHash: string;

  @OneToMany(() => UserPlan, userPlan => userPlan.user)
  userPlans: UserPlan[];

  @ManyToOne(() => Plan, { eager: true })
  @JoinColumn({ name: 'plan_id' })
  plan_type: Plan; // current plan


  @OneToMany(() => UserPlan, userPlan => userPlan.user)  // This is the reverse side of the relation
  user_plans: UserPlan[];  // This is the property that should be included in the find query



  @OneToMany(() => Session, session => session.user)
  sessions: Session[];



  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
