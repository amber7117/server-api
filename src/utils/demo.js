import { restoreBackup } from "./import";
export default function () {
  const { isDemoEnabled, clearInterval } = this.config || {};
  if (isDemoEnabled && clearInterval) {
    setInterval(() => {
      cb.call(this);
    }, 1000 * clearInterval );
  }
}
async function cb() {
  try {
    if (this.config.backupUrl) {
      console.log("Restoring initial data");
      await restoreBackup.apply(this, [this.config.backupUrl]);
      await this.initializeIndexes();
    }
  } catch (e) {
    console.error("Error while restoring initial backup", { e });
  }
}
