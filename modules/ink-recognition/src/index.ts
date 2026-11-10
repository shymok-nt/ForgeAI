import {requireNativeModule} from 'expo-modules-core';

export type InkPoint={x:number;y:number;t:number};
export type InkStroke={points:InkPoint[]};
export type InkRecognitionNative={
 isModelDownloaded(lang:string):Promise<boolean>;
 downloadModel(lang:string):Promise<void>;
 recognize(strokes:InkStroke[],lang:string):Promise<string>;
};
const native=requireNativeModule<InkRecognitionNative>('InkRecognition');
export const isModelDownloaded=(lang:string):Promise<boolean>=>native.isModelDownloaded(lang);
export const downloadModel=(lang:string):Promise<void>=>native.downloadModel(lang);
export const recognize=(strokes:InkStroke[],lang:string):Promise<string>=>native.recognize(strokes,lang);
