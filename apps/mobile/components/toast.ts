import { Alert, Platform, ToastAndroid } from 'react-native';

/** Lightweight feedback: native toast on Android, alert elsewhere. */
export function toast(message: string) {
  if (Platform.OS === 'android') ToastAndroid.show(message, ToastAndroid.SHORT);
  else Alert.alert('', message);
}
