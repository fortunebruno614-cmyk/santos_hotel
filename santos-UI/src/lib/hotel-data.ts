import lobby from "@/assets/santo-lobby.jpg";
import room from "@/assets/santo-room.jpg";
import twin from "@/assets/santo-twin.jpg";
import suite from "@/assets/santo-suite.jpg";
export { lobby, room };
export const rooms = [
  {
    id: "deluxe-king",
    name: "Deluxe King Room",
    category: "Rooms",
    description: "A quiet retreat with natural textures, considered details, and room to unwind.",
    price: 185,
    size: 32,
    guests: 2,
    bed: "1 king bed",
    image: room,
    tag: "A guest favourite",
    breakfast: false,
  },
  {
    id: "premium-twin",
    name: "Premium Twin Room",
    category: "Rooms",
    description: "Light-filled comfort with thoughtful touches, made for sharing the journey.",
    price: 205,
    size: 36,
    guests: 2,
    bed: "2 twin beds",
    image: twin,
    tag: "Space to reconnect",
    breakfast: true,
  },
  {
    id: "junior-suite",
    name: "Junior Suite",
    category: "Suites",
    description: "A little more space. A slower pace. Your own beautifully appointed sanctuary.",
    price: 285,
    size: 52,
    guests: 3,
    bed: "1 king bed",
    image: suite,
    tag: "Elevated comfort",
    breakfast: true,
  },
];
export type Room = (typeof rooms)[number];
export const offers = [
  {
    id: "slow-weekend",
    name: "The Slow Weekend",
    eyebrow: "MAKE TIME FOR YOURSELF",
    description: "Trade your everyday rhythm for unhurried mornings and a well-deserved escape.",
  },
  {
    id: "stay-a-little-longer",
    name: "Stay a Little Longer",
    eyebrow: "MORE TIME, MORE MEMORIES",
    description: "Settle in, explore at your own pace, and make yourself at home.",
  },
  {
    id: "together-at-santo",
    name: "Together at Santo",
    eyebrow: "MOMENTS WORTH SHARING",
    description: "A thoughtful setting for a special occasion or simply time together.",
  },
];
export const money = (value: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(
    value * (currency === "EUR" ? 0.92 : currency === "GBP" ? 0.79 : 1),
  );
export function nightsBetween(start: string, end: string) {
  return Math.max(
    1,
    Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000) || 1,
  );
}
export function stayTotal(rate: number, nights: number, quantity: number) {
  const subtotal = rate * nights * quantity;
  return {
    subtotal,
    fees: Math.round(subtotal * 0.1),
    total: subtotal + Math.round(subtotal * 0.1),
  };
}
export const meta = (title: string, description: string) => ({
  meta: [
    { title: `${title} | Santo Hotel` },
    { name: "description", content: description },
    { property: "og:title", content: `${title} | Santo Hotel` },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ],
});
