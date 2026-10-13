/**
 * Pure decisions for first-time cross-device sync. Never merge two active
 * queues blindly: their order/repair streaks are interdependent.
 */
import { restoreSession, isValidSession } from "./queue.mjs";

export function comparable(session) {
  if (!session) return null;
  return JSON.stringify({
    manifest:session.manifest,
    queue:session.queue,
    complete:session.complete,
    progress:session.progress,
    attempts:session.attempts
  });
}
export function decideFirstSync(local, remoteData, deck) {
  if (!isValidSession(local,deck)) throw new Error("Invalid browser study data");
  if (remoteData === null) return { action:"upload", session:local, version:0 };
  if (!remoteData || remoteData.schema!==1 ||
      !Number.isInteger(remoteData.version) ||
      remoteData.version<1 || remoteData.version>10000000)
    return {action:"invalid",reason:"Unexpected cloud document format"};
  const remote=restoreSession(remoteData.session,deck);
  if (!remote || !isValidSession(remote,deck))
    return {action:"invalid",reason:"Cloud session could not be validated"};
  const version=remoteData.version;
  if (comparable(local)===comparable(remote))
    return {action:"identical",version,session:remote};
  if (local.attempts===0 && local.revision===0)
    return {action:"download",version,session:remote};
  if (remote.attempts===0 && remote.revision===0)
    return {action:"upload",version,session:local};
  return {action:"conflict",version,session:remote};
}
