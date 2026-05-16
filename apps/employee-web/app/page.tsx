import { Button } from "@skerp/ui/components/button";

const modules = [
  "Dashboard",
  "Orders",
  "Lorry Receipts",
  "Trips",
  "Fleet Tracking",
  "Operations",
  "Accounts",
  "Profile",
];

export default function EmployeeHome() {
  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">Employee Web</p>
        <h1>ERP operations workspace</h1>
        <p>
          Permission-aware workspace for daily orders, LR, trips, fleet
          tracking, operations, and account workflows.
        </p>
        <Button className="primaryButton">Employee login skeleton</Button>
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
