import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Plan } from 'src/plans/entities/plan.entity';

@Injectable()
export class SeedService {
  constructor(private dataSource: DataSource) {}

  async seedPlans() {
    console.log('Seeding Plan Data...');

    const plans = [
      { name: 'Basic', deviceLimit: 1, price: 10 },
      { name: 'Premium', deviceLimit: 3, price: 30 },
      { name: 'Ultra', deviceLimit: 10, price: 50 },
    ];

    const planRepo = this.dataSource.getRepository(Plan);

    for (const plan of plans) {
      const exists = await planRepo.findOne({ where: { name: plan.name } });
      if (!exists) await planRepo.save(plan);
    }

    console.log('Plans seeded successfully!');
  }
}
