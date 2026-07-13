import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { GhtkClient } from './ghtk-client';

describe('GhtkClient', () => {
  const makeConfig = (token: string) => ({
    get: jest.fn((key: string) => {
      if (key === 'ghtk.baseUrl') return 'https://mock.ghtk.test';
      if (key === 'ghtk.token') return token;
      if (key === 'ghtk.clientSource') return 'partner-code';
      return '';
    }),
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('mock mode (no token): createOrder returns a fake response without calling fetch', async () => {
    const module = await Test.createTestingModule({
      providers: [
        GhtkClient,
        { provide: ConfigService, useValue: makeConfig('') },
      ],
    }).compile();
    const client = module.get(GhtkClient);
    const fetchSpy = jest.spyOn(global, 'fetch');

    expect(client.isMockMode).toBe(true);
    const result = await client.createOrder({} as never);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.order?.label).toMatch(/^MOCK-GHTK-/);
  });

  it('real mode (token set): calls fetch against the configured base URL', async () => {
    const module = await Test.createTestingModule({
      providers: [
        GhtkClient,
        { provide: ConfigService, useValue: makeConfig('real-token') },
      ],
    }).compile();
    const client = module.get(GhtkClient);
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        order: {
          label: 'REAL_LABEL',
          tracking_id: 1,
          fee: '20000',
          status_id: 1,
        },
      }),
    } as Response);

    expect(client.isMockMode).toBe(false);
    const result = await client.createOrder({} as never);

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('https://mock.ghtk.test'),
      expect.anything(),
    );
    expect(result.order?.label).toBe('REAL_LABEL');
  });
});
