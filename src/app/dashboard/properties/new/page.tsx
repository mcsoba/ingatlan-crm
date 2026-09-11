import { createProperty } from "../actions";
import { PropertyForm } from "../property-form";

export default function NewPropertyPage() {
  return (
    <div>
      <h1 className="text-xl font-semibold">Új ingatlan</h1>
      <div className="mt-6">
        <PropertyForm action={createProperty} submitLabel="Létrehozás" />
      </div>
    </div>
  );
}
