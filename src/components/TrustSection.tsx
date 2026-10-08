import React, { useState } from 'react';
import { ShieldCheck, Lock, Cpu, ChevronDown, Check, FileCheck2 } from 'lucide-react';

export const TrustSection: React.FC = () => {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const steps = [
    {
      step: '01',
      title: 'Upload Your File',
      desc: 'Select or drag & drop your PDF, image, or document into the high-speed workspace.',
    },
    {
      step: '02',
      title: 'Configure Parameters',
      desc: 'Fine-tune compression levels, watermark text, rotation angle, or OCR target language.',
    },
    {
      step: '03',
      title: 'Instant Download',
      desc: 'Download your processed file instantly. All temporary cache is immediately wiped.',
    },
  ];

  const faqs = [
    {
      q: 'Are my files kept secure and private?',
      a: 'Yes. Notifile executes operations directly in your browser using WebAssembly and client-side canvas and vector libraries. Your files never sit on permanent disk storage and are wiped after your session.',
    },
    {
      q: 'What languages does Notifile OCR support?',
      a: 'We support English, Malayalam (മലയാളം), Hindi (हिन्दी), Tamil (தமிழ்), Kannada, Telugu, Spanish, German, French, and Arabic with specialized optical recognition.',
    },
    {
      q: 'Is there a limit on how many files I can process?',
      a: 'Free users can process documents up to 50 MB with no daily quotas. Upgraded plans support batch uploads of up to 50 files simultaneously with larger limits.',
    },
    {
      q: 'Can I use Notifile on mobile devices and tablets?',
      a: 'Absolutely. Notifile is fully responsive and optimized for touch screens, mobile safari, and Android browsers.',
    },
  ];

  return (
    <div className="border-t border-neutral-200 bg-neutral-50/50 py-16 dark:border-neutral-800 dark:bg-neutral-950/50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-16">
        {/* How it works */}
        <div>
          <div className="text-center max-w-xl mx-auto mb-10">
            <h2 className="font-display text-2xl font-bold tracking-tight text-neutral-900 dark:text-white sm:text-3xl">
              How Notifile Works
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-neutral-500 dark:text-neutral-400">
              Three seamless steps from raw document to production-ready file.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {steps.map((st) => (
              <div
                key={st.step}
                className="relative rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900 shadow-2xs"
              >
                <div className="font-mono text-xs font-bold text-neutral-400 dark:text-neutral-500 mb-2">
                  {st.step}
                </div>
                <h3 className="font-display text-base font-semibold text-neutral-900 dark:text-white">
                  {st.title}
                </h3>
                <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                  {st.desc}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Privacy & Trust statement */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-8 dark:border-neutral-800 dark:bg-neutral-900 sm:p-10">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3 items-center">
            <div className="md:col-span-2 space-y-3">
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                <ShieldCheck className="h-4 w-4" />
                <span>Enterprise Privacy Standard</span>
              </div>
              <h3 className="font-display text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
                Your files, your privacy.
              </h3>
              <p className="text-xs sm:text-sm leading-relaxed text-neutral-600 dark:text-neutral-400 max-w-xl">
                We believe document utilities should not harvest your private contracts, financial
                spreadsheets, or personal photos. Notifile isolates your data in sandboxed browser
                memory. No permanent disk storage, no unauthorized training, no third-party leaks.
              </p>
            </div>

            <div className="space-y-3 border-t md:border-t-0 md:border-l border-neutral-200 pt-6 md:pt-0 md:pl-8 dark:border-neutral-800 text-xs">
              <div className="flex items-center gap-2 text-neutral-700 dark:text-neutral-300">
                <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>Encrypted in memory during conversion</span>
              </div>
              <div className="flex items-center gap-2 text-neutral-700 dark:text-neutral-300">
                <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>Automatic sandbox cleanup on session close</span>
              </div>
              <div className="flex items-center gap-2 text-neutral-700 dark:text-neutral-300">
                <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>HTTPS end-to-end transport protocol</span>
              </div>
            </div>
          </div>
        </div>

        {/* FAQ Accordion */}
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="font-display text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
              Frequently Asked Questions
            </h2>
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              Clear answers regarding security, format support, and performance.
            </p>
          </div>

          <div className="divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-white dark:divide-neutral-800 dark:border-neutral-800 dark:bg-neutral-900 overflow-hidden">
            {faqs.map((faq, index) => {
              const isOpen = openFaq === index;
              return (
                <div key={faq.q} className="p-4 sm:p-5">
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : index)}
                    className="flex w-full items-center justify-between text-left text-sm font-semibold text-neutral-900 dark:text-white"
                  >
                    <span>{faq.q}</span>
                    <ChevronDown
                      className={`h-4 w-4 text-neutral-400 transition-transform ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <p className="mt-3 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400 animate-fade-in">
                      {faq.a}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
