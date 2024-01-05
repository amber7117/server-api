import admin from "firebase-admin";
import Config from "../../config/default";
/**
 * Download Backup and send to parent process
 */
async function downloadBackup() {
  const credential = Config.database.firebase.admin;
  const databaseURL = Config.database.firebase.url;
  console.debug("Initializing App for backup");
  await admin.initializeApp({
    credential: admin.credential.cert(credential),
    databaseURL,
  });
  console.debug("initializing complete");
  const ref = admin.database().ref("/");
  console.debug("download started");
  const data = await ref.once("value");
  console.debug("download complete");
  process.send(data);
}

/**
 * Initiate backup
 */
async function startBackup() {
  await downloadBackup();
}
startBackup().catch(console.log);
