import { Building2 } from "lucide-react";
import { BRAND } from "@/lib/brand";

const SIZES = {
  sm: { box: "h-7 w-7 rounded-md", icon: "h-4 w-4" },
  md: { box: "h-9 w-9 rounded-md", icon: "h-5 w-5" },
  lg: { box: "h-14 w-14 rounded-2xl", icon: "h-7 w-7" },
};

// A márka logója (BRAND.logoSrc), ennek hiányában az általános épület-ikon.
export function BrandMark({ size = "sm" }: { size?: keyof typeof SIZES }) {
  const s = SIZES[size];
  if (BRAND.logoSrc) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={BRAND.logoSrc} alt={BRAND.name} className={`${s.box} shrink-0 object-contain`} />;
  }
  return (
    <div className={`flex ${s.box} shrink-0 items-center justify-center bg-accent text-white`}>
      <Building2 className={s.icon} strokeWidth={2.25} />
    </div>
  );
}
