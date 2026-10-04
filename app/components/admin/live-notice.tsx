/**
 * An action's result, in two regions that are in the document before any result arrives: a region
 * inserted together with its text is often never announced. A refusal or failure goes in the alert
 * region, so it interrupts; everything else is polite.
 */
export function LiveNotice({
  status,
  alert,
}: {
  status?: React.ReactNode;
  alert?: React.ReactNode;
}) {
  return (
    <>
      <div role="status">{status ? <p>{status}</p> : null}</div>
      <div role="alert">{alert ? <p>{alert}</p> : null}</div>
    </>
  );
}
