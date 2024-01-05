import Joi from 'joi'
import { checkServiceKeyDuplicacy } from '../helpers/common'

const createSchema = {
    key: Joi.string().required(),
    make: Joi.string().required(),
    model: Joi.string().required(),
    colour: Joi.string().optional().allow(null,''),
    description: Joi.string().optional().allow(null,''),
}

const updateSchema = {
    make: Joi.string(),
    model: Joi.string(),
    colour: Joi.string().optional().allow(null,''),
    description: Joi.string().optional().allow(null,''),
}

const create = {
    validateSchema: createSchema,
    onBefore: async function (input, req, res) {
        await checkServiceKeyDuplicacy.apply(this, ['products', input, 'product'])
    }
}

const update = {
    validateSchema: updateSchema
}

export default {
    security: {
        defaultPermissions : true
    },
    create,
    update,
    indexingConfig: {
        fields: ['key', 'make', 'model']
    }
}