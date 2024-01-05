import Joi from 'joi';
import { compile } from '../../utils/handlebars';
const createSchema = {
    key: Joi.string().required(),
    name: Joi.string().required(),
    templateVariables: Joi.string().optional().allow('', null),
    template: Joi.string().required()
};
const create = {
    validateSchema: createSchema,
    onBefore: async function (input) {
        const { key } = input;
        let isExist = false;
        try {
            await this.service('pdf-template').get({
                id: key
            });
            isExist = true;
        } catch (e) {

        }
        if (isExist) {
            throw {
                status: 404,
                message: 'Template Already Exist'
            }
        }
    }
};
const updateSchema = {
    name: Joi.string().optional(),
    template: Joi.string().optional(),
    templateVariables: Joi.string().optional().allow('', null),
};
const update = {
    validateSchema: updateSchema
};
const getMarkup = {
    security: true,
    method: 'POST',
    callback: async function (req) {
        await Joi.validate(req.body, Joi.object().keys({
            id: Joi.string().required(),
            data: Joi.object().required()
        }));
        const { id, data } = req.body;        
        const { template, name } = await this.service('pdf-template').get({
            id
        });
        return {
            name: compile(name)(data),
            html: compile(template)(data)
        };
    }
};
const duplicate = {
    security: {
        role: 'admin'
    },
    method: 'POST',
    callback: async function (req) {
        await Joi.validate(req.body, Joi.object().keys({
            id: Joi.string().required(),
            key: Joi.string().required()
        }));
        const { id, key } = req.body;
        const { createdAt, createdBy, updatedAt, updatedBy, ...data } = await this.service(this.key).get({
            id
        });
        await this.service(this.key).create({
            ...data,
            key
        });
    }
};
export default {
    security: {
        role: 'admin'
    },
    create,
    update,
    indexingConfig: {
        fields: ['key', 'name']
    },
    additionalPaths: {
        getMarkup,
        duplicate
    }
};
