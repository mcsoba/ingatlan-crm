/**
 * A Supabase (PostgREST) kérésenként legfeljebb 1000 sort ad vissza — a `.limit(5000)` is
 * csendben 1000-nél áll meg. Ez a segéd 1000-es lapokban kéri le az összeset (max. `max` sorig).
 * A `build` minden lapnál új lekérdezést ad (a rendezést és szűrést is tartalmazza); a stabil
 * lapozáshoz az `id` szerinti másodlagos rendezést itt tesszük hozzá.
 */
const PAGE = 1000;

type RangeQuery<T> = {
  order: (column: string, options?: { ascending?: boolean }) => RangeQuery<T>;
  range: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>;
};

export async function fetchAll<T>(build: () => RangeQuery<T>, max = 20000): Promise<{ data: T[]; error: unknown }> {
  const out: T[] = [];
  for (let from = 0; from < max; from += PAGE) {
    const { data, error } = await build().order("id").range(from, Math.min(from + PAGE, max) - 1);
    if (error) return { data: out, error };
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return { data: out, error: null };
}
