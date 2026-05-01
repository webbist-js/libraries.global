import { Container } from "@/components/elementary/Container"
import { homepagePanelClassName } from "@/components/home/homepage.constants"
import { getServiceIcon } from "@/components/home/homepage.helpers"
import type { HomepageData } from "@/components/home/homepage.types"
import SectionHeader from "@/components/home/sections/SectionHeader"
import { cn } from "@/lib/styles"

export function ServicesSection({
  homepage,
}: {
  readonly homepage: HomepageData
}) {
  const services = Array.isArray(homepage?.featuredServices)
    ? homepage.featuredServices
    : []

  if (services.length === 0) {
    return null
  }

  return (
    <section className="py-8 sm:py-10" id="services">
      <Container>
        <SectionHeader title="Services for You" />

        <div className="grid gap-5 lg:grid-cols-3">
          {services.map((service, index) => {
            const Icon = getServiceIcon(service.category)

            return (
              <div
                key={service.documentId ?? service.name ?? index}
                className={cn(homepagePanelClassName, "p-6")}
              >
                <div className="mb-8 flex size-12 items-center justify-center rounded-2xl border border-cyan-300/35 bg-cyan-300/10 text-cyan-200">
                  <Icon className="size-5" />
                </div>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <h3 className="text-xl font-semibold tracking-[-0.03em] text-(--t-ink-base)">
                      {service.name}
                    </h3>
                    {service.category ? (
                      <p className="text-sm text-cyan-200/70">
                        {service.category}
                      </p>
                    ) : null}
                  </div>

                  {service.summary ? (
                    <p className="text-sm leading-6 text-(--t-ink-low)">
                      {service.summary}
                    </p>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      </Container>
    </section>
  )
}

ServicesSection.displayName = "ServicesSection"

export default ServicesSection
