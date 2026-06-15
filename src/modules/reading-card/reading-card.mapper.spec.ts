// src/modules/reading-card/reading-card.mapper.spec.ts
import { ReadingCardMapper } from './reading-card.mapper';
import { ReadingCardConfig } from 'src/common/configs/readingCard.config';
import { ReadingCardType } from 'src/common/enums/readingCard/readingCardType.enum';

describe('ReadingCardMapper.createFromDto', () => {
  it('calculates expiryDate from activationDate for Normal card', async () => {
    const rc = await ReadingCardMapper.createFromDto({
      label: 'Card A',
      type: ReadingCardType.Normal,
      activationDate: '2024-01-01',
    });
    const expected = new Date('2024-01-01');
    expected.setTime(
      expected.getTime() +
        ReadingCardConfig.Normal.cardValidityDays * 24 * 60 * 60 * 1000
    );
    expect(rc.expiryDate.toDateString()).toBe(expected.toDateString());
  });

  it('uses provided expiryDate when given', async () => {
    const rc = await ReadingCardMapper.createFromDto({
      label: 'Card B',
      type: ReadingCardType.VIP,
      activationDate: '2024-01-01',
      expiryDate: '2025-06-01',
    });
    expect(rc.expiryDate.toDateString()).toBe(
      new Date('2025-06-01').toDateString()
    );
  });

  it('uses null expiryDate path correctly', async () => {
    const rc = await ReadingCardMapper.createFromDto({
      label: 'Card C',
      type: ReadingCardType.VIP,
      activationDate: '2024-03-01',
      expiryDate: null, // explicitly null → auto-calculate
    });
    // null triggers auto-calculation
    expect(rc.expiryDate).toBeInstanceOf(Date);
  });
});

describe('ReadingCardMapper.updateFromDto', () => {
  it('recalculates expiryDate when activationDate changes and expiryDate not provided', async () => {
    const rc = await ReadingCardMapper.createFromDto({
      label: 'X',
      type: ReadingCardType.Normal,
      activationDate: '2024-01-01',
    });
    const updated = await ReadingCardMapper.updateFromDto(rc, {
      activationDate: '2024-06-01',
    });
    const expected = new Date('2024-06-01');
    expected.setTime(
      expected.getTime() +
        ReadingCardConfig.Normal.cardValidityDays * 24 * 60 * 60 * 1000
    );
    expect(updated.expiryDate.toDateString()).toBe(expected.toDateString());
  });

  it('keeps existing expiryDate when activationDate does not change', async () => {
    const rc = await ReadingCardMapper.createFromDto({
      label: 'X',
      type: ReadingCardType.Normal,
      activationDate: '2024-01-01',
    });
    const originalExpiry = rc.expiryDate;
    const updated = await ReadingCardMapper.updateFromDto(rc, {
      label: 'Updated Label',
    });
    expect(updated.expiryDate.toDateString()).toBe(
      originalExpiry.toDateString()
    );
  });

  it('uses provided expiryDate on update even if activationDate also changes', async () => {
    const rc = await ReadingCardMapper.createFromDto({
      label: 'X',
      type: ReadingCardType.Normal,
      activationDate: '2024-01-01',
    });
    const updated = await ReadingCardMapper.updateFromDto(rc, {
      activationDate: '2024-06-01',
      expiryDate: '2025-12-31',
    });
    expect(updated.expiryDate.toDateString()).toBe(
      new Date('2025-12-31').toDateString()
    );
  });
});