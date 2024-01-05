import request from 'request';
import axios from 'axios';
const { NODE_ENV } = process.env;
const sandbox = 'sandbox';
//const host='api.' + sandbox + 'paypal.com';
const host = [
    'https://api',
    ...sandbox && [sandbox],
    'paypal',
    'com'
].join('.');
export default async function(payment, gateway) {
    const { orderID, payerID } = payment;
    const { access_token } = await getAccessToken(gateway);
    try {
        const { data } = await axios.get(host + '/v2/checkout/orders/' + orderID, {
            headers: {
                Authorization: 'Bearer ' + access_token
            }
        });
        const { status, payer } = data;
        const { payer_id } = payer;
        if (payerID === payer_id && status === 'APPROVED') {
            return;
        } else {
            throw {
                status: 404,
                message: 'Payment not verified'
            }
        }
    } catch (e) {
        console.error(e.response.data);
        throw e.response.data;
    }

}
async function getAccessToken(gateway) {
    const { apiKey, apiSecret } = gateway;
    return await new Promise(async (resolve, reject) => {
        const stream = await request({
            url: host + '/v1/oauth2/token',
            method: 'POST',
            withCredentials: true,
            form: {
                grant_type: 'client_credentials'
            },
            auth: {
                username: apiKey,
                password: apiSecret
            },
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            }
        });
        let buffer = [];
        stream.on('data', data => {
            buffer.push(data);
        });
        stream.on('end', () => {
            try {
                resolve(JSON.parse(Buffer.concat(buffer)));
            } catch (e) {
                throw e;
            }
        });
        stream.on('error', e => {
            reject(e);
        });
    })
}