import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowLeft,
  Upload,
  FileCheck,
  CheckCircle2,
  Download,
  Copy,
  RefreshCw,
  FileText,
  Trash2,
  AlertCircle,
  File,
  Check,
  QrCode,
  Smartphone,
  Share2,
  Wand2,
  ZoomIn,
  GripVertical,
  X,
} from 'lucide-react';
import { ToolDef, ProcessedFileResult } from '../types';
import {
  mergePdfFiles,
  rotatePdfFile,
  extractPdfPages,
  deletePdfPages,
  watermarkPdf,
  addPageNumbersPdf,
  imagesToPdf,
  textToPdf,
  optimizePdf,
  updatePdfMetadata,
  flattenPdf,
  addBatesNumbers,
  readPdfMetadata,
  protectPdf,
  unlockPdf,
} from '../services/pdfEngine';
import {
  docxToText,
  extractPdfText,
  pdfTextToDocx,
  pdfTextToHtml,
  pdfTextToXlsx,
  pdfToImagesZip,
  splitPdfToZip,
} from '../services/pdfConversionService';
import {
  compressImage,
  resizeImage,
  convertImageFormat,
  transformImage,
  applyImageFilter,
  getImageDimensions,
  cropImage,
  removeImageBackground,
} from '../services/imageEngine';
import { performOCR, SUPPORTED_OCR_LANGUAGES } from '../services/ocrEngine';
import { PdfRearrangeWorkspace } from './PdfRearrangeWorkspace';
import { PdfDeletePagesWorkspace } from './PdfDeletePagesWorkspace';
import { PdfEditorWorkspace } from './PdfEditorWorkspace';
import { loadPdfJsDoc, renderPageToCanvas } from '../services/pdfRenderService';
import {
  BillingConfiguration,
  BillingState,
  getToolCreditCost,
  isFairUseLimitReached,
  isUnlimitedActive,
} from '../services/billingService';
import { InsufficientBalanceModal } from './InsufficientBalanceModal';

interface ToolWorkspaceProps {
  tool: ToolDef;
  onBack: () => void;
  onRecordActivity: (fileName: string, originalSize: number, resultSize: number, toolId: string, toolName: string, creditCost: number) => Promise<void>;
  onTakeToPhone?: (file: { name: string; blob: Blob; size: number }) => void;
  onShareFile?: (file: { name: string; size: number; blobUrl: string; blob?: Blob }) => void;
  onOpenPricing?: () => void;
  billing: BillingState;
  billingConfig: BillingConfiguration;
}

