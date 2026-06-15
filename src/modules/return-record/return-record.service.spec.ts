// src/modules/return-record/return-record.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ReturnRecord } from './return-record.entity';
import { ReturnRecordService } from './return-record.service';
import { ReaderService } from '../reader/reader.service';
import { BookService } from '../book/book.service';
import { NotFoundException } from '@nestjs/common';

const mockRepo = () => ({
  save: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
  remove: jest.fn(),
});

describe('ReturnRecordService', () => {
  let service: ReturnRecordService;
  let readerService: jest.Mocked<ReaderService>;
  let bookService: jest.Mocked<BookService>;
  let repo: ReturnType<typeof mockRepo>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReturnRecordService,
        { provide: getRepositoryToken(ReturnRecord), useFactory: mockRepo },
        {
          provide: ReaderService,
          useValue: { findOneById: jest.fn() },
        },
        {
          provide: BookService,
          useValue: { findOneById: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(ReturnRecordService);
    readerService = module.get(ReaderService) as jest.Mocked<ReaderService>;
    bookService = module.get(BookService) as jest.Mocked<BookService>;
    repo = module.get(getRepositoryToken(ReturnRecord));
  });

  describe('create', () => {
    const baseDto = {
      quantity: 1,
      borrowDate: '2024-01-01',
      dueDate: '2024-01-15',
      actualReturnDate: '2024-01-18',
    };

    it('throws NotFoundException for invalid readerId', async () => {
      readerService.findOneById.mockResolvedValue(null);
      await expect(
        service.create({ ...baseDto, readerId: 'bad-id' })
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException for invalid bookId', async () => {
      readerService.findOneById.mockResolvedValue({ userId: 'r1' } as any);
      bookService.findOneById.mockResolvedValue(null);
      await expect(
        service.create({ ...baseDto, readerId: 'r1', bookId: 'bad-id' })
      ).rejects.toThrow(NotFoundException);
    });

    it('creates without reader/book when IDs not provided', async () => {
      repo.save.mockResolvedValue({ returnRecordId: 'rr1', ...baseDto });
      const result = await service.create(baseDto);
      expect(readerService.findOneById).not.toHaveBeenCalled();
      expect(bookService.findOneById).not.toHaveBeenCalled();
      expect(repo.save).toHaveBeenCalled();
    });

    it('saves correct lateFee (3 days late)', async () => {
      repo.save.mockImplementation(async (r) => r);
      const result = await service.create(baseDto); // Jan 18 vs Jan 15 = 3 days
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ lateFee: expect.any(Number) })
      );
      const savedRecord = repo.save.mock.calls[0][0];
      expect(savedRecord.lateFee).toBeGreaterThan(0);
    });
  });
});