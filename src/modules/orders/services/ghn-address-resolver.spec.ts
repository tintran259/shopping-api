import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { GhnAddressResolver } from './ghn-address-resolver';
import { GhnClient } from './ghn-client';

describe('GhnAddressResolver', () => {
  let resolver: GhnAddressResolver;
  let ghn: {
    getProvinces: jest.Mock;
    getDistricts: jest.Mock;
    getWards: jest.Mock;
    isMockMode: boolean;
  };

  beforeEach(async () => {
    ghn = {
      isMockMode: false,
      getProvinces: jest.fn().mockResolvedValue([
        { ProvinceID: 1, ProvinceName: 'Tỉnh Lâm Đồng' },
        { ProvinceID: 2, ProvinceName: 'Thành phố Hà Nội' },
      ]),
      getDistricts: jest.fn().mockResolvedValue([
        { DistrictID: 10, ProvinceID: 1, DistrictName: 'Huyện Đức Trọng' },
        { DistrictID: 11, ProvinceID: 1, DistrictName: 'Thành phố Đà Lạt' },
      ]),
      getWards: jest.fn().mockImplementation(async (districtId: number) => {
        if (districtId === 11) {
          return [{ WardCode: 'W1', DistrictID: 11, WardName: 'Phường 1' }];
        }
        return [{ WardCode: 'W99', DistrictID: 10, WardName: 'Xã Hiệp Thạnh' }];
      }),
    };

    const module = await Test.createTestingModule({
      providers: [GhnAddressResolver, { provide: GhnClient, useValue: ghn }],
    }).compile();

    resolver = module.get(GhnAddressResolver);
  });

  it('resolves a matching province/ward name pair, accent-insensitively', async () => {
    const result = await resolver.resolve('Lâm Đồng', 'Phường 1');
    expect(result).toEqual({ districtId: 11, wardCode: 'W1' });
  });

  it('searches every district in the province until a ward name matches', async () => {
    const result = await resolver.resolve('Lâm Đồng', 'Hiệp Thạnh');
    expect(result).toEqual({ districtId: 10, wardCode: 'W99' });
  });

  it('throws when the province name has no match', async () => {
    await expect(resolver.resolve('Không Tồn Tại', 'Phường 1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('throws when no district in the matched province has a matching ward', async () => {
    await expect(resolver.resolve('Lâm Đồng', 'Không Tồn Tại')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('caches province/district/ward lookups across calls', async () => {
    await resolver.resolve('Lâm Đồng', 'Phường 1');
    await resolver.resolve('Lâm Đồng', 'Phường 1');

    expect(ghn.getProvinces).toHaveBeenCalledTimes(1);
    expect(ghn.getDistricts).toHaveBeenCalledTimes(1);
  });

  it('skips the real province/district/ward search entirely in mock mode', async () => {
    ghn.isMockMode = true;

    const result = await resolver.resolve('Bất kỳ', 'Bất kỳ');

    expect(result).toEqual({ districtId: 0, wardCode: 'MOCK_WARD' });
    expect(ghn.getProvinces).not.toHaveBeenCalled();
  });
});
