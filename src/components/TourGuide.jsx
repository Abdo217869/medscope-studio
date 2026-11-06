import { useState } from 'preact/hooks';
import { Sparkles, ArrowRight, ArrowLeft, Check, X } from 'lucide-preact';

const TOUR_STEPS = [
  {
    target: 'step-rail',
    title: '1. Workflow Step Rail',
    desc: 'The left rail guides your workflow in 3 distinct steps:\n• 1 Editor: Setup module, Import JSON, and Edit sessions.\n• 2 Style: Theme studio for fonts, fills, geometry, and branding.\n• 3 Export: One-click PDF, multi-page PDFs, and high-res batch ZIPs.',
    position: 'left'
  },
  {
    target: 'live-preview',
    title: '2. Pixel-Perfect A4 Live Preview',
    desc: 'Your timetable is rendered in real time on a precision 1414×2000 px canvas (matching university print specifications).\nUse the sticky preview toolbar below to zoom in/out, fit to screen, and inspect section pages.',
    position: 'center'
  },
  {
    target: 'validator-badge',
    title: '3. Real-Time Validator Badge',
    desc: 'The Validator badge in the top header continuously audits your schedule in the background. Click it anytime to open the Validator side panel to inspect room collisions, schedule gaps, and student group overlaps.',
    position: 'top'
  },
  {
    target: 'export-button',
    title: '4. Export Studio',
    desc: 'Click the gold Export button to generate individual section PDFs, combined multi-page documents, or lossless batch ZIPs at up to 300+ DPI print quality.',
    position: 'right'
  }
];

export function TourGuide({ isOpen, onClose }) {
  if (!isOpen) return null;

  const [currentStep, setCurrentStep] = useState(0);
  const step = TOUR_STEPS[currentStep];

  const handleNext = () => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleComplete = () => {
    try {
      localStorage.setItem('medscope_tour_dismissed', 'true');
    } catch (e) {}
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm select-none animate-in fade-in duration-200">
      <div className="max-w-md w-full bg-[var(--surface)] border border-[var(--gold)]/40 rounded-2xl p-6 shadow-2xl space-y-4 relative text-[var(--text)]">
        {/* Step indicator */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[var(--gold)]/10 border border-[var(--gold)]/30 flex items-center justify-center text-[var(--gold)] font-bold">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--gold)]">
                Interactive Onboarding
              </span>
              <div className="text-xs text-[var(--muted)]">
                Step {currentStep + 1} of {TOUR_STEPS.length}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleComplete}
            className="text-[var(--muted)] hover:text-white p-1 rounded transition"
            title="Skip Tour"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Progress dots */}
        <div className="flex gap-1.5 pt-1">
          {TOUR_STEPS.map((_, idx) => (
            <div
              key={idx}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                idx === currentStep
                  ? 'w-8 bg-[var(--gold)]'
                  : idx < currentStep
                  ? 'w-3 bg-[var(--gold)]/50'
                  : 'w-3 bg-[var(--surface-2)]'
              }`}
            />
          ))}
        </div>

        {/* Content */}
        <div className="space-y-2 py-2">
          <h3 className="text-base font-semibold text-[var(--text)]">
            {step.title}
          </h3>
          <p className="text-xs text-[var(--muted)] leading-relaxed whitespace-pre-line">
            {step.desc}
          </p>
        </div>

        {/* Footer Navigation */}
        <div className="flex items-center justify-between pt-3 border-t border-[var(--border)]">
          <button
            type="button"
            onClick={handleComplete}
            className="text-xs text-[var(--muted)] hover:text-white transition"
          >
            Skip tour
          </button>

          <div className="flex items-center gap-2">
            {currentStep > 0 && (
              <button
                type="button"
                onClick={handlePrev}
                className="btn-secondary text-xs px-3 py-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleNext}
              className="btn-primary text-xs px-4 py-1.5"
            >
              <span>{currentStep === TOUR_STEPS.length - 1 ? 'Get Started' : 'Next'}</span>
              {currentStep === TOUR_STEPS.length - 1 ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <ArrowRight className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

