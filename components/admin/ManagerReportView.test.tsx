import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import ManagerReportView from "@/components/admin/ManagerReportView";
import { MANAGER_REPORT_LEFT_OUT, MANAGER_REPORT_SECTIONS } from "@/lib/managerReport";
import type { ManagerReport, ManagerReportDay } from "@/lib/types";

function day(overrides: { occupancyPercent?: string | null; roomRevenue?: string } = {}): ManagerReportDay {
  return {
    rooms: {
      totalRooms: 12,
      outOfOrder: 1,
      availableForSale: 11,
      occupied: 4,
      complimentary: 1,
      houseUse: 1,
      occupiedExcludingCompAndHouseUse: 2,
      occupancyPercent: overrides.occupancyPercent === undefined ? "36.36" : overrides.occupancyPercent,
      averageRatePerOccupiedRoom: "625.00",
      averageRevenuePerAvailableRoom: "227.27",
    },
    guests: {
      adultsInHouse: 3,
      childrenInHouse: 1,
      guestsInHouse: 4,
      averageGuestsPerRoom: "2.00",
      averageRatePerGuest: "250.00",
      averageLengthOfStay: "2.50",
      complimentaryGuests: 1,
      houseUseGuests: 0,
    },
    accounts: { arrivals: 3, departures: 1, cancellations: 1, noShows: 1, walkInRooms: 1 },
    revenue: { roomRevenue: overrides.roomRevenue ?? "2500.00", averageRevenuePerInHouseGuest: "625.00" },
    tomorrow: { date: "2033-11-11", arrivals: 1, departures: 1, occupied: 4, availableForSale: 11, occupancyPercent: "36.36" },
  };
}

const report: ManagerReport = {
  date: "2033-11-10",
  lastYearDate: "2032-11-10",
  today: day(),
  lastYear: { ...day({ occupancyPercent: null, roomRevenue: "800.00" }), tomorrow: { ...day().tomorrow, date: "2032-11-11" } },
};

describe("ManagerReportView", () => {
  const html = renderToStaticMarkup(<ManagerReportView report={report} />);

  it("renders all five sections", () => {
    for (const key of ["rooms", "guests", "accounts", "revenue", "tomorrow"]) {
      expect(html).toContain(`data-section="${key}"`);
    }
    for (const title of ["Room statistic", "Guest statistic", "Account count", "Revenue", "Tomorrow&#x27;s forecast"]) {
      expect(html).toContain(title);
    }
  });

  it("shows tonight and last year side by side, with the server's figures", () => {
    expect(html).toContain("2033-11-10");
    expect(html).toContain("2032-11-10");
    expect(html).toContain("2033-11-11");
    expect(html).toContain("2032-11-11");
    expect(html).toContain("36.36%");
    expect(html).toContain("฿2,500");
    expect(html).toContain("฿800");
  });

  it("shows a null ratio as a dash, not 0", () => {
    expect(html).toContain("—");
  });

  it("shows every documented limitation as a caption", () => {
    const escape = (s: string) => renderToStaticMarkup(<>{s}</>);
    for (const section of MANAGER_REPORT_SECTIONS) {
      for (const caption of section.captions) {
        expect(html).toContain(escape(caption));
      }
    }
    for (const line of MANAGER_REPORT_LEFT_OUT) {
      expect(html).toContain(escape(line));
    }
  });

  it("flags the occupancy denominator and the updatedAt-based counts specifically", () => {
    expect(html).toContain("out-of-order rooms are taken out of the denominator here");
    expect(html).toContain("Treat both as exact only for today.");
    expect(html).toContain("Group vs. F.I.T. occupied rooms");
    expect(html).toContain("Day-Use rooms");
  });
});
