import { useEffect, useState } from "react";
import { LoaderCircle, RefreshCw } from "lucide-react";
import { companyApi, registrationApi } from "../../../../lib/api.js";

function value(fields, ...names) {
  for (const name of names) if (fields?.[name]?.value) return fields[name].value;
  return "—";
}

export default function CompanyProfilePage({ user }) {
  const [company, setCompany] = useState(null);
  const [registration, setRegistration] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = async () => { setLoading(true); setError(""); try { const [companyResult, registrationResult] = await Promise.all([companyApi.profile(), registrationApi.status()]); setCompany(companyResult); setRegistration(registrationResult); } catch (reason) { setError(reason.message || "Could not load company profile"); } finally { setLoading(false); } };
  useEffect(() => { void load(); }, []);
  if (loading) return <div className="admin-loading"><LoaderCircle className="spin" /> Loading stored company information…</div>;
  const fields = registration?.fields || {};
  return (
    <>
      <div className="verification-page-heading"><div><h1 className="admin-page-title">Company Profile</h1><p className="admin-page-sub">Company and identity fields shown here are read from the database.</p></div><button className="btn btn-secondary verification-refresh" onClick={load}><RefreshCw size={15} /> Refresh</button></div>
      {error && <div className="verification-alert">{error}</div>}
      {company && <div className="admin-grid-3"><section className="chart-card"><div className="chart-card-title">Company account</div><div className="identity-field-summary portal-single-column"><div className="item"><div className="k">Company name</div><div className="v">{company.company_name}</div></div><div className="item"><div className="k">Status</div><div className="v">{company.status}</div></div><div className="item"><div className="k">Google account</div><div className="v">{user?.email}</div></div><div className="item"><div className="k">Identity verification</div><div className="v">{registration?.verification_status === "verified" ? "Verified" : "Not Verified"}</div></div></div></section><section className="chart-card" style={{ gridColumn: "span 2" }}><div className="chart-card-title">Registered business information</div><div className="identity-field-summary"><div className="item"><div className="k">Registration number</div><div className="v">{company.registration_number || value(fields, "registration_number")}</div></div><div className="item"><div className="k">Address</div><div className="v">{company.address || value(fields, "company_address", "address_english", "address_nepali", "address")}</div></div><div className="item"><div className="k">Phone</div><div className="v">{company.phone || value(fields, "phone")}</div></div><div className="item"><div className="k">Website</div><div className="v">{company.website || "—"}</div></div><div className="item"><div className="k">Representative name</div><div className="v">{value(fields, "name_english", "full_name")}</div></div><div className="item"><div className="k">Representative document</div><div className="v">{value(fields, "document_number")}</div></div></div></section></div>}
    </>
  );
}
