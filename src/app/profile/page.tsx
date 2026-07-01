import { getActiveOrg } from "@/lib/org";
import { saveProfile } from "@/lib/actions";

const label: React.CSSProperties = { display: "block", fontSize: 12, color: "#6b7785", margin: "12px 0 4px", fontWeight: 600 };
const input: React.CSSProperties = { width: "100%", padding: "8px 10px", border: "1px solid #cfd8e3", borderRadius: 7, fontSize: 13 };
const row: React.CSSProperties = { display: "flex", gap: 14 };

export default async function ProfilePage() {
  const org = await getActiveOrg();

  return (
    <div style={{ padding: "28px 32px", maxWidth: 760 }}>
      <h1 style={{ color: "#007A3D", fontSize: 22, margin: 0 }}>Business Profile</h1>
      <p style={{ color: "#6b7785", fontSize: 13, marginTop: 4 }}>
        Your seller identity — used on every ZATCA invoice. Must match your ZATCA registration.
      </p>

      <form action={saveProfile} style={{ background: "#fff", border: "1px solid #e3e8ef", borderRadius: 10, padding: "18px 20px", marginTop: 14 }}>
        <div style={row}>
          <div style={{ flex: 1 }}>
            <label style={label}>Legal name (EN)</label>
            <input style={input} name="name" defaultValue={org?.name ?? ""} required />
          </div>
          <div style={{ flex: 1 }}>
            <label style={label}>Legal name (AR)</label>
            <input style={input} name="name_ar" defaultValue={org?.name_ar ?? ""} />
          </div>
        </div>
        <div style={row}>
          <div style={{ flex: 1 }}>
            <label style={label}>VAT number (15 digits, 3XXXXXXXXXX3)</label>
            <input style={input} name="vat_number" defaultValue={org?.vat_number ?? ""} pattern="3\d{13}3" title="15 digits, starts and ends with 3" required />
          </div>
          <div style={{ flex: 1 }}>
            <label style={label}>CRN / Commercial reg. no.</label>
            <input style={input} name="tax_number" defaultValue={org?.tax_number ?? ""} required />
          </div>
        </div>
        <label style={label}>Registered address</label>
        <div style={row}>
          <input style={input} name="addr_building" placeholder="Building no." defaultValue={org?.addr_building ?? ""} />
          <input style={input} name="addr_street" placeholder="Street" defaultValue={org?.addr_street ?? ""} />
          <input style={input} name="addr_district" placeholder="District" defaultValue={org?.addr_district ?? ""} />
        </div>
        <div style={{ ...row, marginTop: 10 }}>
          <input style={input} name="addr_city" placeholder="City" defaultValue={org?.addr_city ?? ""} required />
          <input style={input} name="addr_postal" placeholder="Postal code (NNNNN)" defaultValue={org?.addr_postal ?? ""} pattern="\d{5}" title="5 digits" required />
          <input style={input} name="addr_country" placeholder="Country" defaultValue={org?.addr_country ?? "SA"} />
        </div>
        <button type="submit" style={{ marginTop: 18, background: "#00994D", color: "#fff", border: "none", padding: "9px 16px", borderRadius: 7, fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
          Save &amp; continue →
        </button>
      </form>
    </div>
  );
}
