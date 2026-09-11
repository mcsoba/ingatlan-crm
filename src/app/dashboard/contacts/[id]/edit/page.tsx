import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateContact } from "../../actions";
import { ContactForm } from "../../contact-form";

export default async function EditContactPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: contact } = await supabase
    .from("contacts")
    .select("id, name, email, phone, source, status, notes")
    .eq("id", id)
    .maybeSingle();

  if (!contact) notFound();

  const updateWithId = updateContact.bind(null, contact.id);

  return (
    <div>
      <h1 className="text-xl font-semibold">Kontakt szerkesztése</h1>
      <div className="mt-6">
        <ContactForm
          action={updateWithId}
          defaultValues={contact}
          submitLabel="Mentés"
        />
      </div>
    </div>
  );
}
