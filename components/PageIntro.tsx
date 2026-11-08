/** Static page heading shown in the pre-rendered HTML until the interactive page loads. */
export default function PageIntro({ title, lead }: { title: string; lead: string }) {
  return (
    <main className="page">
      <div className="page-head">
        <h1>{title}</h1>
        <p className="lead">{lead}</p>
      </div>
    </main>
  );
}
