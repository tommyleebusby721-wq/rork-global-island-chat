import { Platform } from 'react-native';

export const USE_NATIVE_DRIVER: boolean = Platform.OS !== 'web';
