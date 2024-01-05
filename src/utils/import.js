import axios from 'axios';
export async function restoreBackup(url) {
  if (!url) {
    console.warn("No Backup Url found");
    return;
  }
  console.debug("Downloading Backup");
  const { data } = await axios.get(url);
  console.debug("Downloading Complete");
  const db = this.firebaseAdmin.db;
  await Promise.all(
    Object.keys(data).map(async (key) => {
      if (key === "backup") {
        return;
      }
      console.debug("Restoring " + key);
      // await Promise.all(
      //   Object.keys(data[key]).map(async (key2) => {
      //     const ref = db.ref("/" + key + "/" + key2);
      //     await ref.set(data[key][key2]);
      //   })
      // );
      const ref = db.ref("/" + key);
      await ref.set(data[key]);
      console.debug("Restore Complete for " + key);
    })
  );
  console.debug("Restore Full Complete ");
}
