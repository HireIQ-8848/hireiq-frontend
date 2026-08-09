import { CreditCard, BookUser, Car, Landmark } from "lucide-react";

const DOCUMENTS = [
  { id: "citizenship", name: "Citizenship", sub: "Nepali citizenship certificate", icon: Landmark },
  { id: "national_id", name: "National Identity (NID)", sub: "National identity card", icon: CreditCard },
  { id: "passport", name: "Passport", sub: "Passport identity page", icon: BookUser },
  { id: "driving_licence", name: "Driving Licence", sub: "Government-issued driving licence", icon: Car },
];

export default function SelectDocument({ data, onChange, onNext }) {
  const selected = data.documentType || "national_id";

  return (
    <>
      <h1 className="step-title">Choose your document</h1>
      <p className="step-sub">Select the type of document you want to upload</p>

      <div className="card">
        {DOCUMENTS.map((doc) => {
          const Icon = doc.icon;
          const isSelected = selected === doc.id;
          return (
            <div
              key={doc.id}
              className={`doc-option ${isSelected ? "selected" : ""}`}
              onClick={() => onChange({ documentType: doc.id })}
            >
              <div className="radio" />
              <div className="icon">
                <Icon size={18} />
              </div>
              <div>
                <div className="doc-name">{doc.name}</div>
                <div className="doc-sub">{doc.sub}</div>
              </div>
            </div>
          );
        })}

        <button
          className="btn btn-primary"
          onClick={() => {
            if (!data.documentType) onChange({ documentType: selected });
            onNext();
          }}
        >
          Continue
        </button>
      </div>
    </>
  );
}
