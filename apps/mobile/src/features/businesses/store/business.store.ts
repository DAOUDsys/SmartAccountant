import { create } from 'zustand';
import { businessesApi } from '../services/businesses.api';
import {
  clearStoredActiveBusinessId,
  getStoredActiveBusinessId,
  saveActiveBusinessId,
} from '../services/active-business-storage';
import type { BusinessWithMembership } from '../types/business.types';

interface BusinessState {
  activeBusiness?: BusinessWithMembership;
  activeBusinessId?: string;
  businesses: BusinessWithMembership[];
  error?: string;
  isLoading: boolean;
  clearActiveBusiness: () => Promise<void>;
  hydrateFromAuthContext: (businessContext?: BusinessWithMembership) => Promise<void>;
  loadBusinesses: (accessToken: string) => Promise<void>;
  selectActiveBusiness: (businessId: string) => Promise<void>;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Business request failed.';
}

function findBusiness(
  businesses: BusinessWithMembership[],
  businessId?: string,
): BusinessWithMembership | undefined {
  return businesses.find((item) => item.business.id === businessId);
}

export const useBusinessStore = create<BusinessState>((set, get) => ({
  businesses: [],
  isLoading: false,

  clearActiveBusiness: async () => {
    await clearStoredActiveBusinessId();
    set({
      activeBusiness: undefined,
      activeBusinessId: undefined,
      businesses: [],
      error: undefined,
      isLoading: false,
    });
  },

  hydrateFromAuthContext: async (businessContext) => {
    if (!businessContext) {
      return;
    }

    await saveActiveBusinessId(businessContext.business.id);
    set({
      activeBusiness: businessContext,
      activeBusinessId: businessContext.business.id,
      businesses: [businessContext],
      error: undefined,
    });
  },

  loadBusinesses: async (accessToken) => {
    set({ error: undefined, isLoading: true });

    try {
      const businesses = await businessesApi.list(accessToken);
      const storedBusinessId = await getStoredActiveBusinessId();
      const activeBusiness = findBusiness(businesses, storedBusinessId) ?? businesses[0];

      if (activeBusiness) {
        await saveActiveBusinessId(activeBusiness.business.id);
        set({
          activeBusiness,
          activeBusinessId: activeBusiness.business.id,
          businesses,
          isLoading: false,
        });
        return;
      }

      await clearStoredActiveBusinessId();
      set({
        activeBusiness: undefined,
        activeBusinessId: undefined,
        businesses,
        isLoading: false,
      });
    } catch (error) {
      set({
        error: getErrorMessage(error),
        isLoading: false,
      });
    }
  },

  selectActiveBusiness: async (businessId) => {
    const activeBusiness = findBusiness(get().businesses, businessId);

    if (!activeBusiness) {
      set({ error: 'Selected business is not available.' });
      return;
    }

    await saveActiveBusinessId(businessId);
    set({
      activeBusiness,
      activeBusinessId: businessId,
      error: undefined,
    });
  },
}));