export const ToolWorkspace: React.FC<ToolWorkspaceProps> = ({
  tool,
  onBack,
  onRecordActivity,
  onTakeToPhone,
  onShareFile,
  onOpenPricing,
  billing,
  billingConfig,
}) => {
  const [files, setFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stageText, setStageText] = useState('');
  const [result, setResult] = useState<ProcessedFileResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [draggedFileIndex, setDraggedFileIndex] = useState<number | null>(null);

  const [isInsufficientCreditsOpen, setIsInsufficientCreditsOpen] = useState(false);

  // Tool specific configurations
  const [compressionLevel, setCompressionLevel] = useState<'high' | 'recommended' | 'extreme'>('recommended');
  const [rotationAngle, setRotationAngle] = useState<number>(90);
  const [watermarkText, setWatermarkText] = useState('CONFIDENTIAL');
  const [watermarkOpacity, setWatermarkOpacity] = useState(0.25);
  const [pageNumberPos, setPageNumberPos] = useState<'bottom' | 'top'>('bottom');
  const [ocrLang, setOcrLang] = useState('eng');
  const [extractedOcrText, setExtractedOcrText] = useState('');
  const [imageFormat, setImageFormat] = useState<'image/jpeg' | 'image/png' | 'image/webp'>('image/jpeg');
  const [resizeWidth, setResizeWidth] = useState(1200);
  const [resizeHeight, setResizeHeight] = useState(800);
  const [lockAspect, setLockAspect] = useState(true);
  const [origAspect, setOrigAspect] = useState(1.5);
  const [pageSelection, setPageSelection] = useState('1');
  const [metadataTitle, setMetadataTitle] = useState('');
  const [metadataAuthor, setMetadataAuthor] = useState('');
  const [metadataSubject, setMetadataSubject] = useState('');
  const [metadataKeywords, setMetadataKeywords] = useState('');
  const [batesPrefix, setBatesPrefix] = useState('');
  const [batesStart, setBatesStart] = useState(1);
  const [cropX, setCropX] = useState(0);
  const [cropY, setCropY] = useState(0);
  const [cropWidth, setCropWidth] = useState(800);
  const [cropHeight, setCropHeight] = useState(600);
  const [cropImageDimensions, setCropImageDimensions] = useState({ width: 0, height: 0 });
  const [deskewAngle, setDeskewAngle] = useState(0);
  const [pdfPassword, setPdfPassword] = useState('');
  const [pdfPasswordConfirmation, setPdfPasswordConfirmation] = useState('');


  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const acceptFiles = (selected: File[]) => {
    const acceptedRules = tool.acceptedTypes.split(',').map((rule) => rule.trim().toLowerCase());
    const unsupportedFile = selected.find((file) => {
      const fileName = file.name.toLowerCase();
      return !acceptedRules.some((rule) =>
        rule === 'image/*'
          ? file.type.startsWith('image/')
          : rule.startsWith('.')
            ? fileName.endsWith(rule)
            : file.type.toLowerCase() === rule
      );
    });
    if (unsupportedFile) {
      setErrorMsg(`${unsupportedFile.name} is not supported by ${tool.name}. Accepted formats: ${tool.acceptedTypes}.`);
      return;
    }
    if (tool.multipleFiles) setFiles((prev) => [...prev, ...selected]);
    else setFiles([selected[0]]);
    setPdfPassword('');
    setPdfPasswordConfirmation('');
    setErrorMsg(null);
    setResult(null);
  };

  // Read dimensions when image uploaded for resize
  useEffect(() => {
    if (files.length > 0 && (tool.id === 'resize-image' || tool.id === 'crop-image')) {
      getImageDimensions(files[0])
        .then((dims) => {
          if (tool.id === 'resize-image') {
            setResizeWidth(dims.width);
            setResizeHeight(dims.height);
            if (dims.height > 0) {
              setOrigAspect(dims.width / dims.height);
            }
          } else {
            setCropImageDimensions(dims);
            setCropWidth(dims.width);
            setCropHeight(dims.height);
          }
        })
        .catch((error: unknown) => {
          setErrorMsg(error instanceof Error ? error.message : 'Could not read the image dimensions.');
        });
    }
    if (files.length > 0 && tool.id === 'edit-metadata') {
      readPdfMetadata(files[0])
        .then((metadata) => {
          setMetadataTitle(metadata.title);
          setMetadataAuthor(metadata.author);
          setMetadataSubject(metadata.subject);
          setMetadataKeywords(metadata.keywords);
        })
        .catch((error: unknown) => {
          setErrorMsg(error instanceof Error ? error.message : 'Could not read PDF metadata.');
        });
    }
  }, [files, tool.id]);

  const handleWidthChange = (w: number) => {
    setResizeWidth(w);
    if (lockAspect && origAspect > 0) {
      setResizeHeight(Math.round(w / origAspect));
    }
  };

  const handleHeightChange = (h: number) => {
    setResizeHeight(h);
    if (lockAspect && origAspect > 0) {
      setResizeWidth(Math.round(h * origAspect));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      acceptFiles(Array.from(e.target.files));
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      acceptFiles(Array.from(e.dataTransfer.files));
    }
  };

  const removeFile = (index: number) => {
    if (files[index] === previewFile) setPreviewFile(null);
    setFiles((prev) => prev.filter((_, i) => i !== index));
    if (files.length <= 1) {
      setResult(null);
      setPdfPassword('');
      setPdfPasswordConfirmation('');
    }
  };

  const retryBackgroundRemoval = () => {
    if (result?.blobUrl) URL.revokeObjectURL(result.blobUrl);
    setResult(null);
    setProgress(0);
    setStageText('');
    setErrorMsg(null);
  };

  const moveSelectedFile = (fromIndex: number, toIndex: number) => {
    setFiles((current) => {
      if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= current.length || toIndex >= current.length) {
        return current;
      }
      const reordered = [...current];
      const [movedFile] = reordered.splice(fromIndex, 1);
      reordered.splice(toIndex, 0, movedFile);
      return reordered;
    });
  };

  const unlimitedAccess = isUnlimitedActive(billing);
  const developmentCreditBypass = import.meta.env.DEV;
  const requiredCredits = developmentCreditBypass
    ? 0
    : getToolCreditCost(billingConfig, tool.id) *
      (tool.id === 'batch-processing' ? Math.max(files.length, 1) : 1);
  const executeProcessing = async () => {
    if (files.length === 0) {
      setErrorMsg('Please select at least one file to process.');
      return;
    }

    if (!unlimitedAccess && billing.creditBalance < requiredCredits) {
      setIsInsufficientCreditsOpen(true);
      return;
    }
    if (unlimitedAccess && isFairUseLimitReached(billing)) {
      setErrorMsg(`The team fair-use limit of ${billing.teamSubscription?.fairUseJobsPerHour} operations per hour has been reached.`);
      return;
    }
    setIsProcessing(true);
    setProgress(15);
    setStageText('Reading input files...');
    setErrorMsg(null);

    const processingStartedAt = Date.now();
    try {
      let outputBlob: Blob | null = null;
      let outName = `notifile_${tool.id}_${Date.now()}`;
      let textContent = '';

      // Processing branch based on tool ID:
      if (tool.id === 'merge-pdf') {
        setStageText('Merging PDF documents...');
        outputBlob = await mergePdfFiles(files, (p) => setProgress(p));
        outName = 'merged_document.pdf';
      } else if (tool.id === 'split-pdf') {
        setStageText('Splitting PDF into individual pages...');
        outputBlob = await splitPdfToZip(files[0], setProgress);
        outName = `${files[0].name.replace(/\.[^/.]+$/, '')}_pages.zip`;
      } else if (tool.id === 'rotate-pdf') {
        setStageText(`Rotating pages by ${rotationAngle}°...`);
        outputBlob = await rotatePdfFile(files[0], rotationAngle);
        outName = `rotated_${files[0].name}`;
      } else if (tool.id === 'add-watermark') {
        setStageText('Stamping watermark across pages...');
        outputBlob = await watermarkPdf(files[0], watermarkText, watermarkOpacity);
        outName = `watermarked_${files[0].name}`;
      } else if (tool.id === 'page-numbers') {
        setStageText('Inserting page numbers...');
        outputBlob = await addPageNumbersPdf(files[0], pageNumberPos);
        outName = `numbered_${files[0].name}`;
      } else if (tool.id === 'extract-pages') {
        setStageText('Extracting chosen pages...');
        const pages = pageSelection
          .split(',')
          .map((s) => parseInt(s.trim(), 10) - 1)
          .filter((n) => !isNaN(n));
        outputBlob = await extractPdfPages(files[0], pages.length ? pages : [0]);
        outName = `extracted_${files[0].name}`;
      } else if (tool.id === 'delete-pages') {
        setStageText('Removing selected pages...');
        const pages = pageSelection
          .split(',')
          .map((s) => parseInt(s.trim(), 10) - 1)
          .filter((n) => !isNaN(n));
        outputBlob = await deletePdfPages(files[0], pages);
        outName = `trimmed_${files[0].name}`;
      } else if (tool.id === 'jpg-to-pdf' || tool.id === 'png-to-pdf') {
        setStageText('Converting images to vector PDF...');
        outputBlob = await imagesToPdf(files);
        outName = 'converted_images.pdf';
      } else if (tool.id === 'text-to-pdf' || tool.id === 'word-to-pdf') {
        setStageText('Compiling text into structured PDF...');
        const txt = files[0].name.toLowerCase().endsWith('.docx')
          ? await docxToText(files[0])
          : files[0].name.toLowerCase().endsWith('.txt')
            ? await files[0].text()
            : (() => { throw new Error('Legacy .doc files are not supported. Save the document as .docx or .txt and try again.'); })();
        outputBlob = await textToPdf(txt, files[0].name.replace(/\.[^/.]+$/, ''));
        outName = `${files[0].name.replace(/\.[^/.]+$/, '')}.pdf`;
      } else if (tool.id === 'compress-pdf') {
        setStageText('Rewriting PDF structure with lossless object compression...');
        setProgress(50);
        outputBlob = await optimizePdf(files[0]);
        outName = `compressed_${files[0].name}`;
      } else if (tool.id === 'edit-metadata') {
        setStageText('Updating PDF document properties...');
        outputBlob = await updatePdfMetadata(files[0], {
          title: metadataTitle,
          author: metadataAuthor,
          subject: metadataSubject,
          keywords: metadataKeywords,
        });
        outName = `metadata_${files[0].name}`;
      } else if (tool.id === 'flatten-pdf') {
        setStageText('Flattening PDF form fields...');
        outputBlob = await flattenPdf(files[0]);
        outName = `flattened_${files[0].name}`;
      } else if (tool.id === 'bates-numbering') {
        setStageText('Applying sequential Bates numbers...');
        outputBlob = await addBatesNumbers(files[0], batesPrefix, batesStart);
        outName = `bates_${files[0].name}`;
      } else if (tool.id === 'pdf-to-text' || tool.id === 'pdf-to-word' || tool.id === 'pdf-to-excel' || tool.id === 'pdf-to-html') {
        setStageText('Extracting text from PDF pages...');
        const extractedText = await extractPdfText(files[0], setProgress);
        if (tool.id === 'pdf-to-text') {
          outputBlob = new Blob([extractedText], { type: 'text/plain;charset=utf-8' });
          outName = `${files[0].name.replace(/\.[^/.]+$/, '')}.txt`;
        } else if (tool.id === 'pdf-to-word') {
          outputBlob = await pdfTextToDocx(extractedText);
          outName = `${files[0].name.replace(/\.[^/.]+$/, '')}.docx`;
        } else if (tool.id === 'pdf-to-excel') {
          outputBlob = await pdfTextToXlsx(extractedText);
          outName = `${files[0].name.replace(/\.[^/.]+$/, '')}.xlsx`;
        } else {
          outputBlob = pdfTextToHtml(extractedText);
          outName = `${files[0].name.replace(/\.[^/.]+$/, '')}.html`;
        }
      } else if (tool.id === 'pdf-to-jpg' || tool.id === 'pdf-to-png') {
        const format = tool.id === 'pdf-to-jpg' ? 'jpeg' : 'png';
        setStageText(`Rendering PDF pages as ${format.toUpperCase()} images...`);
        outputBlob = await pdfToImagesZip(files[0], format, setProgress);
        outName = `${files[0].name.replace(/\.[^/.]+$/, '')}_${format}_pages.zip`;
      } else if (tool.id === 'protect-pdf') {
        if (pdfPassword.length < 8) throw new Error('Use a password with at least 8 characters.');
        if (pdfPassword !== pdfPasswordConfirmation) throw new Error('The password confirmation does not match.');
        setStageText('Encrypting the PDF with AES-256...');
        outputBlob = await protectPdf(files[0], pdfPassword);
        outName = `protected_${files[0].name}`;
      } else if (tool.id === 'unlock-pdf') {
        if (!pdfPassword) throw new Error('Enter the PDF user or owner password.');
        setStageText('Removing PDF encryption with the supplied password...');
        outputBlob = await unlockPdf(files[0], pdfPassword);
        outName = `unlocked_${files[0].name}`;
      } else if (tool.id === 'compress-image') {
        setStageText('Compressing image raster data...');
        const quality =
          compressionLevel === 'extreme' ? 0.4 : compressionLevel === 'recommended' ? 0.7 : 0.85;
        outputBlob = await compressImage(files[0], quality, 'image/jpeg');
        outName = `compressed_${files[0].name.replace(/\.[^/.]+$/, '')}.jpg`;
      } else if (tool.id === 'resize-image') {
        setStageText(`Resizing to ${resizeWidth}x${resizeHeight}px...`);
        const format = ['image/jpeg', 'image/png', 'image/webp'].includes(files[0].type)
          ? files[0].type
          : 'image/png';
        outputBlob = await resizeImage(files[0], resizeWidth, resizeHeight, format);
        const extension = outputBlob.type === 'image/jpeg' ? 'jpg' : outputBlob.type.split('/')[1] || 'png';
        outName = `resized_${files[0].name.replace(/\.[^/.]+$/, '')}.${extension}`;
      } else if (tool.id === 'crop-image') {
        setStageText(`Cropping image to ${cropWidth}×${cropHeight}px...`);
        outputBlob = await cropImage(files[0], cropX, cropY, cropWidth, cropHeight);
        outName = `cropped_${files[0].name}`;
      } else if (tool.id === 'convert-image') {
        setStageText(`Converting image to ${imageFormat.split('/')[1].toUpperCase()}...`);
        outputBlob = await convertImageFormat(files[0], imageFormat);
        const ext = outputBlob.type === 'image/png' ? 'png' : outputBlob.type === 'image/webp' ? 'webp' : 'jpg';
        outName = `converted_${files[0].name.replace(/\.[^/.]+$/, '')}.${ext}`;
      } else if (tool.id === 'rotate-image') {
        setStageText('Rotating & transforming image canvas...');
        outputBlob = await transformImage(files[0], rotationAngle);
        const extension = outputBlob.type === 'image/jpeg' ? 'jpg' : outputBlob.type.split('/')[1] || 'png';
        outName = `transformed_${files[0].name.replace(/\.[^/.]+$/, '')}.${extension}`;
      } else if (tool.id === 'deskew-scan') {
        if (files[0].type === 'application/pdf' || files[0].name.toLowerCase().endsWith('.pdf')) {
          throw new Error('Deskew currently supports image scans only. Save the required PDF page as an image and upload it here.');
        }
        setStageText(`Straightening scan by ${deskewAngle}°...`);
        outputBlob = await transformImage(files[0], deskewAngle);
        outName = `deskewed_${files[0].name}`;
      } else if (tool.id === 'remove-bg') {
        setStageText('Removing the background with rembg...');
        setProgress(15);
        outputBlob = await removeImageBackground(files[0]);
        setProgress(85);
        setStageText('Preparing transparent PNG...');
        outName = `${files[0].name.replace(/\.[^/.]+$/, '')}_nobg.png`;
      } else if (tool.id === 'grayscale-image') {
        setStageText('Applying monochrome filter...');
        outputBlob = await applyImageFilter(files[0], 'grayscale');
        outName = `grayscale_${files[0].name.replace(/\.[^/.]+$/, '')}.jpg`;
      } else if (tool.id === 'enhance-image') {
        setStageText('Enhancing scan contrast and sharpness...');
        outputBlob = await applyImageFilter(files[0], 'enhance');
        outName = `enhanced_${files[0].name.replace(/\.[^/.]+$/, '')}.jpg`;
      } else if (tool.id === 'image-ocr' || tool.id === 'pdf-ocr') {
        setStageText('Running optical character recognition...');
        const ocr = await performOCR(files[0], ocrLang, (p, text) => {
          setProgress(p);
          setStageText(text);
        });
        textContent = ocr.text;
        setExtractedOcrText(ocr.text);
        outputBlob = new Blob([ocr.text], { type: 'text/plain;charset=utf-8' });
        outName = `ocr_${files[0].name.replace(/\.[^/.]+$/, '')}.txt`;
      } else {
        throw new Error(`“${tool.name}” is not available yet. No file was changed or credits charged.`);
      }

      const processingLimitMinutes = billing.teamSubscription?.maximumProcessingMinutes || billingConfig.maximumProcessingMinutes;
      if (Date.now() - processingStartedAt > processingLimitMinutes * 60 * 1000) {
        throw new Error(`Processing exceeded the ${processingLimitMinutes}-minute plan limit. No credits were charged.`);
      }
      setProgress(100);
      setStageText('Done!');

      const totalOrig = files.reduce((acc, f) => acc + f.size, 0);
      const fileResult: ProcessedFileResult = {
        fileName: outName,
        fileSize: outputBlob.size,
        originalSize: totalOrig,
        blobUrl: '',
        type: outputBlob.type,
        extractedText: textContent || undefined,
        compressionRatio: totalOrig > 0 ? Math.round(((totalOrig - outputBlob.size) / totalOrig) * 100) : 0,
        rawBlob: outputBlob,
      };

      await onRecordActivity(files[0].name, totalOrig, outputBlob.size, tool.id, tool.name, requiredCredits);
      fileResult.blobUrl = URL.createObjectURL(outputBlob);
      setPdfPassword('');
      setPdfPasswordConfirmation('');
      setResult(fileResult);
    } catch (err: unknown) {
      console.error(err);
      if (err instanceof Error && err.message === 'INSUFFICIENT_CREDITS') {
        setIsInsufficientCreditsOpen(true);
      } else if (err instanceof Error && err.message === 'FAIR_USE_LIMIT') {
        setErrorMsg(`The team fair-use limit of ${billing.teamSubscription?.fairUseJobsPerHour} operations per hour has been reached.`);
      } else {
        setErrorMsg(err instanceof Error ? err.message : 'An error occurred during processing. Please try again.');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const copyToClipboard = () => {
    if (extractedOcrText) {
      navigator.clipboard.writeText(extractedOcrText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const downloadTextDoc = () => {
    if (!extractedOcrText) return;
    const blob = new Blob([extractedOcrText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcription_${Date.now()}.txt`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8 animate-fade-in">
      {/* Top back breadcrumb */}
      <div className="mb-6 flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to All Tools</span>
        </button>
        <div className="flex items-center gap-3">
          <span className="text-xs text-neutral-400 font-mono">ID: {tool.slug}</span>
        </div>
      </div>

      {/* Header */}
      <div className="mb-8">
        <h1 className="font-bold text-2xl font-bold tracking-tight text-neutral-900 dark:text-white sm:text-3xl">
          {tool.name}
        </h1>
        <p className="mt-2 text-xs sm:text-sm leading-relaxed text-neutral-600 dark:text-neutral-400 max-w-2xl">
          {tool.description}
        </p>
        <div className="mt-3 inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs dark:border-emerald-900/60 dark:bg-emerald-950/30">
          <span className="font-semibold text-emerald-800 dark:text-emerald-200">
            {developmentCreditBypass
              ? 'Development mode · credit limits disabled'
              : unlimitedAccess
                ? 'Team Unlimited'
                : `${requiredCredits} credits required`}
          </span>
          {!developmentCreditBypass && !unlimitedAccess && <span className="text-neutral-500">· {billing.creditBalance.toLocaleString()} available</span>}
          {!developmentCreditBypass && onOpenPricing && <button onClick={onOpenPricing} className="font-bold text-emerald-700 hover:underline dark:text-emerald-300">Buy credits</button>}
        </div>
      </div>

      {/* Main Workspace Card */}
      {tool.id === 'edit-pdf' && files.length > 0 && !result ? (
        <PdfEditorWorkspace
          file={files[0]}
          onBack={() => setFiles([])}
          onSaveCompleted={async (res) => {
            try {
              if (unlimitedAccess && isFairUseLimitReached(billing)) {
                setErrorMsg(`The team fair-use limit of ${billing.teamSubscription?.fairUseJobsPerHour} operations per hour has been reached.`);
                return;
              }
              if (!unlimitedAccess && billing.creditBalance < requiredCredits) {
                setIsInsufficientCreditsOpen(true);
                return;
              }
              await onRecordActivity(res.fileName, res.originalSize, res.fileSize, tool.id, tool.name, requiredCredits);
              setResult(res);
            } catch (saveError) {
              if (saveError instanceof Error && saveError.message === 'INSUFFICIENT_CREDITS') {
                setIsInsufficientCreditsOpen(true);
              } else {
                setErrorMsg(saveError instanceof Error ? saveError.message : 'Could not record the completed operation.');
              }
            }
          }}
        />
      ) : tool.id === 'rearrange-pdf' && files.length > 0 && !result ? (
        <PdfRearrangeWorkspace
          file={files[0]}
          onBack={() => setFiles([])}
          onSaveCompleted={async (res) => {
            try {
              if (unlimitedAccess && isFairUseLimitReached(billing)) {
                setErrorMsg(`The team fair-use limit of ${billing.teamSubscription?.fairUseJobsPerHour} operations per hour has been reached.`);
                return;
              }
              if (!unlimitedAccess && billing.creditBalance < requiredCredits) {
                setIsInsufficientCreditsOpen(true);
                return;
              }
              await onRecordActivity(res.fileName, res.originalSize, res.fileSize, tool.id, tool.name, requiredCredits);
              setResult(res);
            } catch (saveError) {
              if (saveError instanceof Error && saveError.message === 'INSUFFICIENT_CREDITS') {
                setIsInsufficientCreditsOpen(true);
              } else {
                setErrorMsg(saveError instanceof Error ? saveError.message : 'Could not record the completed operation.');
              }
            }
          }}
        />
      ) : tool.id === 'delete-pages' && files.length > 0 && !result ? (
        <PdfDeletePagesWorkspace
          file={files[0]}
          onBack={() => setFiles([])}
          onSaveCompleted={async (res) => {
            try {
              if (unlimitedAccess && isFairUseLimitReached(billing)) {
                setErrorMsg(`The team fair-use limit of ${billing.teamSubscription?.fairUseJobsPerHour} operations per hour has been reached.`);
                return;
              }
              if (!unlimitedAccess && billing.creditBalance < requiredCredits) {
                setIsInsufficientCreditsOpen(true);
                return;
              }
              await onRecordActivity(res.fileName, res.originalSize, res.fileSize, tool.id, tool.name, requiredCredits);
              setResult(res);
            } catch (saveError) {
              if (saveError instanceof Error && saveError.message === 'INSUFFICIENT_CREDITS') {
                setIsInsufficientCreditsOpen(true);
              } else {
                setErrorMsg(saveError instanceof Error ? saveError.message : 'Could not record the completed operation.');
              }
            }
          }}
        />
      ) : (
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 sm:p-8">
        {/* Upload Zone */}
        {files.length === 0 ? (
          <div
            ref={dropZoneRef}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50/20 px-6 py-12 text-center transition-colors hover:border-blue-500 hover:bg-blue-50/40 dark:border-blue-900/40 dark:bg-blue-950/20 dark:hover:border-blue-700 cursor-pointer"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={tool.acceptedTypes}
              multiple={tool.multipleFiles}
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400 mb-4 shadow-inner">
              <Upload className="h-6 w-6" />
            </div>
            <p className="text-sm font-bold text-neutral-900 dark:text-white">
              Drop your {tool.acceptedTypes.replace(/\*/g, '')} file here
            </p>
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              or click to browse from your device
            </p>
            <div className="mt-4 flex items-center gap-2 text-[11px] text-neutral-400">
              <span>Supports {tool.acceptedTypes}</span>
              <span aria-hidden="true">·</span>
              <span>Visual document preview supported</span>
            </div>
          </div>
        ) : (
          /* File List with Rich Previews */
          <div className="space-y-6">
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50/50 p-4 dark:border-neutral-800 dark:bg-neutral-950/50">
              <div className="flex items-center justify-between mb-3 text-xs font-bold uppercase tracking-wider text-neutral-500">
                <span>Selected Files & Previews ({files.length})</span>
                {tool.multipleFiles && (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="text-blue-600 dark:text-blue-400 hover:underline lowercase text-xs font-bold"
                  >
                    + add more files
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={tool.acceptedTypes}
                  multiple={tool.multipleFiles}
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>

              {/* Rich File Preview Cards */}
              <div className="flex gap-4 overflow-x-auto pb-2">
                {files.map((f, idx) => {
                  const isImg = f.type.startsWith('image/');
                  const isPdf = f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf');
                  return (
                    <div
                      key={`${f.name}-${idx}`}
                      draggable={files.length > 1}
                      onDragStart={(event) => {
                        setDraggedFileIndex(idx);
                        event.dataTransfer.effectAllowed = 'move';
                        event.dataTransfer.setData('text/plain', String(idx));
                      }}
                      onDragOver={(event) => {
                        if (draggedFileIndex !== null || event.dataTransfer.types.includes('Files')) {
                          event.preventDefault();
                          event.dataTransfer.dropEffect = draggedFileIndex !== null ? 'move' : 'copy';
                        }
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        if (draggedFileIndex !== null) {
                          moveSelectedFile(draggedFileIndex, idx);
                        } else if (event.dataTransfer.files.length > 0) {
                          acceptFiles(Array.from(event.dataTransfer.files));
                        }
                        setDraggedFileIndex(null);
                      }}
                      onDragEnd={() => setDraggedFileIndex(null)}
                      className={`relative flex w-40 shrink-0 flex-col items-center gap-2 rounded-xl border border-neutral-200 bg-white p-2.5 shadow-2xs dark:border-neutral-800 dark:bg-neutral-900 ${files.length > 1 ? 'cursor-grab active:cursor-grabbing' : ''} ${draggedFileIndex === idx ? 'opacity-40' : ''}`}
                    >
                      <div className="relative flex h-40 w-full items-center justify-center overflow-hidden rounded-lg border border-neutral-200 bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800">
                        {isPdf ? (
                          <PdfThumbnail file={f} previewClassName="h-full w-full rounded-none border-0" />
                        ) : (
                          <button
                            type="button"
                            onClick={() => setPreviewFile(f)}
                            className="flex h-full w-full items-center justify-center"
                            aria-label={`Zoom preview of ${f.name}`}
                            title="Zoom preview"
                            draggable={false}
                          >
                            <FileThumbnail file={f} previewClassName="h-full w-full rounded-none border-0" />
                          </button>
                        )}
                        <span className="pointer-events-none absolute bottom-2 left-2 rounded bg-black/65 px-1.5 py-0.5 text-[10px] font-medium text-white">
                          {f.type.startsWith('image/') ? 'Image' : isPdf ? 'PDF' : f.type || 'File'}
                        </span>
                        <button
                          type="button"
                          onClick={() => setPreviewFile(f)}
                          className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-md bg-white/95 text-neutral-700 shadow hover:bg-blue-50 hover:text-blue-600 dark:bg-neutral-900/95 dark:text-neutral-200"
                          aria-label={`Zoom preview of ${f.name}`}
                          title="Zoom preview"
                        >
                          <ZoomIn className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="flex w-full items-center justify-between px-0.5">
                        <span className="truncate text-[11px] text-neutral-500">{formatBytes(f.size)}</span>
                        <div className="flex items-center gap-1">
                          {files.length > 1 && (
                            <span className="flex h-7 w-7 items-center justify-center text-neutral-400" title="Drag to reorder">
                              <GripVertical className="h-4 w-4" />
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => removeFile(idx)}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-neutral-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
                            title="Remove file"
                            aria-label={`Remove ${f.name}`}
                            draggable={false}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Options Panel tailored per tool */}
            <div className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
              {/* Compression Slider */}
              {tool.id === 'compress-pdf' && (
                <p className="text-xs text-neutral-600 dark:text-neutral-400">
                  Applies lossless PDF structure optimization. Image data is not recompressed, so size reduction depends on the document.
                </p>
              )}
              {tool.id === 'compress-image' && (
                <div className="space-y-3">
                  <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                    Compression Level
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { id: 'extreme', label: 'High Compression', desc: 'Smallest file size' },
                      { id: 'recommended', label: 'Recommended', desc: 'Balanced quality & size' },
                      { id: 'high', label: 'Less Compression', desc: 'Maximum fidelity' },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setCompressionLevel(opt.id as any)}
                        className={`rounded-xl border p-3 text-left transition-all ${
                          compressionLevel === opt.id
                            ? 'border-blue-600 bg-blue-600 text-white shadow-xs'
                            : 'border-neutral-200 bg-neutral-50 hover:bg-neutral-100 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300'
                        }`}
                      >
                        <div className="text-xs font-bold">{opt.label}</div>
                        <div className="text-[11px] opacity-80 mt-0.5">{opt.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Background Remover */}
              {tool.id === 'remove-bg' && (
                <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-600 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-400">
                  rembg runs on this computer with no paid service. Choose Remove Background once to download a transparent PNG. The first run downloads the model.
                </div>
              )}

              {/* Watermark text */}
              {tool.id === 'add-watermark' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block mb-1">
                      Watermark Stamp Text
                    </label>
                    <input
                      type="text"
                      value={watermarkText}
                      onChange={(e) => setWatermarkText(e.target.value)}
                      className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs text-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
                      placeholder="e.g. CONFIDENTIAL or DRAFT"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block mb-1">
                      Opacity: {Math.round(watermarkOpacity * 100)}%
                    </label>
                    <input
                      type="range"
                      min="0.1"
                      max="0.8"
                      step="0.05"
                      value={watermarkOpacity}
                      onChange={(e) => setWatermarkOpacity(parseFloat(e.target.value))}
                      className="w-full mt-2 accent-blue-600"
                    />
                  </div>
                </div>
              )}

              {tool.id === 'edit-metadata' && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {[
                    ['Title', metadataTitle, setMetadataTitle],
                    ['Author', metadataAuthor, setMetadataAuthor],
                    ['Subject', metadataSubject, setMetadataSubject],
                    ['Keywords (comma separated)', metadataKeywords, setMetadataKeywords],
                  ].map(([label, value, setter]) => (
                    <label key={label as string} className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                      {label as string}
                      <input
                        type="text"
                        value={value as string}
                        onChange={(event) => (setter as (value: string) => void)(event.target.value)}
                        className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs font-normal text-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
                      />
                    </label>
                  ))}
                </div>
              )}

              {tool.id === 'protect-pdf' && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                    PDF password (minimum 8 characters)
                    <input
                      type="password"
                      autoComplete="new-password"
                      value={pdfPassword}
                      onChange={(event) => setPdfPassword(event.target.value)}
                      className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs text-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
                    />
                  </label>
                  <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                    Confirm password
                    <input
                      type="password"
                      autoComplete="new-password"
                      value={pdfPasswordConfirmation}
                      onChange={(event) => setPdfPasswordConfirmation(event.target.value)}
                      className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs text-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
                    />
                  </label>
                  <p className="text-xs text-neutral-500 sm:col-span-2">
                    AES-256 encrypted. Passwords are used only in this browser session and are not saved by the app. Keep your password safe; it cannot be recovered.
                  </p>
                </div>
              )}

              {tool.id === 'unlock-pdf' && (
                <label className="block max-w-md text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  PDF password
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={pdfPassword}
                    onChange={(event) => setPdfPassword(event.target.value)}
                    className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs text-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
                  />
                  <span className="mt-1 block font-normal text-neutral-500">Only unlock files you own or are authorized to modify.</span>
                </label>
              )}

              {tool.id === 'bates-numbering' && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                    Prefix
                    <input
                      type="text"
                      value={batesPrefix}
                      onChange={(event) => setBatesPrefix(event.target.value)}
                      maxLength={30}
                      className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs text-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
                    />
                  </label>
                  <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                    Starting number
                    <input
                      type="number"
                      min="1"
                      value={batesStart}
                      onChange={(event) => setBatesStart(Math.max(1, Number(event.target.value) || 1))}
                      className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs text-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
                    />
                  </label>
                </div>
              )}

              {tool.id === 'crop-image' && (
                <div>
                  <p className="mb-3 text-xs text-neutral-600 dark:text-neutral-400">
                    Enter the crop rectangle in pixels. The uploaded image is {cropImageDimensions.width} × {cropImageDimensions.height}px; values outside it are rejected.
                  </p>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[
                      ['Left (px)', cropX, setCropX],
                      ['Top (px)', cropY, setCropY],
                      ['Width (px)', cropWidth, setCropWidth],
                      ['Height (px)', cropHeight, setCropHeight],
                    ].map(([label, value, setter]) => (
                      <label key={label as string} className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                        {label as string}
                        <input
                          type="number"
                          min="0"
                          value={value as number}
                          onChange={(event) => (setter as (value: number) => void)(Math.max(0, Number(event.target.value) || 0))}
                          className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs text-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
                        />
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {tool.id === 'deskew-scan' && (
                <label className="block max-w-xs text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  Rotation correction (degrees, -45 to 45)
                  <input
                    type="number"
                    min="-45"
                    max="45"
                    step="0.1"
                    value={deskewAngle}
                    onChange={(event) => setDeskewAngle(Math.max(-45, Math.min(45, Number(event.target.value) || 0)))}
                    className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs text-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
                  />
                  <span className="mt-1 block font-normal text-neutral-500">Adjust the angle manually; automatic skew detection is not available.</span>
                </label>
              )}

              {/* Rotation angle */}
              {(tool.id === 'rotate-pdf' || tool.id === 'rotate-image') && (
                <div>
                  <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block mb-2">
                    Rotation Direction
                  </label>
                  <div className="flex gap-2">
                    {[
                      { angle: 90, label: '90° Clockwise' },
                      { angle: 180, label: '180° Invert' },
                      { angle: 270, label: '270° Counter-CW' },
                    ].map((item) => (
                      <button
                        key={item.angle}
                        type="button"
                        onClick={() => setRotationAngle(item.angle)}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                          rotationAngle === item.angle
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Page numbers pos */}
              {tool.id === 'page-numbers' && (
                <div>
                  <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block mb-2">
                    Position on Page
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setPageNumberPos('bottom')}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold ${
                        pageNumberPos === 'bottom'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'
                      }`}
                    >
                      Bottom Center (Standard)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPageNumberPos('top')}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold ${
                        pageNumberPos === 'top'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'
                      }`}
                    >
                      Top Header Center
                    </button>
                  </div>
                </div>
              )}

              {/* OCR language */}
              {(tool.id === 'image-ocr' || tool.id === 'pdf-ocr') && (
                <div>
                  <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block mb-1">
                    Recognition Language
                  </label>
                  <select
                    value={ocrLang}
                    onChange={(e) => setOcrLang(e.target.value)}
                    className="w-full sm:w-72 rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs text-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
                  >
                    {SUPPORTED_OCR_LANGUAGES.map((lang) => (
                      <option key={lang.code} value={lang.code}>
                        {lang.name}
                      </option>
                    ))}
                  </select>
                  <p className="mt-2 text-xs text-neutral-500">
                    OCR runs in your browser. Language data may need to download the first time you use a language.
                  </p>
                </div>
              )}

              {/* Image Convert format */}
              {tool.id === 'convert-image' && (
                <div>
                  <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block mb-2">
                    Target Format
                  </label>
                  <div className="flex gap-2">
                    {[
                      { fmt: 'image/jpeg', label: 'JPG / JPEG' },
                      { fmt: 'image/png', label: 'PNG Lossless' },
                      { fmt: 'image/webp', label: 'WebP Modern' },
                    ].map((item) => (
                      <button
                        key={item.fmt}
                        type="button"
                        onClick={() => setImageFormat(item.fmt as any)}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold ${
                          imageFormat === item.fmt
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Image Resize */}
              {tool.id === 'resize-image' && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 items-end">
                  <div>
                    <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block mb-1">
                      Width (px)
                    </label>
                    <input
                      type="number"
                      value={resizeWidth}
                      onChange={(e) => handleWidthChange(parseInt(e.target.value, 10) || 100)}
                      className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-1.5 text-xs text-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block mb-1">
                      Height (px)
                    </label>
                    <input
                      type="number"
                      value={resizeHeight}
                      onChange={(e) => handleHeightChange(parseInt(e.target.value, 10) || 100)}
                      className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-1.5 text-xs text-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-400 cursor-pointer pb-2">
                      <input
                        type="checkbox"
                        checked={lockAspect}
                        onChange={(e) => setLockAspect(e.target.checked)}
                        className="rounded accent-blue-600"
                      />
                      <span>Lock Aspect Ratio</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Page ranges for split/extract/delete */}
              {tool.id === 'extract-pages' && (
                <div>
                  <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block mb-1">
                    Pages to Extract (e.g. 1, 3, 5)
                  </label>
                  <input
                    type="text"
                    value={pageSelection}
                    onChange={(e) => setPageSelection(e.target.value)}
                    placeholder="1, 2, 3"
                    className="w-full sm:w-64 rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs text-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
                  />
                </div>
              )}
            </div>

            {/* Error banner */}
            {errorMsg && (
              <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Progress indicator */}
            {isProcessing && (
              <div className="space-y-2 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-950">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-neutral-700 dark:text-neutral-300">
                    {stageText}
                  </span>
                  <span className="font-mono text-neutral-500 tabular-nums">{progress}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                  <div
                    className="h-full bg-blue-600 transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Process Action Button - Blue accent */}
            {!result && (
              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={executeProcessing}
                  className="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-xs sm:text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm"
                >
                  <RefreshCw className={`h-4 w-4 ${isProcessing ? 'animate-spin' : ''}`} />
                  <span>
                    {isProcessing
                      ? tool.id === 'remove-bg' ? 'Removing background...' : 'Processing...'
                      : tool.id === 'remove-bg'
                        ? 'Remove Background'
                        : `Process with ${tool.name} · ${
                            developmentCreditBypass
                              ? 'Development mode'
                              : unlimitedAccess
                                ? 'Unlimited'
                                : `${requiredCredits} credits`
                          }`}
                  </span>
                </button>
              </div>
            )}

            {/* Results Section */}
            {result && (
              <div className="space-y-6 pt-4 border-t border-neutral-200 dark:border-neutral-800 animate-fade-in">
                {/* Status bar */}
                <div className="flex items-center justify-between rounded-2xl bg-emerald-50 p-4 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    <div>
                      <div className="text-xs sm:text-sm font-bold">Processing Complete!</div>
                      <div className="text-xs opacity-90">
                        {result.fileName} is ready for download & sharing.
                      </div>
                    </div>
                  </div>

                  {result.compressionRatio !== undefined && result.compressionRatio > 0 && (
                    <div className="text-right">
                      <div className="text-xs font-semibold">Saved</div>
                      <div className="font-mono text-sm font-bold tabular-nums">
                        {result.compressionRatio}%
                      </div>
                    </div>
                  )}
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div className="rounded-xl border border-neutral-200 p-3.5 dark:border-neutral-800">
                    <div className="text-[11px] text-neutral-500 uppercase font-semibold">Original Size</div>
                    <div className="font-mono text-xs sm:text-sm font-bold text-neutral-900 dark:text-white tabular-nums">
                      {formatBytes(result.originalSize)}
                    </div>
                  </div>
                  <div className="rounded-xl border border-neutral-200 p-3.5 dark:border-neutral-800">
                    <div className="text-[11px] text-neutral-500 uppercase font-semibold">Processed Size</div>
                    <div className="font-mono text-xs sm:text-sm font-bold text-neutral-900 dark:text-white tabular-nums">
                      {formatBytes(result.fileSize)}
                    </div>
                  </div>
                  <div className="col-span-2 sm:col-span-1 rounded-xl border border-neutral-200 p-3.5 dark:border-neutral-800">
                    <div className="text-[11px] text-neutral-500 uppercase font-semibold">Storage Privacy</div>
                    <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      {tool.id === 'edit-pdf'
                        ? 'Local OCR & PDF editing'
                        : tool.id === 'remove-bg'
                          ? 'Local rembg processing'
                          : 'Processed in this browser'}
                    </div>
                  </div>
                </div>

                {/* Visual Cutout Preview for Background Remover */}
                {tool.id === 'remove-bg' && result.blobUrl && (
                  <div className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                        <Wand2 className="h-4 w-4 text-blue-600" />
                        <span>High-Definition Cutout Preview</span>
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
                          Lossless Alpha PNG
                        </span>
                        <button
                          type="button"
                          onClick={retryBackgroundRemoval}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-300 dark:hover:bg-blue-950"
                          title="Adjust settings and run background removal again"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                          Try again
                        </button>
                      </div>
                    </div>

                    <div className="relative rounded-xl overflow-hidden border border-neutral-200 dark:border-neutral-800 flex items-center justify-center p-4 min-h-[260px] max-h-[460px] bg-[repeating-conic-gradient(#e5e7eb_0%_25%,#ffffff_0%_50%)] dark:bg-[repeating-conic-gradient(#1f2937_0%_25%,#111827_0%_50%)] [background-size:20px_20px]">
                      <img
                        src={result.blobUrl}
                        alt="Background removed cutout"
                        className="max-h-[380px] w-auto object-contain drop-shadow-md rounded-lg"
                      />
                    </div>
                  </div>
                )}

                {/* Extracted OCR Text if applicable */}
                {extractedOcrText && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-neutral-800 dark:text-neutral-200">
                        Extracted Document Text
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={copyToClipboard}
                          className="flex items-center gap-1 rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-xs hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 font-semibold"
                        >
                          {copied ? (
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="h-3.5 w-3.5 text-blue-600" />
                          )}
                          <span>{copied ? 'Copied!' : 'Copy Text'}</span>
                        </button>
                        <button
                          onClick={downloadTextDoc}
                          className="flex items-center gap-1 rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-xs hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 font-semibold"
                        >
                          <FileText className="h-3.5 w-3.5 text-blue-600" />
                          <span>Download TXT</span>
                        </button>
                      </div>
                    </div>
                    <textarea
                      readOnly
                      rows={8}
                      value={extractedOcrText}
                      className="w-full rounded-xl border border-neutral-200 bg-neutral-50 p-3.5 font-mono text-xs leading-relaxed text-neutral-800 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200 focus:outline-none"
                    />
                  </div>
                )}

                {/* Primary download, mobile QR, and Share actions */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                  <button
                    onClick={() => {
                      setFiles([]);
                      setResult(null);
                    }}
                    className="w-full sm:w-auto text-xs font-semibold text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
                  >
                    ← Process Another File
                  </button>

                  <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto justify-end">
                    {/* Share Button */}
                    {onShareFile && (
                      <button
                        type="button"
                        onClick={() =>
                          onShareFile({
                            name: result.fileName,
                            size: result.fileSize,
                            blobUrl: result.blobUrl,
                            blob: result.rawBlob,
                          })
                        }
                        className="flex items-center justify-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50/70 px-3.5 py-2.5 text-xs sm:text-sm font-bold text-blue-700 hover:bg-blue-100 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300 transition-colors shadow-2xs"
                      >
                        <Share2 className="h-4 w-4" />
                        <span>Share</span>
                      </button>
                    )}

                    {/* Take to Phone QR Button */}
                    {onTakeToPhone && result.rawBlob && (
                      <button
                        type="button"
                        onClick={() =>
                          onTakeToPhone({
                            name: result.fileName,
                            blob: result.rawBlob!,
                            size: result.fileSize,
                          })
                        }
                        className="flex items-center justify-center gap-1.5 rounded-xl border border-blue-600 bg-blue-50 px-3.5 py-2.5 text-xs sm:text-sm font-bold text-blue-700 hover:bg-blue-100 dark:border-blue-500 dark:bg-blue-950/60 dark:text-blue-300 transition-colors shadow-2xs"
                      >
                        <QrCode className="h-4 w-4" />
                        <span>Take to Phone (QR)</span>
                      </button>
                    )}

                    {/* Download File Button - Blue accent */}
                    <a
                      href={result.blobUrl}
                      download={result.fileName}
                      className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs sm:text-sm font-bold text-white hover:bg-blue-700 transition-colors shadow-sm"
                    >
                      <Download className="h-4 w-4" />
                      <span>{tool.id === 'edit-pdf' ? 'Download Edited PDF' : 'Download File'}</span>
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      )}

      <InsufficientBalanceModal
        isOpen={isInsufficientCreditsOpen}
        onClose={() => setIsInsufficientCreditsOpen(false)}
        onBuyCredits={() => {
          setIsInsufficientCreditsOpen(false);
          onOpenPricing?.();
        }}
        currentBalance={billing.creditBalance}
        requiredCredits={requiredCredits}
      />

      {previewFile && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-6"
          role="presentation"
          onClick={() => setPreviewFile(null)}
        >
          <div
            className="relative flex max-h-[90vh] max-w-[90vw] items-center justify-center rounded-2xl bg-white p-5 shadow-2xl dark:bg-neutral-900"
            role="dialog"
            aria-modal="true"
            aria-label="File preview"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setPreviewFile(null)}
              className="absolute right-2 top-2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200"
              aria-label="Close preview"
            >
              <X className="h-5 w-5" />
            </button>
            {previewFile.type === 'application/pdf' || previewFile.name.toLowerCase().endsWith('.pdf') ? (
              <PdfThumbnail
                file={previewFile}
                large
                previewClassName="flex max-h-[82vh] max-w-[86vw] items-center justify-center"
              />
            ) : (
              <FileThumbnail
                file={previewFile}
                large
                previewClassName="flex max-h-[82vh] max-w-[86vw] items-center justify-center"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const FileThumbnail: React.FC<{ file: File; previewClassName?: string; large?: boolean }> = ({
  file,
  previewClassName,
  large = false,
}) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const isImage = file.type.startsWith('image/');

  useEffect(() => {
    if (!isImage) {
      setImageUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file, isImage]);

  return (
    <div className={`flex shrink-0 items-center justify-center overflow-hidden border-neutral-200 bg-blue-50 text-blue-600 dark:border-neutral-700 dark:bg-blue-950/60 dark:text-blue-400 ${previewClassName ? '' : 'h-14 w-14 rounded-lg border'} ${previewClassName || ''}`}>
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={`${file.name} preview`}
          className={large ? 'max-h-[82vh] max-w-[86vw] object-contain' : 'h-full w-full object-cover'}
        />
      ) : (
        <FileText className="h-6 w-6" />
      )}
    </div>
  );
};

const PdfThumbnail: React.FC<{ file: File; previewClassName?: string; large?: boolean }> = ({
  file,
  previewClassName,
  large = false,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [pdfDocument, setPdfDocument] = useState<Awaited<ReturnType<typeof loadPdfJsDoc>> | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let loadedDocument: Awaited<ReturnType<typeof loadPdfJsDoc>> | null = null;
    setFailed(false);
    setPdfDocument(null);
    setPageCount(0);

    const loadDocument = async () => {
      try {
        loadedDocument = await loadPdfJsDoc(file);
        if (cancelled) {
          await loadedDocument.cleanup();
          return;
        }
        setPdfDocument(loadedDocument);
        setPageCount(loadedDocument.numPages);
      } catch (error) {
        if (!cancelled) {
          console.error(`Could not load PDF preview for ${file.name}:`, error);
          setFailed(true);
        }
      }
    };

    void loadDocument();
    return () => {
      cancelled = true;
      if (loadedDocument) void loadedDocument.cleanup();
    };
  }, [file]);

  return (
    <div
      ref={scrollRef}
      className={`${large
        ? 'max-h-[82vh] max-w-[86vw] overflow-y-auto'
        : 'overflow-x-auto overflow-y-hidden'
      } ${previewClassName ? '' : 'rounded-lg border border-neutral-200 bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800'} ${previewClassName || ''}`}
      aria-label={`${file.name} PDF pages`}
    >
      {failed ? (
        <FileText className="h-6 w-6 text-blue-600 dark:text-blue-400" />
      ) : pdfDocument ? (
        <div className={large ? 'relative' : 'relative h-full w-max'}>
          {!large && (
            <span className="absolute left-1 top-1 z-10 rounded bg-black/65 px-1.5 py-0.5 text-[9px] font-medium text-white">
              {pageCount} {pageCount === 1 ? 'page' : 'pages'} · scroll →
            </span>
          )}
          <div
            className={large
              ? 'flex min-w-full flex-col items-center gap-4 p-3'
              : 'flex h-full w-max items-center gap-2 px-2'}
          >
            {Array.from({ length: pageCount }, (_, index) => (
              <PdfPagePreview
                key={index}
                pdfDocument={pdfDocument}
                pageNumber={index + 1}
                large={large}
                scrollRoot={scrollRef}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="flex h-full min-w-full items-center justify-center text-xs text-neutral-500">
          Loading PDF…
        </div>
      )}
    </div>
  );
};

const PdfPagePreview: React.FC<{
  pdfDocument: Awaited<ReturnType<typeof loadPdfJsDoc>>;
  pageNumber: number;
  large: boolean;
  scrollRoot: React.RefObject<HTMLDivElement | null>;
}> = ({ pdfDocument, pageNumber, large, scrollRoot }) => {
  const previewRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const element = previewRef.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { root: scrollRoot.current, rootMargin: '300px' },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [scrollRoot]);

  useEffect(() => {
    if (!isVisible || !canvasRef.current) return;
    let cancelled = false;
    let page: Awaited<ReturnType<typeof pdfDocument.getPage>> | null = null;
    const render = async () => {
      try {
        page = await pdfDocument.getPage(pageNumber);
        if (cancelled || !canvasRef.current) return;
        const viewport = page.getViewport({ scale: 1 });
        const maxWidth = large ? 1200 : 100;
        const maxHeight = large ? 1500 : 160;
        const scale = Math.min(maxWidth / viewport.width, maxHeight / viewport.height);
        await renderPageToCanvas(pdfDocument, pageNumber, canvasRef.current, scale);
      } catch (error) {
        if (!cancelled) {
          console.error(`Could not render PDF page ${pageNumber}:`, error);
          setFailed(true);
        }
      } finally {
        page?.cleanup();
      }
    };
    void render();
    return () => {
      cancelled = true;
      page?.cleanup();
    };
  }, [isVisible, large, pageNumber, pdfDocument]);

  return (
    <div
      ref={previewRef}
      className={large
        ? 'flex w-full flex-col items-center gap-1'
        : 'flex h-full shrink-0 flex-col items-center justify-center gap-0.5'}
    >
      {failed ? (
        <div className="flex h-24 w-16 items-center justify-center rounded border bg-white text-[10px] text-red-500">
          Preview unavailable
        </div>
      ) : (
        <canvas
          ref={canvasRef}
          aria-label={`Preview of PDF page ${pageNumber}`}
          className={large
            ? 'max-h-[68vh] max-w-[82vw] rounded border border-neutral-200 bg-white object-contain shadow-sm dark:border-neutral-700'
            : 'max-h-[128px] max-w-[100px] rounded border border-neutral-200 bg-white object-contain dark:border-neutral-700'}
        />
      )}
      <span className="text-[10px] font-medium text-neutral-500">Page {pageNumber}</span>
    </div>
  );
};
