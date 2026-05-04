import { TrendingUp, Users, DollarSign, Clock, Smile, Award } from 'lucide-react'

const benefits = [
  {
    icon: TrendingUp,
    metric: '+34%',
    title: 'Higher Average Spend',
    description:
      'Guests who engage with AR dish previews spend on average 34% more per table — because they upgrade confidently.',
  },
  {
    icon: Users,
    metric: '2× Longer',
    title: 'Table Engagement',
    description:
      'AR menus keep guests occupied and entertained while they wait for food, reducing perceived wait time dramatically.',
  },
  {
    icon: DollarSign,
    metric: '0 App',
    title: 'Zero Friction',
    description:
      'No QR code, no download, no account. The camera is the interface. Adoption rate is 3× higher than app-based solutions.',
  },
  {
    icon: Clock,
    metric: '-18%',
    title: 'Faster Order Times',
    description:
      'Indecision drops sharply when guests can see what a dish actually looks like in 3D. Staff spend less time explaining.',
  },
  {
    icon: Smile,
    metric: '4.9★',
    title: 'Guest Delight Score',
    description:
      'Paladeium venues report 4.9/5.0 on guest experience surveys — the "wow" moment becomes a social media moment.',
  },
  {
    icon: Award,
    metric: 'Live',
    title: 'Instant Menu Changes',
    description:
      "Update prices, 86 a dish, or add tonight's special in real-time. No reprints, no outdated paper menus, ever again.",
  },
]

const testimonials = [
  {
    quote:
      '"Our guests are literally gasping when they first see the pasta levitate above the table. Paladeium is the best investment we\'ve made in years."',
    author: 'Marco Bellini',
    role: 'Executive Chef, Osteria Moderna',
    avatar: '👨‍🍳',
  },
  {
    quote:
      '"Revenue per cover is up 31% month-over-month since we launched. Guests order premium sides they never would have tried from a paper menu."',
    author: 'Priya Sharma',
    role: 'GM, Spice & Ember, London',
    avatar: '👩‍💼',
  },
  {
    quote:
      '"Our Yelp reviews have a new pattern: guests always mention the floating dishes. It\'s become our signature experience."',
    author: 'James Whitfield',
    role: 'Owner, Ember House NYC',
    avatar: '🧑‍🍽️',
  },
]

export default function Benefits() {
  return (
    <section
      id="benefits"
      className="py-32 md:py-40 relative overflow-hidden scroll-mt-20"
      style={{ background: '#0A0A0F' }}
    >
      {/* Background mesh */}
      <div
        className="absolute right-0 top-1/4 w-96 h-96 rounded-full blur-3xl pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(212, 168, 83, 0.08) 0%, transparent 70%)' }}
      />

      <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-12 xl:px-16">
        {/* Header */}
        <div className="text-center mb-14 reveal-up">
          <div className="inline-flex items-center gap-2 glass-light rounded-full px-4 py-2 mb-6 reveal-scale delay-100">
            <span className="text-xs font-medium tracking-widest uppercase" style={{ color: '#D4A853', fontFamily: 'Inter' }}>
              Business Benefits
            </span>
          </div>
          <h2 className="font-serif text-4xl md:text-5xl font-bold mb-4 reveal-up delay-200" style={{ color: '#F0EDE8' }}>
            The ROI of{' '}
            <span className="text-gold-gradient">Augmented Reality</span>
          </h2>
          <p className="text-lg max-w-xl mx-auto reveal-up delay-300" style={{ color: 'rgba(240, 237, 232, 0.6)', fontFamily: 'Inter' }}>
            Paladeium isn't just a novelty — it's a revenue engine backed by data from 300+ restaurants.
          </p>
        </div>

        {/* Benefit cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 lg:gap-10 mb-20">
          {benefits.map((benefit, idx) => {
            const Icon = benefit.icon
            return (
              <div
                key={benefit.title}
                className={`glass rounded-3xl p-8 md:p-10 card-hover group relative overflow-hidden reveal-up delay-${(idx + 1) * 100}`}
              >
                <div className="flex items-start gap-4">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(212, 168, 83, 0.1)', border: '1px solid rgba(212, 168, 83, 0.25)' }}
                  >
                    <Icon size={22} style={{ color: '#D4A853' }} />
                  </div>
                  <div>
                    <div
                      className="font-serif text-3xl font-bold mb-1"
                      style={{ color: '#D4A853' }}
                    >
                      {benefit.metric}
                    </div>
                    <h3
                      className="font-serif text-base font-semibold mb-2"
                      style={{ color: '#F0EDE8' }}
                    >
                      {benefit.title}
                    </h3>
                  </div>
                </div>
                <p
                  className="text-sm leading-relaxed mt-4"
                  style={{ color: 'rgba(240, 237, 232, 0.6)', fontFamily: 'Inter' }}
                >
                  {benefit.description}
                </p>

                {/* Animated gold line on hover */}
                <div
                  className="absolute bottom-0 left-0 h-0.5 w-0 group-hover:w-full transition-all duration-500"
                  style={{ background: 'linear-gradient(90deg, #D4A853, #F0C97A)' }}
                />
              </div>
            )
          })}
        </div>

        {/* Divider */}
        <div className="divider-gold mb-24 reveal-scale delay-500" />

        {/* Testimonials */}
        <div className="text-center mb-12 reveal-up">
          <h3 className="font-serif text-3xl font-bold mb-2" style={{ color: '#F0EDE8' }}>
            Restaurateurs Love It
          </h3>
          <p className="text-base" style={{ color: 'rgba(240, 237, 232, 0.5)', fontFamily: 'Inter' }}>
            Join the growing community of premium venues already using Paladeium.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 lg:gap-10">
          {testimonials.map((t, idx) => (
            <div
              key={t.author}
              className={`glass rounded-3xl p-8 md:p-10 card-hover relative reveal-up delay-${(idx + 1) * 150}`}
            >
              {/* Quote mark */}
              <div
                className="absolute top-4 right-5 font-serif text-6xl font-bold opacity-10"
                style={{ color: '#D4A853' }}
              >
                "
              </div>

              <p
                className="text-sm leading-relaxed mb-6 italic relative z-10"
                style={{ color: 'rgba(240, 237, 232, 0.75)', fontFamily: 'Inter' }}
              >
                {t.quote}
              </p>
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-lg flex-shrink-0"
                  style={{ background: 'rgba(212, 168, 83, 0.15)', border: '1px solid rgba(212, 168, 83, 0.25)' }}
                >
                  {t.avatar}
                </div>
                <div>
                  <p className="font-semibold text-sm" style={{ color: '#F0EDE8', fontFamily: 'Inter' }}>{t.author}</p>
                  <p className="text-xs" style={{ color: 'rgba(240, 237, 232, 0.5)', fontFamily: 'Inter' }}>{t.role}</p>
                </div>
              </div>

              {/* Stars */}
              <div className="flex gap-0.5 mt-4">
                {[...Array(5)].map((_, i) => (
                  <span key={i} style={{ color: '#D4A853', fontSize: '14px' }}>★</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
