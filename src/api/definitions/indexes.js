export default {
    security: {
        role:'admin'
    },
    get: {
        method: async function (input) {
            return this.initializeMultipleIndexes(input.split(','))
        }
    },
    find: {
        method: async function () {
            return this.initializeIndexes()
        }
    }
};