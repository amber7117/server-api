import * as service from './service'


/**
 * create firebase record
 * @param req
 * @param res
 * @return {Promise<*|void|boolean>}
 */
export async function create(req, res, next) {
    let obj = {
        ...req.body
    };
    return service.create.apply(this, [obj, ...arguments])
}

/**
 * get All firebase records
 * @param req
 * @param res
 * @return {Promise<*|void|boolean>}
 */
export async function find(req, res) {
    let obj = {
        ...req.query,
        ...req.params
    };
    return service.find.apply(this, [obj, ...arguments])

}

/**
 * get firebase records
 * @param req
 * @param res
 * @return {Promise<*|void|boolean>}
 */
export async function get(req, res) {
    let obj = {
        id: req.params.id
    };
    return service.get.apply(this, [obj, ...arguments])
}

/**
 * update a firebase record
 * @param req
 * @param res
 * @return {Promise<*|void|boolean>}
 */
export async function update(req, res) {
    let obj = {
        id: req.params.id,
        data: req.body
    };
    return service.update.apply(this, [obj, ...arguments])
}

/**
 * remove firebase records
 * @param req
 * @param res
 * @param next
 * @return {Promise<*|void|boolean>}
 */
export async function remove(req, res, next) {
    let obj = {
        id: req.params.id
    };
    return service.remove.apply(this, [obj, ...arguments])

}


