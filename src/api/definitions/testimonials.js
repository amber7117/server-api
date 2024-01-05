import Joi from "joi"

const createSchema = {
    image: Joi.string().optional(),
    name: Joi.string().required(),
    description: Joi.string().required(),
    designation : Joi.string().required()
}

const updateSchema = {
    image: Joi.string().optional(),
    name: Joi.string().optional(),
    description: Joi.string().optional(),
    designation : Joi.string().optional()
}

const create = {
    validateSchema: createSchema
}

const update = {
    validateSchema: updateSchema
}

export default {
    security: {
        role: 'admin'
    },
    create,
    update,
    indexingConfig: {
        fields: ['key']
    }
}
