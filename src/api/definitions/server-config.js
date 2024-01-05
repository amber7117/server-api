/**
 * API Definitions for login of user
 */
import Joi from 'joi';

/**
 * Schema for create
 * @type {{password: *, email: *}}
 */
const createSchema = {
    key: Joi.string().required(),
    value: Joi.alternatives().try(Joi.object(),Joi.string()).required(),
    package: Joi.string().required(),
    description : Joi.string().required()
};

/**
 * Create Method configuration
 */
const create = {
    validateSchema: createSchema
};

export default {
    create,
    security : {
        role : "admin"
    }
};