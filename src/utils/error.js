/**
 * Create Error
 * @param status
 * @param message
 * @param details
 * @returns {{details: *, message: *, status: *}}
 */
export function createError(status,message,details) {

    return {
        status,
        message,
        details
    }
}