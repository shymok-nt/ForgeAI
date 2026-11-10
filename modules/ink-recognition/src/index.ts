import { requireNativeModule } from 'expo-modules-core';

type InkRecognitionModule = {
  hello(): Promise<string>;
};

// Load the Android native module only when the test button is pressed.
export async function hello(): Promise<string> {
  const native = requireNativeModule<InkRecognitionModule>('InkRecognition');
  return native.hello();
}
