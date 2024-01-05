import { AES } from 'crypto-js';
import config from '../config';
const {encryptionKey} = config;
export function encrypt(text,key=encryptionKey) {
    return AES.encrypt(text, key).toString();
}

export function decrypt(cipher,key=encryptionKey) {
    return Buffer.from(AES.decrypt(cipher, key).toString(), 'hex').toString();
}