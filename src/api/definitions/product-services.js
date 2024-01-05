import Joi from 'joi'

const createSchema = {
    title: Joi.string().required(),
    description: Joi.string().optional().allow('',null),
    price: Joi.string().required(),
    enabled: Joi.boolean(),
    product: Joi.array().items(Joi.string()).optional()
}

const updateSchema = {
    title: Joi.string(),
    description: Joi.string().optional().allow('',null),
    price: Joi.string(),
    enabled: Joi.boolean(),
    product: Joi.array().items(Joi.string())
}

const create = {
    validateSchema: createSchema
}

const update = {
    validateSchema: updateSchema
}

export default {
    security: {
        //role: "admin"
        defaultPermissions : true
    },
    create,
    update,
    indexingConfig: {
        fields: ['key','title']
    }
}