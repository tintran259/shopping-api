import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { GhnClient } from './ghn-client';

describe('GhnClient', () => {
  const makeConfig = (token: string) => ({
    get: jest.fn((key: string) => {
      if (key === 'ghn.baseUrl') return 'https://mock.ghn.test';
      if (key === 'ghn.token') return token;
      return '';
    }),
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('mock mode (no token): createShippingOrder returns a fake response without calling fetch', async () => {
    const module = await Test.createTestingModule({
      providers: [
        GhnClient,
        { provide: ConfigService, useValue: makeConfig('') },
      ],
    }).compile();
    const client = module.get(GhnClient);
    const fetchSpy = jest.spyOn(global, 'fetch');

    expect(client.isMockMode).toBe(true);
    const result = await client.createShippingOrder('shop-1', {} as never);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.order_code).toMatch(/^MOCK-GHN-/);
    expect(typeof result.total_fee).toBe('number');
  });

  it('real mode (token set): calls fetch against the configured base URL', async () => {
    const module = await Test.createTestingModule({
      providers: [
        GhnClient,
        { provide: ConfigService, useValue: makeConfig('real-token') },
      ],
    }).compile();
    const client = module.get(GhnClient);
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        code: 200,
        data: { order_code: 'REAL123', total_fee: 30000 },
      }),
    } as Response);

    expect(client.isMockMode).toBe(false);
    const result = await client.createShippingOrder('shop-1', {} as never);

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('https://mock.ghn.test'),
      expect.anything(),
    );
    expect(result.order_code).toBe('REAL123');
  });
});
