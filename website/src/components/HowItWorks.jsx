import { QrCode, Scan, Box, Pointer } from 'lucide-react'

const steps = [
  {
    number: '01',
    icon: QrCode,
    title: 'Place the Card',
    description:
      'We provide beautifully printed menu cards or coasters — uniquely designed for your brand. Place them on every table.',
    detail: 'No QR codes, no app stores.',
  },
  {
    number: '02',
    icon: Scan,
    title: 'Open Camera',
    description:
      "Your guest simply opens their phone camera — Safari on iPhone, Chrome on Android. That's it. Zero friction.",
    detail: 'Works on 95% of modern smartphones.',
  },
  {
    number: '03',
    icon: Box,
    title: 'AR Activates',
    description:
      "Point the camera at the card. MindAR's image-tracking engine locks onto it in under a second, anchoring the 3D dish.",
    detail: 'Powered by MindAR + WebXR.',
  },
  {
    number: '04',
    icon: Pointer,
    title: 'Explore & Order',
    description:
      'Pinch to scale, drag to rotate, swipe to browse. See every dish in life-sized 3D with full nutritional info before ordering.',
    detail: 'Tap to add directly to your order.',
  },
]

export default function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="relative py-28 overflow-hidden scroll-mt-20"
      style={{ background: '#0A0A0F' }}
    >
      {/* Background decoration */}
      <div
        className="absolute left-0 top-1/2 -translate-y-1/2 w-96 h-96 rounded-full blur-3xl pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(212, 168, 83, 0.06) 0%, transparent 70%)' }}
      />

      <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-12 xl:px-16">
        {/* Section header */}
        <div className="text-center mb-16 reveal-up">
          <div className="inline-flex items-center gap-2 glass-light rounded-full px-4 py-2 mb-5 reveal-scale delay-100">
            <span className="text-xs font-medium tracking-widest uppercase" style={{ color: '#D4A853', fontFamily: 'Inter' }}>
              How It Works
            </span>
          </div>
          <h2 className="font-serif text-4xl md:text-5xl font-bold mb-4 reveal-up delay-200" style={{ color: '#F0EDE8' }}>
            Four Steps to{' '}
            <span className="text-gold-gradient">Magic</span>
          </h2>
          <p className="text-lg max-w-xl mx-auto leading-relaxed reveal-up delay-300" style={{ color: 'rgba(240, 237, 232, 0.6)', fontFamily: 'Inter' }}>
            No app. No download. No friction. Just scan and experience your menu in a dimension you&apos;ve never seen.
          </p>
        </div>

        {/* Steps grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-10">
          {steps.map((step, idx) => {
            const Icon = step.icon
            return (
              <div
                key={step.number}
                className={`glass rounded-3xl p-8 md:p-10 card-hover relative group reveal-up delay-${(idx + 1) * 100}`}
              >
                {/* Step number watermark */}
                <div
                  className="absolute top-4 right-5 font-serif text-5xl font-bold opacity-10 group-hover:opacity-20 transition-opacity leading-none"
                  style={{ color: '#D4A853' }}
                >
                  {step.number}
                </div>

                {/* Icon */}
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-5"
                  style={{ background: 'rgba(212, 168, 83, 0.1)', border: '1px solid rgba(212, 168, 83, 0.3)' }}
                >
                  <Icon size={22} style={{ color: '#D4A853' }} />
                </div>

                {/* Content */}
                <h3
                  className="font-serif text-lg font-semibold mb-3"
                  style={{ color: '#F0EDE8' }}
                >
                  {step.title}
                </h3>
                <p
                  className="text-sm leading-relaxed mb-5"
                  style={{ color: 'rgba(240, 237, 232, 0.6)', fontFamily: 'Inter' }}
                >
                  {step.description}
                </p>

                {/* Detail badge */}
                <div
                  className="inline-flex items-center gap-1 text-xs rounded-lg px-3 py-1.5"
                  style={{
                    background: 'rgba(212, 168, 83, 0.08)',
                    color: '#D4A853',
                    fontFamily: 'Inter',
                    border: '1px solid rgba(212, 168, 83, 0.2)',
                  }}
                >
                  {step.detail}
                </div>

                {/* Connector line (not last) */}
                {idx < steps.length - 1 && (
                  <div
                    className="hidden lg:block absolute top-10 -right-3 w-6 h-px"
                    style={{ background: 'linear-gradient(90deg, rgba(212,168,83,0.4), transparent)' }}
                  />
                )}
              </div>
            )
          })}
        </div>

        {/* Central image */}
        <div
          className="mt-16 relative rounded-3xl overflow-hidden gold-glow reveal-up delay-500"
          style={{ height: '420px', border: '1px solid rgba(212,168,83,0.2)' }}
        >
          <img
            src="/restaurant_ar_scene.png"
            alt="AR menu experience in luxury restaurant"
            className="w-full h-full object-cover"
          />
          <div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(to right, rgba(10,10,15,0.85) 0%, rgba(10,10,15,0.3) 50%, rgba(10,10,15,0.7) 100%)',
            }}
          />
          {/* Overlay text */}
          <div className="absolute inset-0 flex items-center px-10 md:px-14">
            <div className="max-w-lg reveal-left delay-700">
              <div className="ar-badge mb-4 inline-block">AR TRACKING LIVE</div>
              <h3 className="font-serif text-2xl md:text-3xl font-bold mb-3" style={{ color: '#F0EDE8' }}>
                Watch It Come to Life
              </h3>
              <p className="text-sm md:text-base leading-relaxed" style={{ color: 'rgba(240, 237, 232, 0.7)', fontFamily: 'Inter' }}>
                The moment a customer points their camera at the table card, a stunning 3D dish appears
                — anchored in real space, floating above the table.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
