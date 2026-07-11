import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearStoredActiveBusinessId,
  getStoredActiveBusinessId,
  saveActiveBusinessId,
} from '../services/active-business-storage';
import { businessesApi } from '../services/businesses.api';
import { useBusinessStore } from './business.store';
import type { BusinessWithMembership } from '../types/business.types';

vi.mock('../services/businesses.api', () => ({
  businessesApi: {
    list: vi.fn(),
  },
}));

vi.mock('../services/active-business-storage', () => ({
  clearStoredActiveBusinessId: vi.fn(),
  getStoredActiveBusinessId: vi.fn(),
  saveActiveBusinessId: vi.fn(),
}));

const businessContext: BusinessWithMembership = {
  business: {
    createdAt: '2026-07-10T10:00:00.000Z',
    currency: 'USD',
    id: 'business_1',
    locale: 'en',
    name: 'Daoud Studio',
    ownerId: 'user_1',
    timezone: 'UTC',
    updatedAt: '2026-07-10T10:00:00.000Z',
  },
  membership: {
    businessId: 'business_1',
    createdAt: '2026-07-10T10:00:00.000Z',
    id: 'member_1',
    role: 'OWNER',
    status: 'ACTIVE',
    updatedAt: '2026-07-10T10:00:00.000Z',
    userId: 'user_1',
  },
};

const secondBusinessContext: BusinessWithMembership = {
  business: {
    ...businessContext.business,
    id: 'business_2',
    name: 'Second Business',
  },
  membership: {
    ...businessContext.membership,
    businessId: 'business_2',
    id: 'member_2',
  },
};

function resetBusinessStore() {
  useBusinessStore.setState(useBusinessStore.getInitialState(), true);
}

describe('business store', () => {
  beforeEach(() => {
    resetBusinessStore();
    vi.mocked(businessesApi.list).mockReset();
    vi.mocked(clearStoredActiveBusinessId).mockReset();
    vi.mocked(getStoredActiveBusinessId).mockReset();
    vi.mocked(saveActiveBusinessId).mockReset();
  });

  afterEach(() => {
    resetBusinessStore();
  });

  it('starts without an active business', () => {
    const state = useBusinessStore.getState();

    expect(state.businesses).toEqual([]);
    expect(state.activeBusinessId).toBeUndefined();
    expect(state.activeBusiness).toBeUndefined();
  });

  it('selects the only business after loading businesses', async () => {
    vi.mocked(businessesApi.list).mockResolvedValue([businessContext]);
    vi.mocked(getStoredActiveBusinessId).mockResolvedValue(undefined);

    await useBusinessStore.getState().loadBusinesses('access-token');

    expect(businessesApi.list).toHaveBeenCalledWith('access-token');
    expect(saveActiveBusinessId).toHaveBeenCalledWith('business_1');
    expect(useBusinessStore.getState().activeBusinessId).toBe('business_1');
  });

  it('keeps a valid stored active business when multiple businesses exist', async () => {
    vi.mocked(businessesApi.list).mockResolvedValue([businessContext, secondBusinessContext]);
    vi.mocked(getStoredActiveBusinessId).mockResolvedValue('business_2');

    await useBusinessStore.getState().loadBusinesses('access-token');

    expect(saveActiveBusinessId).toHaveBeenCalledWith('business_2');
    expect(useBusinessStore.getState().activeBusiness?.business.name).toBe('Second Business');
  });

  it('can select and persist an active business', async () => {
    useBusinessStore.setState({
      businesses: [businessContext, secondBusinessContext],
    });

    await useBusinessStore.getState().selectActiveBusiness('business_2');

    expect(saveActiveBusinessId).toHaveBeenCalledWith('business_2');
    expect(useBusinessStore.getState().activeBusinessId).toBe('business_2');
  });

  it('clears the active business on logout', async () => {
    useBusinessStore.setState({
      activeBusiness: businessContext,
      activeBusinessId: 'business_1',
      businesses: [businessContext],
    });

    await useBusinessStore.getState().clearActiveBusiness();

    expect(clearStoredActiveBusinessId).toHaveBeenCalled();
    expect(useBusinessStore.getState().activeBusinessId).toBeUndefined();
    expect(useBusinessStore.getState().businesses).toEqual([]);
  });
});
