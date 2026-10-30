// Munkanapok (hétfő–péntek) száma két "YYYY-MM-DD" dátum között, mindkét
// végpontot beleértve. Ünnepnapokat nem ismer — ilyenkor a napok száma
// kézzel felülírható a rögzítésnél.
export function countWorkdays(start: string, end: string): number {
  const d = new Date(`${start}T12:00:00Z`);
  const last = new Date(`${end}T12:00:00Z`);
  let count = 0;
  while (d <= last) {
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) count++;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return count;
}
