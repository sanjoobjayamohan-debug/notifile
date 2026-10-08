export type ToolCategory =
  | 'recent'
  | 'favorites'
  | 'pdf-edit'
  | 'pdf-organize'
  | 'pdf-convert'
  | 'convert-to-pdf'
  | 'image'
  | 'compress'
  | 'security'
  | 'ocr';

export interface ToolDef {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: ToolCategory;
  subCategory?: string;
  iconName: string;
  badge?: string;
  acceptedTypes: string; // e.g., ".pdf", "image/*", ".txt"
  multipleFiles?: boolean;
  featured?: boolean;
}

export interface ProcessedFileResult {
  fileName: string;
  fileSize: number;
  originalSize: number;
  blobUrl: string;
  type: string;
  previewUrl?: string;
  extractedText?: string;
  pageCount?: number;
  compressionRatio?: number;
  rawBlob?: Blob;
}

export interface ActivityItem {
  id: string;
  toolId: string;
  toolName: string;
  fileName: string;
  timestamp: number;
  originalSize: number;
  resultSize?: number;
  chargedAmount?: number;
  creditsCharged?: number;
  status: 'completed' | 'failed';
}

export type ThemeMode = 'light' | 'dark' | 'system';
