/**
 * API Definitions for login of user
 */
import Joi from 'joi';
import uuid from 'uuid';
import MimeTypes from 'mime-types';
import {fileToSize} from '../../utils/storage-utils'
import config from '../../config';
const {fileCodes}=config;
//todo : We might need to get resource Urls during find.

/**
 * Schema for create
 * @type {{password: *, email: *}}
 */
const createSchema = {
    name: Joi.string().optional(),
    folder: Joi.string().optional(),
    type: Joi.string().required(),
    file: Joi.alternatives().try(Joi.object(), Joi.string()).required(),
    //todo : Allow fileCode and Api Code to be specified. Perhaps encrypted in order
    //to avoid spam
    fileCode : Joi.valid.apply(Joi,fileCodes).required(),
    //apiCode : Joi.string().required(),
    createdBy: Joi.string()
};


/**
 * Create Method configuration
 */
const create = {
    validateSchema: createSchema,
    onBefore: async function (obj) {
        const {file} = obj;
        obj.name = obj.name || file.originalname;
        if (obj.name) {
            obj.name = (new Date()).getTime().toString() + obj.name;
        } else {
            obj.name = (new Date()).getTime().toString();
            const mimeType = file.split(';')[0].split(':')[1];
            if (MimeTypes.extension(mimeType)) {
                obj.name = obj.name + "." + MimeTypes.extension(mimeType);
            }
        }
        const storage = await this.helper('storage');
        if(obj.folder){
            obj.name = obj.folder + "/" + obj.name
        }
        const response = await storage.upload(obj.name, file);
        obj.size = fileToSize(file);
        obj.size = fileToSize(file);
        obj.details = {
            ...response
        };
        if (typeof obj.file == "object") {
            obj.details = {
                ...obj.details,
                ...file
            };
            delete obj.details.buffer;
            delete obj.details.fieldname;
        }
        delete obj.file;
        obj.createdBy = obj.createdBy || "system";
        obj.url = await this.helper("getResourceUrl")(obj.name);
    },
    security: true
};

const get = {
    onAfterEach: async function (output, id) {
        const { details } = output;
        if (!details) {
            warnNoAdapter(id);
        }

    },
    security: false
};

const find = {
    onAfter: async function (output) {

        await Promise.all((output || []).map(async (obj) => {
            const { details } = obj;
            if (!details) {
                warnNoAdapter();
            }
            return obj;

        }));
    }
};

/**
 * Configuration for remove
 * @type {{onBeforeEach: remove.onBeforeEach}}
 */
const remove = {
    onBeforeEach: async function (id) {
        let file = await this.service("storage").get({
            id
        });
        const { resourceId, details } = file;
        const storage = await this.helper('storage');
        if (resourceId && details) {

            if (await storage.getAdapter() == details.adapter) {
                await storage.remove(resourceId, details);
            } else {
                throw `Current Adapter and the adapter used during upload don't match for 
                    the record ${id}
                `
            }

        } else {
            warnNoAdapter(id);
        }
    }
};

const download = {
    callback: async function (req, res) {
        const id = req.params.id + (req.params[0] || "");
        const storage = await this.helper('storage');
        const result = await storage.getResourceUrl(id);
        return res.redirect(result);
    },
    method: "GET",
    security: false
};

function warnNoAdapter(id) {
    console.warn(`It seems like the file for ${id} was not uploaded
            as no adapter exists
            `);
}

export default {
    create,
    remove,
    get,
    find,
    security: {
        role: "admin"
    },
    additionalPaths: {
        "download/:id*": download
    }
};
