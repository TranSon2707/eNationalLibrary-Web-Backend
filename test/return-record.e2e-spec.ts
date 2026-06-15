// test/return-record.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('ReturnRecord E2E', () => {
  let app: INestApplication;
  let authToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true })
    );
    app.setGlobalPrefix('api');
    await app.init();

    // Authenticate first
    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ usernameOrEmail: 'admin@test.com', password: 'password123' });
    authToken = loginRes.body.accessToken;
  });

  afterAll(() => app.close());

  describe('POST /api/return-records', () => {
    it('rejects request missing required fields', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/return-records')
        .send({ quantity: 1 }); // missing dates
      expect(res.status).toBe(400);
    });

    it('rejects non-ISO date strings', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/return-records')
        .send({
          quantity: 1,
          borrowDate: '01/01/2024', // wrong format
          dueDate: '2024-01-15',
          actualReturnDate: '2024-01-18',
        });
      expect(res.status).toBe(400);
    });

    it('creates a return record and returns an ID', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/return-records')
        .send({
          quantity: 1,
          borrowDate: '2024-01-01',
          dueDate: '2024-01-15',
          actualReturnDate: '2024-01-18',
        });
      expect(res.status).toBe(201);
      expect(typeof res.body).toBe('string'); // UUID
    });

    it('computes a non-zero lateFee for late return', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/api/return-records')
        .send({
          quantity: 1,
          borrowDate: '2024-01-01',
          dueDate: '2024-01-15',
          actualReturnDate: '2024-01-20', // 5 days late
        });
      const id = createRes.body;

      const getRes = await request(app.getHttpServer()).get(
        `/api/return-records/${id}`
      );
      expect(getRes.body.lateFee).toBeGreaterThan(0);
    });
  });

  describe('PUT /api/return-records/:id', () => {
    it('recalculates lateFee on update', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/api/return-records')
        .send({
          quantity: 1,
          borrowDate: '2024-01-01',
          dueDate: '2024-01-20',
          actualReturnDate: '2024-01-18', // on time
        });
      const id = createRes.body;

      await request(app.getHttpServer())
        .put(`/api/return-records/${id}`)
        .send({ dueDate: '2024-01-10' }); // now 8 days late

      const getRes = await request(app.getHttpServer()).get(
        `/api/return-records/${id}`
      );
      expect(getRes.body.lateFee).toBeGreaterThan(0);
    });
  });
});