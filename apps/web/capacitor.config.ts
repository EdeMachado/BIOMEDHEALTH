import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'health.biomed.app',
  appName: 'BIOMED HEALTH',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
