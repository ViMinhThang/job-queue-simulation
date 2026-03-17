import { Test, TestingModule } from '@nestjs/testing';
import { DtqueueService } from './dtqueue.service';

describe('DtqueueService', () => {
  let service: DtqueueService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DtqueueService],
    }).compile();

    service = module.get<DtqueueService>(DtqueueService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
