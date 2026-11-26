/**
 * Adónaptár — esedékességek számítása a kötelezettségek ütemezéséből.
 * Ütemezés: „monthly:12” (havonta 12-éig) vagy „fixed:03-15,09-15” (évente ezeken a napokon).
 * Hétvégére eső határidő → a következő hétfő (az ünnepnapokat nem ismeri a rendszer).
 */

export type TaxObligation = {
  id: string;
  company_id: string;
  name: string;
  schedule: string;
  municipality: string | null;
  amount: number | null;
  notes: string | null;
  active: boolean;
  sort_order: number;
  /** ennél korábbi esedékességet nem mutatunk (a felvétel előtti határidők nem „lejártak”) */
  created_at: string;
};

export type TaxTask = { id: string; obligation_id: string; due_date: string; done_at: string | null; amount: number | null; note: string | null };

export type TaxOccurrence = {
  obligation: TaxObligation;
  /** a törvényi (névleges) határidő — ehhez kötjük a teljesítést */
  nominal: string;
  /** hétvégénél a következő munkanap */
  due: string;
  /** milyen időszakra vonatkozik (havi kötelezettségnél az előző hónap) */
  periodLabel: string | null;
  task: TaxTask | null;
};

const MONTHS = ["január", "február", "március", "április", "május", "június", "július", "augusztus", "szeptember", "október", "november", "december"];

const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

export function nextWorkday(day: string): string {
  const t = new Date(day + "T00:00:00Z");
  const wd = t.getUTCDay();
  if (wd === 6) t.setUTCDate(t.getUTCDate() + 2);
  if (wd === 0) t.setUTCDate(t.getUTCDate() + 1);
  return t.toISOString().slice(0, 10);
}

export function scheduleLabel(schedule: string): string {
  const [kind, rest] = schedule.split(":");
  if (kind === "monthly") return `havonta, a következő hónap ${rest}-éig`;
  return (
    "évente: " +
    rest
      .split(",")
      .map((md) => {
        const [m, d] = md.split("-").map(Number);
        return `${MONTHS[m - 1]} ${d}.`;
      })
      .join(", ")
  );
}

/** Az ütemezés érvényes-e (ugyanaz a szabály, mint az adatbázisban). */
export function isValidSchedule(s: string): boolean {
  return /^(monthly:([1-9]|1[0-9]|2[0-8])|fixed:(0[1-9]|1[0-2])-([0-2][0-9]|3[01])(,(0[1-9]|1[0-2])-([0-2][0-9]|3[01]))*)$/.test(s);
}

/** Esedékességek a [from, to] intervallumban (névleges határidő szerint). */
export function occurrences(obligations: TaxObligation[], tasks: TaxTask[], from: string, to: string): TaxOccurrence[] {
  const taskOf = new Map(tasks.map((t) => [`${t.obligation_id}|${t.due_date}`, t]));
  const out: TaxOccurrence[] = [];
  const [fy] = from.split("-").map(Number);
  const [ty] = to.split("-").map(Number);
  for (const o of obligations) {
    if (!o.active || !isValidSchedule(o.schedule)) continue;
    const [kind, rest] = o.schedule.split(":");
    const dates: { nominal: string; period: string | null }[] = [];
    for (let y = fy - 1; y <= ty + 1; y++) {
      if (kind === "monthly") {
        for (let m = 1; m <= 12; m++) {
          const prevM = m === 1 ? 12 : m - 1;
          dates.push({ nominal: iso(y, m, Number(rest)), period: `${m === 1 ? y - 1 : y}. ${MONTHS[prevM - 1]}` });
        }
      } else {
        for (const md of rest.split(",")) {
          const [m, d] = md.split("-").map(Number);
          const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
          dates.push({ nominal: iso(y, m, Math.min(d, last)), period: null });
        }
      }
    }
    for (const { nominal, period } of dates) {
      if (nominal < from || nominal > to || nominal < o.created_at.slice(0, 10)) continue;
      out.push({ obligation: o, nominal, due: nextWorkday(nominal), periodLabel: period, task: taskOf.get(`${o.id}|${nominal}`) ?? null });
    }
  }
  return out.sort((a, b) => a.due.localeCompare(b.due) || a.obligation.sort_order - b.obligation.sort_order);
}

/**
 * Alap adónaptár egy Kft.-nek — általános határidők, amelyeket a könyvelővel érdemes egyeztetni
 * (ÁFA-gyakoriság, TAO-előleg havi vagy negyedéves, iparűzési adó településenként).
 */
export const DEFAULT_TAX_OBLIGATIONS: { name: string; schedule: string; notes: string }[] = [
  { name: "Bérek utáni adók és járulékok (08-as bevallás; SZJA, TB, szocho befizetése)", schedule: "monthly:12", notes: "Az előző havi bérek és a magánszemély bérbeadóknak fizetett díjak utáni SZJA is ide tartozik." },
  { name: "ÁFA-bevallás és befizetés", schedule: "fixed:01-20,04-20,07-20,10-20", notes: "Negyedéves bevallónak beállítva. Havi bevallónál: „monthly:20”; éves bevallónál: február 25." },
  { name: "Társasági adóelőleg", schedule: "fixed:02-20,05-20,08-20,11-20", notes: "Negyedéves előleg (ha az előző évi TAO nem haladta meg az 5 millió Ft-ot). Ellenőrizd a könyvelővel." },
  { name: "Társasági adó bevallás + éves beszámoló letétbe helyezése", schedule: "fixed:05-31", notes: "Naptári éves cégnél az előző évről." },
  { name: "Helyi iparűzési adó éves bevallás", schedule: "fixed:05-31", notes: "Településenként — több telephelynél vedd fel külön (pl. Hajdúszoboszló, Bordány, Szeged)." },
  { name: "Helyi iparűzési adóelőleg", schedule: "fixed:03-15,09-15", notes: "Településenként, a határozat / előző évi bevallás szerinti összeggel." },
  { name: "Cégautóadó", schedule: "fixed:01-20,04-20,07-20,10-20", notes: "Negyedévente, a negyedévet követő hónapban. Ellenőrizd a könyvelővel." },
  { name: "Gépjárműadó", schedule: "fixed:03-15,09-15", notes: "Félévente." },
];
