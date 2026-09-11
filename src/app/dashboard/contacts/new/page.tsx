import { createContact } from "../actions";
import { ContactForm } from "../contact-form";

export default function NewContactPage() {
  return (
    <div>
      <h1 className="text-xl font-semibold">Új kontakt</h1>
      <div className="mt-6">
        <ContactForm action={createContact} submitLabel="Létrehozás" />
      </div>
    </div>
  );
}
