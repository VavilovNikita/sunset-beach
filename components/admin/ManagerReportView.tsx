import { MANAGER_REPORT_LEFT_OUT, MANAGER_REPORT_SECTIONS } from "@/lib/managerReport";
import type { ManagerReport } from "@/lib/types";

// The five manager-report sections, each a table of tonight vs. the same night last year, with
// the endpoint's own documented limitations as captions underneath. Kept apart from the page so
// ManagerReportView.test.tsx can render it without a session or a backend.
export default function ManagerReportView({ report }: { report: ManagerReport }) {
  return (
    <>
      {MANAGER_REPORT_SECTIONS.map((section) => (
        <section key={section.key} className="mb-8" data-section={section.key}>
          <h2 className="font-display italic text-xl mb-3">{section.title}</h2>
          <div className="border border-cream/10 rounded-xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left">
                <tr className="border-b border-cream/10">
                  <th className={th}>{section.key === "tomorrow" ? "Night of" : ""}</th>
                  <th className={`${th} text-right`}>
                    {section.key === "tomorrow" ? report.today.tomorrow.date : report.date}
                  </th>
                  <th className={`${th} text-right`}>
                    {section.key === "tomorrow" ? report.lastYear.tomorrow.date : report.lastYearDate}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cream/10">
                {section.rows.map((row) => (
                  <tr key={row.label}>
                    <td className={td}>{row.label}</td>
                    <td className={`${td} text-right whitespace-nowrap`}>{row.value(report.today)}</td>
                    <td className={`${td} text-right whitespace-nowrap text-cream/60`}>{row.value(report.lastYear)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {section.captions.map((caption) => (
            <p key={caption} className="text-xs text-cream/40 mt-2">
              {caption}
            </p>
          ))}
        </section>
      ))}

      <section className="mb-8" data-section="left-out">
        <h2 className="font-display italic text-xl mb-1">Not in this report</h2>
        <p className="text-xs text-cream/40 mb-2">Left out of the legacy Z370 layout, deliberately:</p>
        <ul className="text-xs text-cream/40 space-y-1 list-disc pl-5">
          {MANAGER_REPORT_LEFT_OUT.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>
    </>
  );
}

const th = "px-4 py-2 font-normal eyebrow text-cream/50";
const td = "px-4 py-2";
