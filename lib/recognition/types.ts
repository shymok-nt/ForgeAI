import type {StrokeElement} from '@/features/canvas/types';
export type Stroke=StrokeElement;
export interface Recognizer {recognize(strokes:Stroke[],lang?:string):Promise<string>}
