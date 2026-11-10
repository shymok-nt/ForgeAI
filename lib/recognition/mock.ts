import type {Recognizer} from './types';
import {groupInk} from '@/lib/ink/grouping';
export const mockRecognizer:Recognizer={
 async recognize(strokes){return groupInk(strokes).map(line=>line.words.map(()=>'test').join(' ')).join('\n')}
};
