import {useFont,useFonts} from '@shopify/react-native-skia';
import type {HandwritingFont} from '@/features/canvas/types';

export const HANDWRITING_FONT_FILES={
 Caveat:require('../../assets/fonts/Caveat-VariableFont_wght.ttf'),
 PatrickHand:require('../../assets/fonts/PatrickHand-Regular.ttf'),
 DancingScript:require('../../assets/fonts/DancingScript-VariableFont_wght.ttf'),
} as const;
export const AVAILABLE_HANDWRITING_FONTS=['Caveat','PatrickHand','DancingScript'] as const;
export const TURKISH_FONT_TEST='Şişli ığdır çöğüş İĞÜŞÖÇ';

export function useHandwritingFonts(){
 const caveat=useFont(HANDWRITING_FONT_FILES.Caveat,40);
 const patrick=useFont(HANDWRITING_FONT_FILES.PatrickHand,40);
 const dancing=useFont(HANDWRITING_FONT_FILES.DancingScript,40);
 const families=useFonts({
  Caveat:[HANDWRITING_FONT_FILES.Caveat],
  PatrickHand:[HANDWRITING_FONT_FILES.PatrickHand],
  DancingScript:[HANDWRITING_FONT_FILES.DancingScript],
 });
 const loaded={Caveat:!!caveat,PatrickHand:!!patrick,DancingScript:!!dancing,Kalam:false} as Record<HandwritingFont,boolean>;
 const missingGlyphs=(name:HandwritingFont):string[]=>{
  const font={Caveat:caveat,PatrickHand:patrick,DancingScript:dancing,Kalam:null}[name];
  if(!font)return Array.from(TURKISH_FONT_TEST);
  const chars=Array.from(new Set(Array.from(TURKISH_FONT_TEST).filter(c=>c!==' ')));
  const ids=font.getGlyphIDs(chars.join(''));
  return chars.filter((_,i)=>!ids[i]);
 };
 return {families,loaded,missingGlyphs};
}
