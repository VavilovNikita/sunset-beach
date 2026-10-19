import SettingsTabLink from "@/components/admin/notificationSettings/SettingsTabLink";
import { settingsTabLabel, type OverviewFact, type OverviewSection } from "@/lib/notificationSettingsTabs";

// Read only: what the saved settings say is on, and the facts that decide whether a message can arrive. Every
// row links to the tab that holds its switch. (Unsaved edits are not shown here - the Overview is what is running.)
export default function NotificationOverview({ facts, sections }: { facts: OverviewFact[]; sections: OverviewSection[] }) {
  return (
    <div className="space-y-6">
      <section className="bg-ink2/40 border border-cream/10 rounded-xl p-5">
        <h3 className="text-sm text-cream font-medium mb-3">Right now</h3>
        <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
          {facts.map((f) => (
            <div key={f.label} className="min-w-0">
              <dt className="eyebrow text-cream/60">{f.label}</dt>
              <dd className={`text-sm mt-0.5 ${f.warn ? "text-amber-400" : "text-cream"}`}>
                {f.warn && <span aria-hidden="true">▲ </span>}
                {f.text}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="grid gap-4 lg:grid-cols-2 items-start">
        {sections.map((section) => (
          <section key={section.title} className="bg-ink2/40 border border-cream/10 rounded-xl p-5 min-w-0">
            <h3 className="text-sm text-cream font-medium mb-2">{section.title}</h3>
            <ul className="divide-y divide-cream/10">
              {section.rows.map((row) => (
                <li key={row.label} className="flex items-center gap-3 py-2 min-h-[44px]">
                  <span
                    className={`shrink-0 w-10 text-center rounded-full border px-2 py-0.5 text-xs ${
                      row.on ? "text-green-600 border-green-600/40" : "text-cream/50 border-cream/20"
                    }`}
                  >
                    {row.on ? "On" : "Off"}
                  </span>
                  <span className="min-w-0 flex-1 text-sm text-cream">
                    {row.label}
                    {row.detail && <span className="block text-xs text-cream/50">{row.detail}</span>}
                  </span>
                  <SettingsTabLink
                    tab={row.tab}
                    className="shrink-0 inline-flex items-center min-h-[44px] px-1 text-xs text-sea hover:text-cream transition-colors"
                  >
                    <span className="sr-only">{row.label}: open </span>
                    {settingsTabLabel(row.tab)}
                  </SettingsTabLink>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
