import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { UserPlan } from 'src/users/entities/user-plan.entity';

@Entity('plans')
export class Plan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string; // Basic / Premium / Ultra

  @Column({ default: 1 })
  deviceLimit: number; // max devices allowed

  @Column({ default: 0 })
  price: number; // optional, for billing

  @OneToMany(() => UserPlan, userPlan => userPlan.plan)
  userPlans: UserPlan[];
}
