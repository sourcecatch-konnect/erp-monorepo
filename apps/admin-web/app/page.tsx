import { Button } from "@skerp/ui/button";

const modules = [
  "Employees",
  "Roles",
  "Permissions",
  "Companies",
  "Branches",
  "Warehouses",
  "Masters",
  "Customers",
  "Vehicles",
  "Agreements",
];

export default function AdminHome() {
  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">Admin Web</p>
        <h1>ERP control center</h1>
        <p>
          Setup employees, RBAC, company structure, and master data before the
          operational apps start moving real work.
        </p>
        <Button className="primaryButton">Admin login skeleton</Button>
      </section>

      <section className="grid">
        {modules.map((module) => (
          <article className="moduleCard" key={module}>
            <h2>{module}</h2>
            <p>Module shell ready for implementation.</p>
          </article>
        ))}
      </section>
    </main>
  );
}
