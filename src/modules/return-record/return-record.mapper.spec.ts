import { ReturnRecordMapper } from './return-record.mapper';
import { ReturnRecordConfig } from 'src/common/configs/returnRecord.config';

describe('ReturnRecordMapper.createFromDto', () => {
  const base = {
    quantity: 2,
    borrowDate: '2024-01-01',
    dueDate: '2024-01-15',
    readerId: undefined,
    bookId: undefined,
  };

  it('charges zero fee when returned on due date', async () => {
    const record = await ReturnRecordMapper.createFromDto({
      ...base,
      actualReturnDate: '2024-01-15',
    });
    expect(record.lateFee).toBe(0);
  });

  it('charges zero fee when returned early', async () => {
    const record = await ReturnRecordMapper.createFromDto({
      ...base,
      actualReturnDate: '2024-01-10',
    });
    expect(record.lateFee).toBe(0);
  });

  it('charges correct fee for 3 days late', async () => {
    const record = await ReturnRecordMapper.createFromDto({
      ...base,
      actualReturnDate: '2024-01-18', // 3 days past Jan 15
    });
    expect(record.lateFee).toBe(3 * ReturnRecordConfig.lateFeePerDay);
  });

  it('charges fee for exactly 1 day late', async () => {
    const record = await ReturnRecordMapper.createFromDto({
      ...base,
      actualReturnDate: '2024-01-16',
    });
    expect(record.lateFee).toBe(ReturnRecordConfig.lateFeePerDay);
  });
});

describe('ReturnRecordMapper.updateFromDto', () => {
  it('recalculates lateFee when dueDate is updated', async () => {
    // existing record: on time
    const existing = await ReturnRecordMapper.createFromDto({
      quantity: 1,
      borrowDate: '2024-01-01',
      dueDate: '2024-01-20',
      actualReturnDate: '2024-01-18',
    });
    expect(existing.lateFee).toBe(0);

    // update pushes dueDate back, making it late
    const updated = await ReturnRecordMapper.updateFromDto(existing, {
      dueDate: '2024-01-15',
    });
    // now 3 days late (Jan 18 return vs Jan 15 due)
    expect(updated.lateFee).toBe(3 * ReturnRecordConfig.lateFeePerDay);
  });

  it('recalculates lateFee when actualReturnDate is updated', async () => {
    const existing = await ReturnRecordMapper.createFromDto({
      quantity: 1,
      borrowDate: '2024-01-01',
      dueDate: '2024-01-15',
      actualReturnDate: '2024-01-15',
    });
    expect(existing.lateFee).toBe(0);

    const updated = await ReturnRecordMapper.updateFromDto(existing, {
      actualReturnDate: '2024-01-20',
    });
    expect(updated.lateFee).toBe(5 * ReturnRecordConfig.lateFeePerDay);
  });

  it('recalculates using resolved final values when BOTH dates change', async () => {
    const existing = await ReturnRecordMapper.createFromDto({
      quantity: 1,
      borrowDate: '2024-01-01',
      dueDate: '2024-01-10',
      actualReturnDate: '2024-01-15', // 5 days late
    });

    const updated = await ReturnRecordMapper.updateFromDto(existing, {
      dueDate: '2024-01-14',
      actualReturnDate: '2024-01-16',
    });
    // 2 days late against new dueDate
    expect(updated.lateFee).toBe(2 * ReturnRecordConfig.lateFeePerDay);
  });
});