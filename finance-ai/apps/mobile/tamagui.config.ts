import { defaultConfig } from '@tamagui/config/v4';
import { createTamagui, type CreateTamaguiProps, type TamaguiInternalConfig } from 'tamagui';

export const config: TamaguiInternalConfig = createTamagui(
  defaultConfig as unknown as CreateTamaguiProps,
);

export type AppConfig = typeof config;

declare module 'tamagui' {
  interface TamaguiCustomConfig extends AppConfig {
    readonly financeAiConfig?: never;
  }
}

export default config;
