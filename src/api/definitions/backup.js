import Joi from "joi";
import {
  createBackup,
  restoreBackup,
  scheduleBackup,
  stopScheduledBackup,
} from "../../utils/backup";
import { getRecord } from "../helpers/common";

const createSchema = {};
const create = {
  validateSchema: createSchema,
  onBefore: async function (input) {
    input.status = "Started";
  },
  onAfter: async function (output) {
     createBackup.apply(this, [output]);
  },
};
const updateSchema = {
  url: Joi.string(),
  status: Joi.string().valid("Started", "In Progress", "Error", "Finished"),
  finishedAt: Joi.number(),
  startedAt: Joi.number(),
};
const update = {
  validateSchema: updateSchema,
};
const restore = {
  method: "GET",
  callback: async function (req) {
    const { id } = req.params;
    await restoreBackup.apply(this, [id]).catch(console.log);
  },
};
const schedule = {
  method: "POST",
  callback: async function (req) {
    const { cronString } = req.body;
    const backupCronSchedule = getRecord.apply(this, [
      "configuration",
      "BACKUP_CRON_SCHEDULE",
    ]);
    if (cronString && cronString !== "") {
      if (!backupCronSchedule) {
        await this.service("configuration").create({
          key: "BACKUP_CRON_SCHEDULE",
          value: cronString,
          description: "Cron String for Backup Job",
          type: "text",
        });
      } else {
        await this.service("configuration").update({
          id: "BACKUP_CRON_SCHEDULE",
          data: {
            value: cronString,
          },
        });
      }
      scheduleBackup.apply(this, [cronString]);
    } else {
      try {
        await this.service("configuration").remove({
          id: "BACKUP_CRON_SCHEDULE",
        });
      } catch (e) {
        console.error("BACKUP_CRON_SCHEDULE not found ", { e });
      }
      stopScheduledBackup();
    }
    return;
  },
};
export default {
  create,
  update,
  indexingConfig: {
    fields: ["createdAt"],
  },
  additionalPaths: {
    "restore/:id": restore,
    schedule,
  },
};
  