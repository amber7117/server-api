const { fork } = require("child_process");
const {restoreBackup : restoreBackupData} = require("../import")
var CronJob = require("cron").CronJob;
const { NODE_ENV } = process.env;
const path = NODE_ENV === "production" ? "backup.js" : "dist/backup.js";
let job;
async function getData() {
  return await new Promise((resolve) => {
    const task = fork(path);
    task.on("message", (message) => {
      resolve(message);
    });
  });
}
export async function restoreBackup(id) {
  const { url } = await this.service("backup").get({
    id,
  });
  if (url) {
    await restoreBackupData.apply(this, [url]);
    this.initializeIndexes();
  }
}
export async function createBackup({ key }) {
  try {
    console.debug("Backup Job Started");
    await this.service("backup").update({
      id: key,
      data: {
        status: "In Progress",
      },
    });
    const data = await getData();
    const file = {
      buffer: Buffer.from(JSON.stringify(data)),
      size: JSON.stringify(data).length,
    };
    const { url } = await this.service("storage").create({
      file,
      name: "backup.json",
      folder: "backups",
      type: "json",
      fileCode: "configurationFile",
    });
    await this.service("backup").update({
      id: key,
      data: {
        url,
        status: "Finished",
      },
    });
    console.debug("Backup Job Completed");
    return url;
  } catch (e) {
    console.error("Error while performing backup", { e });
    await this.service("backup").update({
      id: key,
      data: {
        status: "Error",
      },
    });
  }
}

/**
 * Schedule Backup
 * @param {*} time
 */
export function scheduleBackup(time, config) {
  console.debug("Scheduling Backup - " + time);
  if (job) {
    job.stop();
  }
  job = new CronJob(
    time,
    () => {
      this.service("backup").create({});
    },
    null,
    true
  );
}

/**
 * Schedule Backup
 * @param {*} time
 */
export async function initializeScheduledBackup() {
  try {
    const { value } = await this.service("configuration").get({
      id: "BACKUP_CRON_SCHEDULE",
    });
    scheduleBackup.apply(this, [value]);
  } catch (e) {
    console.debug("No Schedule for backup found", { e });
  }
}

/**
 * Schedule Backup
 * @param {*} time
 */
export function stopScheduledBackup() {
  console.debug("Removing Schedule for Backup");
  if (job) {
    job.stop();
  }
}
