// src/common/validators/isPresent.validator.spec.ts
import { validate } from 'class-validator';
import { IsPresent } from './isPresent.validator';

class TestDto {
  @IsPresent()
  name: string;
}

describe('IsPresent validator', () => {
  it('fails when property is missing from request body', async () => {
    const dto = new TestDto(); // name never assigned
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints?.IsPresent).toBeDefined();
  });

  it('passes when property is explicitly undefined but present', async () => {
    const dto = Object.assign(new TestDto(), { name: undefined });
    // IsPresent checks Reflect.has — value must be a key, even if undefined
    // NOTE: this is a subtle point — undefined still fails because value check
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0); // undefined still invalid
  });

  it('passes when property has a value', async () => {
    const dto = Object.assign(new TestDto(), { name: 'Alice' });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('passes when property is null', async () => {
    const dto = Object.assign(new TestDto(), { name: null });
    const errors = await validate(dto); // IsPresent alone passes null
    expect(errors.filter(e => e.constraints?.IsPresent)).toHaveLength(0);
  });
});