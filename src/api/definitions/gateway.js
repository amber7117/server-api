import Joi from 'joi';

const createSchema = {
    key: Joi.string().required(),
    enabled: Joi.boolean(),
    apiKey: Joi.string().optional().allow('', null),
    apiSecret: Joi.string().optional().allow('', null),
    logo: Joi.string().optional().allow('', null),
    additionalData: Joi.string().optional().allow('', null)
};
const updateSchema = {
    enabled: Joi.boolean(),
    apiKey: Joi.string().optional().allow('', null),
    apiSecret: Joi.string().optional().allow('', null),
    logo: Joi.string().optional().allow('', null),
    additionalData: Joi.string().optional().allow('', null)
};
const create = {
    validateSchema: createSchema,
    onBefore: async function (input) {
        const { key } = input;
        let isExist = false;
        try {
            await this.service('gateway').get({
                id: key
            });
            isExist = true;
        } catch (e) {

        }
        if (isExist) {
            throw {
                status: 409,
                message: 'Entity Already Exists'
            }
        }
    }
};
const update = {
    validateSchema: updateSchema
};
export default {
    security: {
        role: 'admin'
    },
    indexingConfig: {
        fields: ['key']
    },
    create,
    update
};