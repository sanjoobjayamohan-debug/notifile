import React from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Coins,
  FileImage,
  FileText,
  ImageOff,
  Users,
} from 'lucide-react';
import type { BillingConfiguration } from '../config/billingConfig';

interface HelpCenterProps {
  config: BillingConfiguration;
  onClose: () => void;
  onOpenPricing: () => void;
  onOpenTool: (toolId: string) => void;
}

interface GuideProps {
  number: string;
  title: string;
  description: string;
  icon: React.ElementType;
  actionLabel?: string;
  onAction?: () => void;
  children: React.ReactNode;
}

const Guide: React.FC<GuideProps> = ({
  number,
  title,
  description,
  icon: Icon,
  actionLabel,
  onAction,
  children,
}) => (
  <article className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 sm:p-6">
    <div className="flex items-start gap-4">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-300">Guide {number}</div>
        <h2 className="mt-1 text-lg font-bold text-neutral-900 dark:text-white">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-neutral-500 dark:text-neutral-400">{description}</p>
        <div className="mt-4">{children}</div>
        {actionLabel && onAction && (
          <button onClick={onAction} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-blue-700">
            {actionLabel}<ArrowRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  </article>
);

const Steps = ({ children }: { children: React.ReactNode }) => (
  <ol className="list-decimal space-y-2 pl-5 text-sm leading-6 text-neutral-600 marker:font-semibold marker:text-blue-600 dark:text-neutral-300 dark:marker:text-blue-300">
    {children}
  </ol>
);

export const HelpCenter: React.FC<HelpCenterProps> = ({
  config,
  onClose,
  onOpenPricing,
  onOpenTool,
}) => {
  const plans = config.creditPlans.filter((plan) => plan.active);

  return (
    <div className="fixed inset-0 z-50 h-[100dvh] overflow-y-auto bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-neutral-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/95 sm:px-8">
        <button onClick={onClose} className="inline-flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800">
          <ArrowLeft className="h-4 w-4" /> Back to Notifile
        </button>
        <span className="text-sm font-bold text-neutral-900 dark:text-white">Notifile Help Center</span>
        <button onClick={onOpenPricing} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700">Plans & credits</button>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-12">
        <div className="mb-8 max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
            <FileText className="h-3.5 w-3.5" /> Product guides
          </div>
          <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">Get more done with your files</h1>
          <p className="mt-3 text-sm leading-6 text-neutral-500 dark:text-neutral-400">
            Practical guides for editing, image tools, conversions, prepaid credits, and team plans.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Guide
            number="01"
            title="Remove an image background"
            description="Use the local rembg model to make a transparent cutout without a paid external service."
            icon={ImageOff}
            actionLabel="Open Background Remover"
            onAction={() => onOpenTool('remove-bg')}
          >
            <Steps>
              <li>Open <strong>Remove Background</strong> and upload an image.</li>
              <li>Choose <strong>Remove Background</strong> once to generate a transparent PNG with rembg.</li>
              <li>Preview the result and download the processed image.</li>
              <li>The first run downloads the rembg model. Processing runs through the local backend and does not store the uploaded image or use a paid external service.</li>
            </Steps>
          </Guide>

          <Guide
            number="02"
            title="Convert and compress files"
            description="Choose the appropriate PDF or image tool from the tool catalog."
            icon={FileImage}
            actionLabel="Browse file tools"
            onAction={() => onOpenTool('pdf-to-jpg')}
          >
            <Steps>
              <li>Search the tool catalog for a conversion or compression tool and upload your file.</li>
              <li>Set the available options, such as compression level or output image format.</li>
              <li>Review the required credits beside the process button before you start.</li>
              <li>Download the result after processing completes. Available formats and options depend on the selected tool.</li>
            </Steps>
          </Guide>

          <Guide
            number="03"
            title="Edit PDF text locally"
            description="Use local text extraction or Tesseract OCR to replace text and insert new text with bundled fonts."
            icon={FileText}
            actionLabel="Open Edit PDF Text"
            onAction={() => onOpenTool('edit-pdf')}
          >
            <Steps>
              <li>Open <strong>Edit PDF Text</strong> and choose a PDF. Select a highlighted text box or switch to insertion mode.</li>
              <li>Set the text, bundled font, size, and color, then queue your replacement or click the page to place inserted text.</li>
              <li>Save the PDF to download a locally edited copy. Original page images are not resampled or recompressed.</li>
              <li>Scanned-text replacement masks the OCR bounding box with a sampled background color. The API and OCR run on this computer; Tesseract and Poppler setup is described in the README.</li>
            </Steps>
          </Guide>

          <Guide
            number="03"
            title="Manage prepaid credits"
            description="Credits give you flexible, pay-per-operation access. Your active balance and transaction history are in the account dashboard."
            icon={Coins}
            actionLabel="View credit plans"
            onAction={onOpenPricing}
          >
            <Steps>
              <li>Open your account dashboard to see your credit balance, credits purchased and used, expiry dates, and recent transactions.</li>
              <li>Choose a pack on the <strong>Credits</strong> pricing tab. Current enabled packs are {plans.length ? plans.map((plan) => `₹${plan.price.toLocaleString('en-IN')}`).join(', ') : 'shown on the pricing page'}.</li>
              <li>Each tool displays its configured credit cost before processing. A successful operation deducts credits; a failed operation does not.</li>
              <li>An active Team Unlimited subscription is used first and does not consume credits. When it expires, remaining credits are used again.</li>
            </Steps>
          </Guide>

          <Guide
            number="04"
            title="Manage a team plan"
            description="Team Unlimited is priced by seat count and duration, and remains subject to configured file-size, processing-time, and fair-use limits."
            icon={Users}
            actionLabel="Compare team plans"
            onAction={onOpenPricing}
          >
            <Steps>
              <li>Choose a seat count and a 7-day, monthly, or yearly duration on the <strong>Team Unlimited</strong> tab. The total updates automatically.</li>
              <li>After checkout, the team owner can name the team, review the subscription dates, and add or remove member seats.</li>
              <li>New members are stored as pending entries. Email delivery, member acceptance, and domain verification are not enabled yet.</li>
              <li>During the active period, team access avoids credit deductions. Team usage is still limited by the plan’s fair-use and resource settings.</li>
            </Steps>
          </Guide>
        </div>

        <div className="mt-8 rounded-2xl border border-blue-200 bg-blue-50 p-5 text-sm leading-6 text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-100">
          <strong>Checkout note:</strong> purchases are currently simulated for development; no payment is collected. Use pricing and checkout only as a preview until a live payment provider is connected.
        </div>
      </main>
    </div>
  );
};
