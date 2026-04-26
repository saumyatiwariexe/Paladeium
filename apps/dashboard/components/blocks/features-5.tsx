import { Activity, DraftingCompass, Mail, Zap } from 'lucide-react'

export function Features() {
  return (
    <section className="py-16 md:py-32">
      <div className="mx-auto max-w-xl md:max-w-6xl px-6">
        <div className="grid items-center gap-12 md:grid-cols-2 md:gap-12 lg:grid-cols-5 lg:gap-24">
          <div className="lg:col-span-2">
            <div className="md:pr-6 lg:pr-0">
              <h2 className="text-4xl font-semibold lg:text-5xl">Built for Scaling teams</h2>
              <p className="mt-6 text-white/50">
                Orrupti aut temporibus assumenda atque ab, accusamus sit, molestiae veniam
                laboriosam pariatur.
              </p>
            </div>
            <ul className="mt-8 divide-y border-y divide-white/[0.06] border-white/[0.06] *:flex *:items-center *:gap-3 *:py-3 *:text-sm *:text-white/60">
              <li>
                <Mail className="size-5 text-[#D4A853] shrink-0" />
                Email and web support
              </li>
              <li>
                <Zap className="size-5 text-[#D4A853] shrink-0" />
                Fast response time
              </li>
              <li>
                <Activity className="size-5 text-[#D4A853] shrink-0" />
                Monitoring and analytics
              </li>
              <li>
                <DraftingCompass className="size-5 text-[#D4A853] shrink-0" />
                Architectural review
              </li>
            </ul>
          </div>
          <div className="border-white/10 relative rounded-3xl border p-3 lg:col-span-3">
            <div className="bg-gradient-to-b aspect-video relative rounded-2xl from-white/10 to-transparent p-px">
              <img
                src="https://tailark.com/_next/image?url=%2Fpayments.png&w=3840&q=75"
                className="hidden rounded-[15px] dark:block"
                alt="payments illustration dark"
                width={1207}
                height={929}
              />
              <img
                src="https://tailark.com/_next/image?url=%2Fpayments-light.png&w=3840&q=75"
                className="rounded-[15px] shadow dark:hidden"
                alt="payments illustration light"
                width={1207}
                height={929}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
