export type NotebookFolder = 'Ders' | 'İş' | 'Kişisel';
export type FolderFilter = 'Tümü' | NotebookFolder;
export type PageTemplate = 'boş' | 'çizgili' | 'kareli' | 'noktalı';
export type PaperColor = 'beyaz' | 'krem';
export type SortBy = 'updated' | 'title' | 'created';
export type ViewMode = 'grid' | 'list';
export type Notebook = {
 id:string; title:string; folder:NotebookFolder; coverType:'color'|'image'; coverColor:string; coverImageUri:string|null;
 showTitleOnCover:boolean; template:PageTemplate; paperColor:PaperColor; pageCount:number;
 createdAt:string; updatedAt:string; favorite:boolean;
};
export type NotebookDraft = Pick<Notebook,'title'|'folder'|'coverType'|'coverColor'|'coverImageUri'|'showTitleOnCover'|'template'|'paperColor'>;
