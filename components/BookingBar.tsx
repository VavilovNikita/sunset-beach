export default function BookingBar() {
  return (
    <form
      method="get"
      action="https://v4.reservation-system.net/Booking/Portal.aspx"
      className="relative z-10 mx-auto max-w-4xl -mt-10 md:-mt-14 px-4"
    >
      <input type="hidden" name="qb" value="y" />
      <input type="hidden" name="adult" value="2" />
      <input type="hidden" name="child" value="0" />
      <input type="hidden" name="langcd" value="en" />
      <input type="hidden" name="hotelcd" value="HT12004914" />

      <div className="bg-sand text-ink rounded-2xl shadow-2xl shadow-black/40 px-6 py-5 grid gap-4 sm:grid-cols-4 items-end">
        <div className="sm:col-span-1">
          <label className="eyebrow text-coraldeep block mb-1">Check in</label>
          <input
            type="date"
            name="ci"
            className="w-full bg-transparent border-b border-ink/20 py-1 text-sm focus:outline-none focus:border-coral"
          />
        </div>
        <div className="sm:col-span-1">
          <label className="eyebrow text-coraldeep block mb-1">Check out</label>
          <input
            type="date"
            name="co"
            className="w-full bg-transparent border-b border-ink/20 py-1 text-sm focus:outline-none focus:border-coral"
          />
        </div>
        <div className="sm:col-span-1">
          <label className="eyebrow text-coraldeep block mb-1">Promotion code</label>
          <input
            type="text"
            name="promocd"
            placeholder="Optional"
            className="w-full bg-transparent border-b border-ink/20 py-1 text-sm placeholder:text-ink/40 focus:outline-none focus:border-coral"
          />
        </div>
        <button
          type="submit"
          className="sm:col-span-1 rounded-full bg-coral hover:bg-coraldeep transition-colors text-cream text-sm font-medium py-2.5"
        >
          Check Availability
        </button>
      </div>
      <p className="text-center eyebrow text-cream/50 mt-3">Best Price Guaranteed · Booking direct with the resort</p>
    </form>
  );
}
