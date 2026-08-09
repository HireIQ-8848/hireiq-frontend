import { useEffect, useMemo, useState } from "react";
import { LockKeyhole, User } from "lucide-react";

const LABELS = {
  first_name: "First Name",
  last_name: "Last Name",
  full_name: "Full Name",
  name_english: "Name (English)",
  name_nepali: "Name (Nepali)",
  full_name_nepali: "Full Name (Nepali)",
  document_number: "Document Number",
  citizenship_number: "Citizenship Number",
  national_id_number: "National Identity Number (NIN)",
  passport_number: "Passport Number",
  licence_number: "Licence Number",
  date_of_birth: "Date of Birth (Gregorian)",
  date_of_birth_original: "Date of Birth (Document)",
  nationality: "Nationality",
  gender: "Gender / Sex",
  address: "Address",
  address_english: "Address (English)",
  address_nepali: "Address (Nepali)",
  place_of_birth: "Place of Birth",
  issue_date: "Issue Date",
  expiry_date: "Expiry Date",
  father_name: "Father's Name",
  mother_name: "Mother's Name",
  spouse_name: "Spouse's Name",
  citizenship_type: "Citizenship Type",
  issuing_office: "Issuing Office",
  province: "Province",
  blood_group: "Blood Group",
  licence_category: "Licence Category",
  licence_office: "Licence Office",
  phone_number: "Phone Number on Document",
  birth_district: "Birth District",
  birth_local_level_type: "Birth Local Level Type",
  birth_local_level_name: "Birth Local Level",
  birth_ward_number: "Birth Ward Number",
  permanent_district: "Permanent District",
  permanent_local_level_type: "Permanent Local Level Type",
  permanent_local_level_name: "Permanent Local Level",
  permanent_ward_number: "Permanent Ward Number",
  father_address: "Father's Address",
  mother_address: "Mother's Address",
  spouse_address: "Spouse's Address",
  document_status: "Document Status",
  document_status_reason: "Document Status Reason",
  phone: "Phone",
  company_name: "Company Name",
  registration_number: "Company Registration Number",
  company_address: "Company Address",
};

const OPTIONAL_APPLICANT_FIELDS = ["name_nepali"];

function initialValues(fields) {
  return Object.fromEntries(
    Object.entries(fields || {}).map(([name, field]) => [name, field.value || ""]),
  );
}

