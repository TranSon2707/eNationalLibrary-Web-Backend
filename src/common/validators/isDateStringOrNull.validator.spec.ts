// src/common/validators/isDateStringOrNull.validator.spec.ts
import { validate } from 'class-validator';
import { IsDateStringOrNull } from './isDateStringOrNull.validator';
import { IsOptional } from 'class-validator';

class TestDto {
  @IsOptional()
  @IsDateStringOrNull()
  date?: string | null;
}

describe('IsDateStringOrNull', () => {
  const cases = [
    { value: null, valid: true },
    { value: '2024-01-15', valid: true },
    { value: '2024-01-15T10:30:00Z', valid: true },
    { value: 'not-a-date', valid: false },
    { value: '01/15/2024', valid: false }, // not ISO8601
    { value: '', valid: false },
    { value: 123, valid: false },
  ];

  cases.forEach(({ value, valid }) => {
    it(`${valid ? 'accepts' : 'rejects'} value: ${JSON.stringify(value)}`, async () => {
      const dto = Object.assign(new TestDto(), { date: value });
      const errors = await validate(dto);
      const dateErrors = errors.filter(e => e.property === 'date');
      expect(dateErrors.length === 0).toBe(valid);
    });
  });
});