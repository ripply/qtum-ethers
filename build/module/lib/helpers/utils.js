import { encode as encodeVaruint, encodingLength } from 'varuint-bitcoin';
import { encode } from 'bip66';
import { OPS } from "./opcodes";
import { GLOBAL_VARS } from "./global-vars";
import { BufferCursor } from './buffer-cursor';
//@ts-ignore
import { ecdsaSign, sign } from 'secp256k1';
let secp256k1Sign = ecdsaSign;
if (!ecdsaSign && sign) {
    // support version 3 secp256k1 library (used by metamask)
    //@ts-ignore
    secp256k1Sign = function (buffer, privateKey) {
        // v3 uses different version of Buffer, fake that these are compatabile
        //@ts-ignore
        buffer._isBuffer = true;
        //@ts-ignore
        privateKey._isBuffer = true;
        return sign(buffer, privateKey);
    };
}
import { encode as encodeCInt, decode as decodeCInt } from "bitcoinjs-lib/src/script_number";
import { sha256, ripemd160 } from "hash.js";
import { BigNumber } from "bignumber.js";
import { arrayify, hexlify } from "ethers/lib/utils";
import { BigNumber as BigNumberEthers } from "ethers";
import { decode } from "./hex-decoder";
import { computePublicKey } from "@ethersproject/signing-key";
const toBuffer = require('typedarray-to-buffer');
const bitcoinjs = require("bitcoinjs-lib");
// metamask BigNumber uses a different version so the API doesn't match up
[
    "lessThanOrEqualTo",
    "greaterThan",
    "lessThan",
].forEach((methodName) => {
    // adds is ____ to prototype to reference existing method for api compat
    const is = "is" + methodName.charAt(0).toUpperCase() + methodName.slice(1);
    // @ts-ignore
    if (!BigNumber.prototype[is] && BigNumber.prototype[methodName]) {
        // @ts-ignore
        BigNumber.prototype[is] = BigNumber.prototype[methodName];
    }
});
function cloneBuffer(buffer) {
    let result = Buffer.alloc(buffer.length);
    buffer.copy(result);
    return result;
}
function cloneTx(tx) {
    let result = { version: tx.version, locktime: tx.locktime, vins: [], vouts: [] };
    for (let vin of tx.vins) {
        result.vins.push({
            txid: cloneBuffer(vin.txid),
            vout: vin.vout,
            hash: cloneBuffer(vin.hash),
            sequence: vin.sequence,
            script: cloneBuffer(vin.script),
            scriptSig: null
        });
    }
    for (let vout of tx.vouts) {
        result.vouts.push({
            script: cloneBuffer(vout.script),
            value: vout.value,
        });
    }
    return result;
}
// refer to https://en.bitcoin.it/wiki/Transaction#General_format_of_a_Bitcoin_transaction_.28inside_a_block.29
export function calcTxBytes(vins, vouts) {
    return 4 + encodingLength(vins.length) +
        vins
            .map(vin => (vin.scriptSig ? vin.scriptSig.byteLength : vin.script.byteLength))
            .reduce((sum, len) => sum + 40 + encodingLength(len) + len, 0) +
        encodingLength(vouts.length) +
        vouts
            .map(vout => vout.script.byteLength)
            .reduce((sum, len) => sum + 8 + encodingLength(len) + len, 0) + 4;
}
function calcTxBytesToEstimateFee(vins, vouts) {
    return GLOBAL_VARS.TX_EMPTY_SIZE +
        vins.reduce(function (a) { return a + inputBytesToEstimateFee(); }, 0) +
        vouts.reduce(function (a, x) { return a + outputBytesToEstimateFee(x); }, 0);
}
// Argument here would be irrelevant considering the assumption that all vins are p2pkh
function inputBytesToEstimateFee() {
    return GLOBAL_VARS.TX_INPUT_BASE + GLOBAL_VARS.TX_SCRIPTSIG;
}
function outputBytesToEstimateFee(script) {
    return GLOBAL_VARS.TX_OUTPUT_BASE + script.byteLength;
}
export function txToBuffer(tx) {
    let neededBytes = calcTxBytes(tx.vins, tx.vouts);
    let buffer = Buffer.alloc(neededBytes);
    let cursor = new BufferCursor(buffer);
    // version
    cursor.writeUInt32LE(tx.version);
    // vin length
    cursor.writeBytes(encodeVaruint(tx.vins.length));
    // vin
    for (let vin of tx.vins) {
        cursor.writeBytes(vin.hash);
        cursor.writeUInt32LE(vin.vout);
        if (vin.scriptSig !== null) {
            cursor.writeBytes(encodeVaruint(vin.scriptSig.length));
            cursor.writeBytes(vin.scriptSig);
        }
        else {
            cursor.writeBytes(encodeVaruint(vin.script.length));
            cursor.writeBytes(vin.script);
        }
        cursor.writeUInt32LE(vin.sequence);
    }
    // vout length
    cursor.writeBytes(encodeVaruint(tx.vouts.length));
    // vouts
    for (let vout of tx.vouts) {
        cursor.writeUInt64LE(vout.value);
        cursor.writeBytes(encodeVaruint(vout.script.length));
        cursor.writeBytes(vout.script);
    }
    // locktime
    cursor.writeUInt32LE(tx.locktime);
    return buffer;
}
// refer to: https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/src/script_signature.js
function toDER(x) {
    let i = 0;
    while (x[i] === 0)
        ++i;
    if (i === x.length)
        return Buffer.alloc(1);
    x = x.slice(i);
    if (x[0] & 0x80)
        return Buffer.concat([Buffer.alloc(1), x], 1 + x.length);
    return x;
}
// refer to: https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/src/script_signature.js
function encodeSig(signature, hashType) {
    const hashTypeMod = hashType & ~0x80;
    if (hashTypeMod <= 0 || hashTypeMod >= 4)
        throw new Error('Invalid hashType ' + hashType);
    const hashTypeBuffer = Buffer.from([hashType]);
    const bufferSignature = Buffer.from(signature);
    const r = toDER(bufferSignature.slice(0, 32));
    const s = toDER(bufferSignature.slice(32, 64));
    return Buffer.concat([encode(r, s), hashTypeBuffer]);
}
/////////////////////////////////////////
export async function signp2pkh(tx, vindex, privKey) {
    return await signp2pkhWith(tx, vindex, (hash) => {
        return secp256k1Sign(hash, arrayify(privKey));
    });
}
export async function signp2pkhWith(tx, vindex, signer) {
    let clone = cloneTx(tx);
    // clean up relevant script
    let filteredPrevOutScript = clone.vins[vindex].script.filter((op) => op !== OPS.OP_CODESEPARATOR);
    // Uint8Array issue here
    clone.vins[vindex].script = toBuffer(filteredPrevOutScript);
    // zero out scripts of other inputs
    for (let i = 0; i < clone.vins.length; i++) {
        if (i === vindex)
            continue;
        clone.vins[i].script = Buffer.alloc(0);
    }
    // write to the buffer
    let buffer = txToBuffer(clone);
    // extend and append hash type
    buffer = Buffer.alloc(buffer.byteLength + 4, buffer);
    // append the hash type
    buffer.writeUInt32LE(GLOBAL_VARS.HASH_TYPE, buffer.byteLength - 4);
    // double-sha256
    let firstHash = sha256().update(buffer).digest();
    let secondHash = sha256().update(firstHash).digest();
    // sign hash
    let sig = await signer(new Uint8Array(secondHash));
    // encode sig
    return encodeSig(sig.signature, GLOBAL_VARS.HASH_TYPE);
}
export function p2pkhScriptSig(sig, pubkey) {
    return bitcoinjs.script.compile([sig, Buffer.from(pubkey, 'hex')]);
}
// Refer to:
// https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/src/payments/p2pkh.js#L58
export function p2pkhScript(hash160PubKey) {
    return bitcoinjs.script.compile([
        OPS.OP_DUP,
        OPS.OP_HASH160,
        hash160PubKey,
        OPS.OP_EQUALVERIFY,
        OPS.OP_CHECKSIG
    ]);
}
export function contractTxScript(contractAddress, gasLimit, gasPrice, encodedData) {
    // If contractAddress is missing, assume it's a create script, else assume its a call contract interaction
    if (contractAddress === "") {
        return bitcoinjs.script.compile([
            OPS.OP_4,
            encodeCInt(gasLimit),
            encodeCInt(gasPrice),
            Buffer.from(encodedData, "hex"),
            OPS.OP_CREATE,
        ]);
    }
    else {
        console.log("contractTxScript gasPrice", gasPrice);
        return bitcoinjs.script.compile([
            OPS.OP_4,
            encodeCInt(gasLimit),
            encodeCInt(gasPrice),
            Buffer.from(encodedData, "hex"),
            Buffer.from(contractAddress, "hex"),
            OPS.OP_CALL,
        ]);
    }
}
function reverse(src) {
    let buffer = Buffer.alloc(src.length);
    for (var i = 0, j = src.length - 1; i <= j; ++i, --j) {
        buffer[i] = src[j];
        buffer[j] = src[i];
    }
    return buffer;
}
export function generateContractAddress(txid) {
    let buffer = Buffer.alloc(32 + 4);
    let cursor = new BufferCursor(buffer);
    cursor.writeBytes(reverse(Buffer.from(txid, "hex")));
    // Assuming vout index is 0 as the transaction is serialized with that assumption.
    cursor.writeUInt32LE(0);
    let firstHash = sha256().update(buffer.toString("hex"), "hex").digest("hex");
    let secondHash = ripemd160().update(firstHash, "hex").digest("hex");
    return secondHash;
}
export function addVins(utxos, neededAmount, hash160PubKey) {
    let balance = 0.0;
    let inputs = [];
    let amounts = [];
    for (let i = 0; i < utxos.length; i++) {
        // investigate issue where amount has no decimal point as calculation panics
        let x = parseFloat(utxos[i].amount).toFixed(7);
        balance += parseFloat(x);
        inputs.push({ txid: Buffer.from(utxos[i].txid, 'hex'), vout: utxos[i].vout, hash: reverse(Buffer.from(utxos[i].txid, 'hex')), sequence: 0xffffffff, script: p2pkhScript(Buffer.from(hash160PubKey, "hex")), scriptSig: null });
        amounts.push(parseFloat(x));
        if (new BigNumber(neededAmount).isLessThanOrEqualTo(balance)) {
            break;
        }
    }
    return [inputs, amounts];
}
export function addContractVouts(gasPrice, gasLimit, data, address, amounts, value, hash160PubKey, vins) {
    let vouts = [];
    const returnAmount = amounts.reduce((a, b) => a + b);
    const networkFee = new BigNumber(calcTxBytesToEstimateFee(vins, [contractTxScript(address === "" ? "" : address.split("0x")[1], gasLimit, gasPrice, data.split("0x")[1]), p2pkhScript(Buffer.from(hash160PubKey, "hex"))]).toString() + `e-3`).times(0.004).toFixed(7);
    const gas = new BigNumber(new BigNumber(gasPrice + `e-8`).toFixed(7)).times(gasLimit).toFixed(7);
    vouts.push({
        script: contractTxScript(address === "" ? "" : address.split("0x")[1], gasLimit, gasPrice, data.split("0x")[1]),
        value: new BigNumber(value).times(1e8).toNumber()
    });
    // if spending amounts === amounts needed for gas/value/network fee, do not add a change vout
    if (new BigNumber(returnAmount).isGreaterThan(new BigNumber(gas).plus(networkFee).plus(value))) {
        vouts.push({
            script: p2pkhScript(Buffer.from(hash160PubKey, "hex")),
            value: new BigNumber(returnAmount).minus(gas).minus(value).minus(networkFee).times(1e8).toNumber()
        });
        return vouts;
    }
    // call qtum_getUTXOs to see if the account has enough to spend with the networkFee and some (for adding more inputs, it costs $$$!) taken into account
    else if (new BigNumber(returnAmount).isLessThan(new BigNumber(gas).plus(networkFee).plus(value))) {
        console.log("returnNumber", returnAmount, " < ", gas, " + ", networkFee, " + ", value);
        return new BigNumber(networkFee).plus(0.0019400).toFixed(7);
    }
    else {
        return vouts;
    }
}
export function addp2pkhVouts(hash160Address, amounts, value, hash160PubKey, vins) {
    let vouts = [];
    const returnAmount = amounts.reduce((a, b) => a + b);
    const networkFee = new BigNumber(calcTxBytesToEstimateFee(vins, [p2pkhScript(Buffer.from(hash160Address, "hex")), p2pkhScript(Buffer.from(hash160PubKey, "hex"))]).toString() + `e-3`).times(0.004).toFixed(7);
    vouts.push({
        script: p2pkhScript(Buffer.from(hash160Address, "hex")),
        value: new BigNumber(value).times(1e8).toNumber()
    });
    if (new BigNumber(returnAmount).isGreaterThan(new BigNumber(value).plus(networkFee))) {
        vouts.push({
            script: p2pkhScript(Buffer.from(hash160PubKey, "hex")),
            value: new BigNumber(returnAmount).minus(value).minus(networkFee).times(1e8).toNumber()
        });
        return vouts;
    }
    // call qtum_getUTXOs to see if the account has enough to spend with the networkFee and some (for adding more inputs, it costs $$$!) taken into account
    else if (new BigNumber(returnAmount).isLessThan(new BigNumber(networkFee).plus(networkFee).plus(value))) {
        return new BigNumber(networkFee).plus(0.0019400).toFixed(7);
    }
    else {
        return vouts;
    }
}
export function parseSignedTransaction(transaction) {
    let tx = {
        hash: "",
        to: "",
        from: "",
        nonce: 1,
        gasLimit: BigNumberEthers.from("0x3d090"),
        gasPrice: BigNumberEthers.from("0x28"),
        data: "",
        value: BigNumberEthers.from("0x0"),
        chainId: 81,
    };
    // Set hash (double sha256 of raw TX string)
    const sha256HashFirst = sha256().update(transaction, "hex").digest("hex");
    const sha256HashSecond = reverse(Buffer.from(sha256().update(sha256HashFirst, "hex").digest("hex"), "hex")).toString("hex");
    tx['hash'] = `0x${sha256HashSecond}`;
    const btcDecodedRawTx = decode(transaction);
    // Check if first OP code is OP_DUP -> assume p2pkh script
    if (bitcoinjs.script.decompile(btcDecodedRawTx.outs[GLOBAL_VARS.UTXO_VINDEX].script)[0] === OPS.OP_DUP) {
        tx['to'] = `0x${bitcoinjs.script.decompile(btcDecodedRawTx.outs[GLOBAL_VARS.UTXO_VINDEX].script)[2].toString("hex")}`;
        // If there is no change output, which is currently being used to identify the sender, how else can we find out the from address?
        tx['from'] = btcDecodedRawTx.outs.length > 1 ? `0x${bitcoinjs.script.decompile(btcDecodedRawTx.outs[1].script)[2].toString("hex")}` : "";
        tx['value'] = BigNumberEthers.from(hexlify(btcDecodedRawTx.outs[GLOBAL_VARS.UTXO_VINDEX].value));
    }
    // Check if first OP code is OP_4 and length is > 5 -> assume contract call
    else if (bitcoinjs.script.decompile(btcDecodedRawTx.outs[GLOBAL_VARS.UTXO_VINDEX].script)[0] === OPS.OP_4 && bitcoinjs.script.decompile(btcDecodedRawTx.outs[GLOBAL_VARS.UTXO_VINDEX].script).length > 5) {
        tx['to'] = `0x${bitcoinjs.script.decompile(btcDecodedRawTx.outs[GLOBAL_VARS.UTXO_VINDEX].script)[4].toString("hex")}`;
        // If there is no change output, which is currently being used to identify the sender, how else can we find out the from address?
        tx['from'] = btcDecodedRawTx.outs.length > 1 ? `0x${bitcoinjs.script.decompile(btcDecodedRawTx.outs[1].script)[2].toString("hex")}` : "";
        tx['value'] = btcDecodedRawTx.outs[GLOBAL_VARS.UTXO_VINDEX].value > 0 ? BigNumberEthers.from(hexlify(btcDecodedRawTx.outs[GLOBAL_VARS.UTXO_VINDEX].value)) : BigNumberEthers.from("0x0");
        tx['data'] = bitcoinjs.script.decompile(btcDecodedRawTx.outs[GLOBAL_VARS.UTXO_VINDEX].script)[3].toString("hex");
        tx['value'] = BigNumberEthers.from(hexlify(btcDecodedRawTx.outs[GLOBAL_VARS.UTXO_VINDEX].value)).toNumber() === 0 ? BigNumberEthers.from("0x0") : BigNumberEthers.from(hexlify(btcDecodedRawTx.outs[GLOBAL_VARS.UTXO_VINDEX].value));
    }
    // assume contract creation
    else {
        tx['to'] = "";
        // If there is no change output, which is currently being used to identify the sender, how else can we find out the from address?
        tx['from'] = btcDecodedRawTx.outs.length > 1 ? `0x${bitcoinjs.script.decompile(btcDecodedRawTx.outs[1].script)[2].toString("hex")}` : "";
        tx['gasLimit'] = BigNumberEthers.from(hexlify(decodeCInt(bitcoinjs.script.decompile(btcDecodedRawTx.outs[0].script)[1])));
        tx['gasPrice'] = BigNumberEthers.from(hexlify(decodeCInt(bitcoinjs.script.decompile(btcDecodedRawTx.outs[0].script)[2])));
        tx['data'] = bitcoinjs.script.decompile(btcDecodedRawTx.outs[0].script)[3].toString("hex");
    }
    return tx;
}
export function computeAddress(key) {
    const publicKey = computePublicKey(key);
    return computeAddressFromPublicKey(publicKey);
}
export function computeAddressFromPublicKey(publicKey) {
    if (!publicKey.startsWith("0x")) {
        publicKey = "0x" + publicKey;
    }
    const sha256Hash = sha256().update(publicKey.split("0x")[1], "hex").digest("hex");
    const prefixlessAddress = ripemd160().update(sha256Hash, "hex").digest("hex");
    return `0x${prefixlessAddress}`;
}
export function checkTransactionType(tx) {
    if (!!tx.to === false && (!!tx.value === false || BigNumberEthers.from(tx.value).toNumber() === 0) && !!tx.data === true) {
        const needed = new BigNumber(BigNumberEthers.from(tx.gasPrice).toNumber().toString() + `e-8`).times(BigNumberEthers.from(tx.gasLimit).toNumber()).toFixed(7).toString();
        console.log("checkTransactionType 1", needed, tx);
        return { transactionType: GLOBAL_VARS.CONTRACT_CREATION, neededAmount: needed };
    }
    else if (!!tx.to === false && BigNumberEthers.from(tx.value).toNumber() > 0 && !!tx.data === true) {
        console.log("checkTransactionType 2", tx);
        return { transactionType: GLOBAL_VARS.DEPLOY_ERROR, neededAmount: "0" };
    }
    else if (!!tx.to === true && !!tx.data === true) {
        const needed = !!tx.value === true ? new BigNumber(new BigNumber(BigNumberEthers.from(tx.gasPrice).toString() + `e-8`).toFixed(7)).times(BigNumberEthers.from(tx.gasLimit).toNumber()).plus(BigNumberEthers.from(tx.value).toString() + `e-8`).toFixed(7) : new BigNumber(new BigNumber(BigNumberEthers.from(tx.gasPrice).toString() + `e-8`).toFixed(7)).times(BigNumberEthers.from(tx.gasLimit).toNumber()).toFixed(7);
        console.log("checkTransactionType 3", needed, tx);
        return { transactionType: GLOBAL_VARS.CONTRACT_CALL, neededAmount: needed };
    }
    else {
        const needed = new BigNumber(BigNumberEthers.from(tx.value).toString() + `e-8`).toFixed(7);
        console.log("checkTransactionType 4", needed, tx);
        return { transactionType: GLOBAL_VARS.P2PKH, neededAmount: needed };
    }
}
export async function serializeTransaction(utxos, neededAmount, tx, transactionType, privateKey, publicKey) {
    const signer = (hash) => {
        return secp256k1Sign(hash, arrayify(privateKey));
    };
    return await serializeTransactionWith(utxos, neededAmount, tx, transactionType, signer, publicKey);
}
export async function serializeTransactionWith(utxos, neededAmount, tx, transactionType, signer, publicKey) {
    // Building the QTUM tx that will eventually be serialized.
    let qtumTx = { version: 2, locktime: 0, vins: [], vouts: [] };
    // @ts-ignore
    const [vins, amounts] = addVins(utxos, neededAmount, tx.from.split("0x")[1]);
    qtumTx.vins = vins;
    if (transactionType !== 3) {
        if (transactionType === 2) {
            // @ts-ignore
            let localVouts = addContractVouts(BigNumberEthers.from(tx.gasPrice).toNumber(), BigNumberEthers.from(tx.gasLimit).toNumber(), tx.data, "", amounts, new BigNumber(BigNumberEthers.from("0x0").toNumber() + `e-8`).toFixed(7), tx.from.split("0x")[1], qtumTx.vins);
            if (typeof localVouts === 'string') {
                console.log("serializeTransaction no vouts 1", localVouts);
                return { serializedTransaction: "", networkFee: localVouts };
            }
            qtumTx.vouts = localVouts;
        }
        else {
            // @ts-ignore
            let localVouts = addContractVouts(BigNumberEthers.from(tx.gasPrice).toNumber(), BigNumberEthers.from(tx.gasLimit).toNumber(), tx.data, tx.to, amounts, !!tx.value === true ? new BigNumber(BigNumberEthers.from(tx.value).toNumber() + `e-8`).toNumber() : new BigNumber(BigNumberEthers.from("0x0").toNumber() + `e-8`).toFixed(7), tx.from.split("0x")[1], qtumTx.vins);
            if (typeof localVouts === 'string') {
                console.log("serializeTransaction no vouts 2", localVouts);
                return { serializedTransaction: "", networkFee: localVouts };
            }
            qtumTx.vouts = localVouts;
        }
        // Sign necessary vins
        const updatedVins = [];
        for (let i = 0; i < qtumTx.vins.length; i++) {
            updatedVins.push({ ...qtumTx.vins[i], ['scriptSig']: p2pkhScriptSig(await signp2pkhWith(qtumTx, i, signer), publicKey.split("0x")[1]) });
        }
        qtumTx.vins = updatedVins;
        // Build the serialized transaction string.
        const serialized = txToBuffer(qtumTx).toString('hex');
        console.log("serializeTransaction txToBuffer1", serialized);
        return { serializedTransaction: serialized, networkFee: "" };
    }
    else {
        // @ts-ignore
        let localVouts = addp2pkhVouts(tx.to.split("0x")[1], amounts, new BigNumber(BigNumberEthers.from(tx.value).toNumber() + `e-8`).toFixed(7), tx.from.split("0x")[1], qtumTx.vins);
        if (typeof localVouts === 'string') {
            console.log("serializeTransaction no vouts 3", localVouts);
            return { serializedTransaction: "", networkFee: localVouts };
        }
        else {
            qtumTx.vouts = localVouts;
            // Sign necessary vins
            const updatedVins = [];
            for (let i = 0; i < qtumTx.vins.length; i++) {
                updatedVins.push({ ...qtumTx.vins[i], ['scriptSig']: p2pkhScriptSig(await signp2pkhWith(qtumTx, i, signer), publicKey.split("0x")[1]) });
            }
            qtumTx.vins = updatedVins;
            // Build the serialized transaction string.
            const serialized = txToBuffer(qtumTx).toString('hex');
            console.log("serializeTransaction txToBuffer2", serialized);
            return { serializedTransaction: serialized, networkFee: "" };
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvbGliL2hlbHBlcnMvdXRpbHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUFFLE1BQU0sSUFBSSxhQUFhLEVBQUUsY0FBYyxFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFDMUUsT0FBTyxFQUFFLE1BQU0sRUFBRSxNQUFNLE9BQU8sQ0FBQztBQUMvQixPQUFPLEVBQUUsR0FBRyxFQUFFLE1BQU0sV0FBVyxDQUFDO0FBQ2hDLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSxlQUFlLENBQUM7QUFDNUMsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLGlCQUFpQixDQUFDO0FBQy9DLFlBQVk7QUFDWixPQUFPLEVBQUUsU0FBUyxFQUFFLElBQUksRUFBRSxNQUFNLFdBQVcsQ0FBQztBQUM1QyxJQUFJLGFBQWEsR0FBRyxTQUFTLENBQUE7QUFDN0IsSUFBSSxDQUFDLFNBQVMsSUFBSSxJQUFJLEVBQUU7SUFDcEIseURBQXlEO0lBQ3pELFlBQVk7SUFDWixhQUFhLEdBQUcsVUFBUyxNQUFNLEVBQUUsVUFBVTtRQUN2Qyx1RUFBdUU7UUFDdkUsWUFBWTtRQUNaLE1BQU0sQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDO1FBQ3hCLFlBQVk7UUFDWixVQUFVLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQztRQUM1QixPQUFPLElBQUksQ0FBQyxNQUFNLEVBQUUsVUFBVSxDQUFDLENBQUM7SUFDcEMsQ0FBQyxDQUFBO0NBQ0o7QUFDRCxPQUFPLEVBQUUsTUFBTSxJQUFJLFVBQVUsRUFBRSxNQUFNLElBQUksVUFBVSxFQUFFLE1BQU0saUNBQWlDLENBQUE7QUFDNUYsT0FBTyxFQUFFLE1BQU0sRUFBRSxTQUFTLEVBQUUsTUFBTSxTQUFTLENBQUE7QUFDM0MsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLGNBQWMsQ0FBQTtBQUN4QyxPQUFPLEVBQ0gsUUFBUSxFQUVSLE9B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QUFJLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxTQUFTLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUE7UUFDeEksRUFBRSxDQUFDLE9BQU8sQ0FBQyxHQUFHLGVBQWUsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLFdBQVcsQ0FBQyxDQUFDLEtBQUssR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLFdBQVcsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUE7UUFDeEwsRUFBRSxDQUFDLE1BQU0sQ0FBQyxHQUFHLFNBQVMsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLFdBQVcsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQTtRQUNoSCxFQUFFLENBQUMsT0FBTyxDQUFDLEdBQUcsZUFBZSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsV0FBVyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxRQUFRLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLFdBQVcsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUE7S0FD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