import { request } from 'https';
export default async function (data, gateway) {
    return await new Promise((resolve, reject) => {
        const { razorpay_payment_id, amount, currency } = data;
        const { apiKey, apiSecret } = gateway;
        const req = request({
            host: 'api.razorpay.com',
            path: '/v1/payments/' + razorpay_payment_id + '/capture',
            method: 'POST',
            port: 443,
            withCredentials: true,
            form: {
                'grant_type': 'client_credentials'
            },
            headers: {
                'Authorization': 'Basic ' + new Buffer(apiKey + ':' + apiSecret).toString('base64'),
                'Content-Type': 'application/json',
                'Content-Length': JSON.stringify({ amount, currency }).length
            },
            auth: {
                username: apiKey,
                password: apiSecret
            }
        }, function (res) {
            let response = '';
            res.on('data', data => {
                response = response + data.toString();
            });
            res.on('end', () => {
                const { error } = JSON.parse(response);
                if (error) {
                    reject(error);
                } else {
                    resolve();
                }
            });
            res.on('error', e=>{
                reject(e)
            });
        });
        req.write(JSON.stringify({
            amount,
            currency
        }));
        req.end();
    });
}