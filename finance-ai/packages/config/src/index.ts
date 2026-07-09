import { defaultConfig } from '@tamagui/config/v4';
import { createTamagui, type CreateTamaguiProps, type TamaguiInternalConfig } from 'tamagui';

export const tamaguiConfig: TamaguiInternalConfig = createTamagui(
  defaultConfig as unknown as CreateTamaguiProps,
);

export type AppTamaguiConfig = typeof tamaguiConfig;
