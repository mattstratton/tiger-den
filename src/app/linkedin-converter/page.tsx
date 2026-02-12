import { LinkedInConverterForm } from "./_components/linkedin-converter-form";

export default async function LinkedInConverterPage() {
  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="font-bold text-2xl">LinkedIn Converter</h1>
        <p className="text-muted-foreground text-sm">
          Convert content into a LinkedIn article prompt. Paste text or upload a
          PDF, select an author, and copy the assembled prompt to any Claude
          interface.
        </p>
      </div>

      <LinkedInConverterForm />
    </div>
  );
}