export default function ExtractedInfo({ registration, onSubmitInformation, busy }) {
  const serverFields = registration?.fields || {};
  const [values, setValues] = useState(() => initialValues(serverFields));

  useEffect(() => {
    setValues((current) => ({ ...current, ...initialValues(serverFields) }));
  }, [registration?.attempt_id, registration?.status]);

  const missing = registration?.missing_fields || [];
  const editableNames = useMemo(() => [
    ...new Set([
      ...missing,
      ...OPTIONAL_APPLICANT_FIELDS.filter((name) => !serverFields[name]?.value),
    ]),
  ], [serverFields, missing]);

  const englishName = serverFields.name_english?.value
    || serverFields.full_name?.value
    || `${values.first_name || ""} ${values.last_name || ""}`.trim();
  const nepaliName = serverFields.name_nepali?.value || values.name_nepali || "";
  const addressField = serverFields.address_english?.value
    ? serverFields.address_english
    : serverFields.address_nepali?.value
      ? serverFields.address_nepali
      : serverFields.address;
  const address = addressField?.value || values.address || "";
  const dateOfBirth = serverFields.date_of_birth?.value || values.date_of_birth || "";
  const documentNumber = serverFields.document_number?.value || values.document_number || "";
  const gender = serverFields.gender?.value || values.gender || "";

  const identityFields = [
    ["Document ID Type", registration?.verification?.document_type, true],
    ["ID Number", documentNumber, Boolean(serverFields.document_number?.locked)],
    ["Name (English)", englishName, Boolean(
      serverFields.name_english?.locked
      || (serverFields.first_name?.locked && serverFields.last_name?.locked)
    )],
    ["Name (Nepali)", nepaliName, Boolean(serverFields.name_nepali?.locked)],
    ["Address (English or Nepali)", address, Boolean(addressField?.locked)],
    ["Date of Birth (AD)", dateOfBirth, Boolean(serverFields.date_of_birth?.locked)],
    ["Gender", gender, Boolean(serverFields.gender?.locked)],
  ];

  const submit = async () => {
    const supplied = Object.fromEntries(
      editableNames
        .filter((name) => !serverFields[name]?.locked
          && !["full_name", "name_english"].includes(name)
          && values[name]?.trim())
        .map((name) => [name, values[name].trim()]),
    );
    try {
      await onSubmitInformation?.(supplied);
    } catch {
      // The parent presents the API error and leaves this form available.
    }
  };

  return (
    <>
      <h1 className="step-title">Review extracted document information</h1>
      <p className="step-sub">
        The complete extraction result is stored securely. Only the identity fields below are
        shown here; document-extracted values are locked. Supply every missing required field
        before liveness.
      </p>

      <div className="card">
        <div className="identity-field-summary">
          {identityFields.map(([label, value, locked]) => (
            <div className="item" key={label}>
              <div className="k" style={{ display: "flex", gap: 5, alignItems: "center" }}>
                {label}
                {locked && <LockKeyhole size={11} title="Extracted and locked" />}
              </div>
              <div className="v">{value || "Not available — enter below if required"}</div>
            </div>
          ))}
        </div>

        {editableNames.length > 0 && <div className="info-layout">
          <div className="info-photo" style={{ display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
            <User size={28} color="var(--muted-soft)" />
          </div>
          <div className="info-grid">
            {editableNames.map((name) => {
              const field = serverFields[name];
              const locked = Boolean(field?.locked);
              const derivedName = ["full_name", "name_english"].includes(name) && !locked;
              return (
                <div className="item" key={name}>
                  <div className="k" style={{ display: "flex", gap: 5, alignItems: "center" }}>
                    {LABELS[name] || name.replaceAll("_", " ")}
                    {locked && <LockKeyhole size={11} title="Extracted and locked" />}
                  </div>
                  {name === "gender" ? (
                    <select
                      value={values[name] || ""}
                      disabled={locked}
                      required={missing.includes(name)}
                      onChange={(event) => setValues((current) => ({
                        ...current,
                        [name]: event.target.value,
                      }))}
                    >
                      <option value="">Select gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  ) : (
                    <input
                      type={name === "date_of_birth" ? "date" : "text"}
                      value={values[name] || ""}
                      readOnly={locked || derivedName}
                      required={missing.includes(name)}
                      placeholder={missing.includes(name) ? "Required" : "Optional — not detected"}
                      onChange={(event) => setValues((current) => ({
                        ...current,
                        [name]: event.target.value,
                      }))}
                    />
                  )}
                  {typeof field?.confidence === "number" && (
                    <small>{(field.confidence * 100).toFixed(1)}% OCR confidence</small>
                  )}
                </div>
              );
            })}
          </div>
        </div>}

        <div className="summary-band" style={{ marginBottom: 18 }}>
          <div className="metric">
            <div className="num">
              {typeof registration?.verification?.ocr?.average_confidence === "number"
                ? `${(registration.verification.ocr.average_confidence * 100).toFixed(2)}%`
                : "Completed"}
            </div>
            <div className="label">OCR Result</div>
          </div>
          <div className="metric">
            <div className="num">{registration?.verification?.document_type || "Identity document"}</div>
            <div className="label">Document Type</div>
          </div>
        </div>

        <button
          className="btn btn-primary"
          onClick={submit}
          disabled={busy || missing.some((name) => !values[name]?.trim())}
        >
          {busy ? "Saving…" : "Confirm Information"}
        </button>
      </div>
    </>
  );
}
