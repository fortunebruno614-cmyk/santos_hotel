const areas = [
  {
    title: "Browse & book",
    description:
      "Search dates, compare rooms and reserve your stay online.",
  },
  {
    title: "Your account",
    description: "View upcoming trips and manage eligible bookings.",
  },
  {
    title: "Hotel operations",
    description:
      "Staff and administrators manage rooms, reservations and payments.",
  },
];

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
      <span className="rounded-full border border-black/10 px-3 py-1 text-xs font-medium tracking-[0.2em] text-zinc-500 uppercase dark:border-white/15 dark:text-zinc-400">
        Santo Hotel
      </span>
      <h1 className="mt-6 max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
        Your stay starts here
      </h1>
      <p className="mt-4 max-w-xl text-lg text-zinc-600 dark:text-zinc-400">
        Online booking is under construction. Room search, availability and
        reservations will appear here as the build progresses.
      </p>

      <ul className="mt-12 grid w-full max-w-3xl gap-4 sm:grid-cols-3">
        {areas.map((area) => (
          <li
            key={area.title}
            className="rounded-xl border border-black/10 p-5 text-left dark:border-white/15"
          >
            <h2 className="text-sm font-semibold">{area.title}</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              {area.description}
            </p>
          </li>
        ))}
      </ul>
    </main>
  );
}
