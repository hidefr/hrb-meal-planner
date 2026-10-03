import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tastecraft.mealplanner',
  appName: 'TasteCraft',
  webDir: 'dist',
  server: {
    url: 'http://192.168.0.47:8000',
    cleartext: true
  }
};

export default config;
