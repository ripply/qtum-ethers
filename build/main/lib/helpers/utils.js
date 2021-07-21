"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.serializeTransactionWith = exports.serializeTransaction = exports.checkTransactionType = exports.computeAddressFromPublicKey = exports.computeAddress = exports.parseSignedTransaction = exports.addp2pkhVouts = exports.addContractVouts = exports.addVins = exports.generateContractAddress = exports.contractTxScript = exports.p2pkhScript = exports.p2pkhScriptSig = exports.signp2pkhWith = exports.signp2pkh = exports.txToBuffer = exports.calcTxBytes = void 0;
const varuint_bitcoin_1 = require("varuint-bitcoin");
const bip66_1 = require("bip66");
const opcodes_1 = require("./opcodes");
const global_vars_1 = require("./global-vars");
const buffer_cursor_1 = require("./buffer-cursor");
//@ts-ignore
const secp256k1_1 = require("secp256k1");
let secp256k1Sign = secp256k1_1.ecdsaSign;
if (!secp256k1_1.ecdsaSign && secp256k1_1.sign) {
    // support version 3 secp256k1 library (used by metamask)
    //@ts-ignore
    secp256k1Sign = function (buffer, privateKey) {
        // v3 uses different version of Buffer, fake that these are compatabile
        //@ts-ignore
        buffer._isBuffer = true;
        //@ts-ignore
        privateKey._isBuffer = true;
        return secp256k1_1.sign(buffer, privateKey);
    };
}
const script_number_1 = require("bitcoinjs-lib/src/script_number");
const hash_js_1 = require("hash.js");
const bignumber_js_1 = require("bignumber.js");
const utils_1 = require("ethers/lib/utils");
const ethers_1 = require("ethers");
const hex_decoder_1 = require("./hex-decoder");
const signing_key_1 = require("@ethersproject/signing-key");
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
    if (!bignumber_js_1.BigNumber.prototype[is] && bignumber_js_1.BigNumber.prototype[methodName]) {
        // @ts-ignore
        bignumber_js_1.BigNumber.prototype[is] = bignumber_js_1.BigNumber.prototype[methodName];
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
function calcTxBytes(vins, vouts) {
    return 4 + varuint_bitcoin_1.encodingLength(vins.length) +
        vins
            .map(vin => (vin.scriptSig ? vin.scriptSig.byteLength : vin.script.byteLength))
            .reduce((sum, len) => sum + 40 + varuint_bitcoin_1.encodingLength(len) + len, 0) +
        varuint_bitcoin_1.encodingLength(vouts.length) +
        vouts
            .map(vout => vout.script.byteLength)
            .reduce((sum, len) => sum + 8 + varuint_bitcoin_1.encodingLength(len) + len, 0) + 4;
}
exports.calcTxBytes = calcTxBytes;
function calcTxBytesToEstimateFee(vins, vouts) {
    return global_vars_1.GLOBAL_VARS.TX_EMPTY_SIZE +
        vins.reduce(function (a) { return a + inputBytesToEstimateFee(); }, 0) +
        vouts.reduce(function (a, x) { return a + outputBytesToEstimateFee(x); }, 0);
}
// Argument here would be irrelevant considering the assumption that all vins are p2pkh
function inputBytesToEstimateFee() {
    return global_vars_1.GLOBAL_VARS.TX_INPUT_BASE + global_vars_1.GLOBAL_VARS.TX_SCRIPTSIG;
}
function outputBytesToEstimateFee(script) {
    return global_vars_1.GLOBAL_VARS.TX_OUTPUT_BASE + script.byteLength;
}
function txToBuffer(tx) {
    let neededBytes = calcTxBytes(tx.vins, tx.vouts);
    let buffer = Buffer.alloc(neededBytes);
    let cursor = new buffer_cursor_1.BufferCursor(buffer);
    // version
    cursor.writeUInt32LE(tx.version);
    // vin length
    cursor.writeBytes(varuint_bitcoin_1.encode(tx.vins.length));
    // vin
    for (let vin of tx.vins) {
        cursor.writeBytes(vin.hash);
        cursor.writeUInt32LE(vin.vout);
        if (vin.scriptSig !== null) {
            cursor.writeBytes(varuint_bitcoin_1.encode(vin.scriptSig.length));
            cursor.writeBytes(vin.scriptSig);
        }
        else {
            cursor.writeBytes(varuint_bitcoin_1.encode(vin.script.length));
            cursor.writeBytes(vin.script);
        }
        cursor.writeUInt32LE(vin.sequence);
    }
    // vout length
    cursor.writeBytes(varuint_bitcoin_1.encode(tx.vouts.length));
    // vouts
    for (let vout of tx.vouts) {
        cursor.writeUInt64LE(vout.value);
        cursor.writeBytes(varuint_bitcoin_1.encode(vout.script.length));
        cursor.writeBytes(vout.script);
    }
    // locktime
    cursor.writeUInt32LE(tx.locktime);
    return buffer;
}
exports.txToBuffer = txToBuffer;
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
    return Buffer.concat([bip66_1.encode(r, s), hashTypeBuffer]);
}
/////////////////////////////////////////
async function signp2pkh(tx, vindex, privKey) {
    return await signp2pkhWith(tx, vindex, (hash) => {
        return secp256k1Sign(hash, utils_1.arrayify(privKey));
    });
}
exports.signp2pkh = signp2pkh;
async function signp2pkhWith(tx, vindex, signer) {
    let clone = cloneTx(tx);
    // clean up relevant script
    let filteredPrevOutScript = clone.vins[vindex].script.filter((op) => op !== opcodes_1.OPS.OP_CODESEPARATOR);
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
    buffer.writeUInt32LE(global_vars_1.GLOBAL_VARS.HASH_TYPE, buffer.byteLength - 4);
    // double-sha256
    let firstHash = hash_js_1.sha256().update(buffer).digest();
    let secondHash = hash_js_1.sha256().update(firstHash).digest();
    // sign hash
    let sig = await signer(new Uint8Array(secondHash));
    // encode sig
    return encodeSig(sig.signature, global_vars_1.GLOBAL_VARS.HASH_TYPE);
}
exports.signp2pkhWith = signp2pkhWith;
function p2pkhScriptSig(sig, pubkey) {
    return bitcoinjs.script.compile([sig, Buffer.from(pubkey, 'hex')]);
}
exports.p2pkhScriptSig = p2pkhScriptSig;
// Refer to:
// https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/src/payments/p2pkh.js#L58
function p2pkhScript(hash160PubKey) {
    return bitcoinjs.script.compile([
        opcodes_1.OPS.OP_DUP,
        opcodes_1.OPS.OP_HASH160,
        hash160PubKey,
        opcodes_1.OPS.OP_EQUALVERIFY,
        opcodes_1.OPS.OP_CHECKSIG
    ]);
}
exports.p2pkhScript = p2pkhScript;
function contractTxScript(contractAddress, gasLimit, gasPrice, encodedData) {
    // If contractAddress is missing, assume it's a create script, else assume its a call contract interaction
    if (contractAddress === "") {
        return bitcoinjs.script.compile([
            opcodes_1.OPS.OP_4,
            script_number_1.encode(gasLimit),
            script_number_1.encode(gasPrice),
            Buffer.from(encodedData, "hex"),
            opcodes_1.OPS.OP_CREATE,
        ]);
    }
    else {
        return bitcoinjs.script.compile([
            opcodes_1.OPS.OP_4,
            script_number_1.encode(gasLimit),
            script_number_1.encode(gasPrice),
            Buffer.from(encodedData, "hex"),
            Buffer.from(contractAddress, "hex"),
            opcodes_1.OPS.OP_CALL,
        ]);
    }
}
exports.contractTxScript = contractTxScript;
function reverse(src) {
    let buffer = Buffer.alloc(src.length);
    for (var i = 0, j = src.length - 1; i <= j; ++i, --j) {
        buffer[i] = src[j];
        buffer[j] = src[i];
    }
    return buffer;
}
function generateContractAddress(txid) {
    let buffer = Buffer.alloc(32 + 4);
    let cursor = new buffer_cursor_1.BufferCursor(buffer);
    cursor.writeBytes(reverse(Buffer.from(txid, "hex")));
    // Assuming vout index is 0 as the transaction is serialized with that assumption.
    cursor.writeUInt32LE(0);
    let firstHash = hash_js_1.sha256().update(buffer.toString("hex"), "hex").digest("hex");
    let secondHash = hash_js_1.ripemd160().update(firstHash, "hex").digest("hex");
    return secondHash;
}
exports.generateContractAddress = generateContractAddress;
function addVins(utxos, neededAmount, hash160PubKey) {
    let balance = 0.0;
    let inputs = [];
    let amounts = [];
    for (let i = 0; i < utxos.length; i++) {
        // investigate issue where amount has no decimal point as calculation panics
        let x = parseFloat(utxos[i].amount).toFixed(7);
        balance += parseFloat(x);
        inputs.push({ txid: Buffer.from(utxos[i].txid, 'hex'), vout: utxos[i].vout, hash: reverse(Buffer.from(utxos[i].txid, 'hex')), sequence: 0xffffffff, script: p2pkhScript(Buffer.from(hash160PubKey, "hex")), scriptSig: null });
        amounts.push(parseFloat(x));
        if (new bignumber_js_1.BigNumber(neededAmount).isLessThanOrEqualTo(balance)) {
            break;
        }
    }
    return [inputs, amounts];
}
exports.addVins = addVins;
function addContractVouts(gasPrice, gasLimit, data, address, amounts, value, hash160PubKey, vins) {
    let vouts = [];
    const returnAmount = amounts.reduce((a, b) => a + b);
    const networkFee = new bignumber_js_1.BigNumber(calcTxBytesToEstimateFee(vins, [contractTxScript(address === "" ? "" : address.split("0x")[1], gasLimit, gasPrice, data.split("0x")[1]), p2pkhScript(Buffer.from(hash160PubKey, "hex"))]).toString() + `e-3`).times(0.004).toFixed(7);
    const gas = new bignumber_js_1.BigNumber(new bignumber_js_1.BigNumber(gasPrice + `e-8`).toFixed(7)).times(gasLimit).toFixed(7);
    vouts.push({
        script: contractTxScript(address === "" ? "" : address.split("0x")[1], gasLimit, gasPrice, data.split("0x")[1]),
        value: new bignumber_js_1.BigNumber(value).times(1e8).toNumber()
    });
    // if spending amounts === amounts needed for gas/value/network fee, do not add a change vout
    if (new bignumber_js_1.BigNumber(returnAmount).isGreaterThan(new bignumber_js_1.BigNumber(gas).plus(networkFee).plus(value))) {
        vouts.push({
            script: p2pkhScript(Buffer.from(hash160PubKey, "hex")),
            value: new bignumber_js_1.BigNumber(returnAmount).minus(gas).minus(value).minus(networkFee).times(1e8).toNumber()
        });
        return vouts;
    }
    // call qtum_getUTXOs to see if the account has enough to spend with the networkFee and some (for adding more inputs, it costs $$$!) taken into account
    else if (new bignumber_js_1.BigNumber(returnAmount).isLessThan(new bignumber_js_1.BigNumber(gas).plus(networkFee).plus(value))) {
        return new bignumber_js_1.BigNumber(networkFee).plus(0.0019400).toFixed(7);
    }
    else {
        return vouts;
    }
}
exports.addContractVouts = addContractVouts;
function addp2pkhVouts(hash160Address, amounts, value, hash160PubKey, vins) {
    let vouts = [];
    const returnAmount = amounts.reduce((a, b) => a + b);
    const networkFee = new bignumber_js_1.BigNumber(calcTxBytesToEstimateFee(vins, [p2pkhScript(Buffer.from(hash160Address, "hex")), p2pkhScript(Buffer.from(hash160PubKey, "hex"))]).toString() + `e-3`).times(0.004).toFixed(7);
    vouts.push({
        script: p2pkhScript(Buffer.from(hash160Address, "hex")),
        value: new bignumber_js_1.BigNumber(value).times(1e8).toNumber()
    });
    if (new bignumber_js_1.BigNumber(returnAmount).isGreaterThan(new bignumber_js_1.BigNumber(value).plus(networkFee))) {
        vouts.push({
            script: p2pkhScript(Buffer.from(hash160PubKey, "hex")),
            value: new bignumber_js_1.BigNumber(returnAmount).minus(value).minus(networkFee).times(1e8).toNumber()
        });
        return vouts;
    }
    // call qtum_getUTXOs to see if the account has enough to spend with the networkFee and some (for adding more inputs, it costs $$$!) taken into account
    else if (new bignumber_js_1.BigNumber(returnAmount).isLessThan(new bignumber_js_1.BigNumber(networkFee).plus(networkFee).plus(value))) {
        return new bignumber_js_1.BigNumber(networkFee).plus(0.0019400).toFixed(7);
    }
    else {
        return vouts;
    }
}
exports.addp2pkhVouts = addp2pkhVouts;
function parseSignedTransaction(transaction) {
    let tx = {
        hash: "",
        to: "",
        from: "",
        nonce: 1,
        gasLimit: ethers_1.BigNumber.from("0x3d090"),
        gasPrice: ethers_1.BigNumber.from("0x28"),
        data: "",
        value: ethers_1.BigNumber.from("0x0"),
        chainId: 81,
    };
    // Set hash (double sha256 of raw TX string)
    const sha256HashFirst = hash_js_1.sha256().update(transaction, "hex").digest("hex");
    const sha256HashSecond = reverse(Buffer.from(hash_js_1.sha256().update(sha256HashFirst, "hex").digest("hex"), "hex")).toString("hex");
    tx['hash'] = `0x${sha256HashSecond}`;
    const btcDecodedRawTx = hex_decoder_1.decode(transaction);
    // Check if first OP code is OP_DUP -> assume p2pkh script
    if (bitcoinjs.script.decompile(btcDecodedRawTx.outs[global_vars_1.GLOBAL_VARS.UTXO_VINDEX].script)[0] === opcodes_1.OPS.OP_DUP) {
        tx['to'] = `0x${bitcoinjs.script.decompile(btcDecodedRawTx.outs[global_vars_1.GLOBAL_VARS.UTXO_VINDEX].script)[2].toString("hex")}`;
        // If there is no change output, which is currently being used to identify the sender, how else can we find out the from address?
        tx['from'] = btcDecodedRawTx.outs.length > 1 ? `0x${bitcoinjs.script.decompile(btcDecodedRawTx.outs[1].script)[2].toString("hex")}` : "";
        tx['value'] = ethers_1.BigNumber.from(utils_1.hexlify(btcDecodedRawTx.outs[global_vars_1.GLOBAL_VARS.UTXO_VINDEX].value));
    }
    // Check if first OP code is OP_4 and length is > 5 -> assume contract call
    else if (bitcoinjs.script.decompile(btcDecodedRawTx.outs[global_vars_1.GLOBAL_VARS.UTXO_VINDEX].script)[0] === opcodes_1.OPS.OP_4 && bitcoinjs.script.decompile(btcDecodedRawTx.outs[global_vars_1.GLOBAL_VARS.UTXO_VINDEX].script).length > 5) {
        tx['to'] = `0x${bitcoinjs.script.decompile(btcDecodedRawTx.outs[global_vars_1.GLOBAL_VARS.UTXO_VINDEX].script)[4].toString("hex")}`;
        // If there is no change output, which is currently being used to identify the sender, how else can we find out the from address?
        tx['from'] = btcDecodedRawTx.outs.length > 1 ? `0x${bitcoinjs.script.decompile(btcDecodedRawTx.outs[1].script)[2].toString("hex")}` : "";
        tx['value'] = btcDecodedRawTx.outs[global_vars_1.GLOBAL_VARS.UTXO_VINDEX].value > 0 ? ethers_1.BigNumber.from(utils_1.hexlify(btcDecodedRawTx.outs[global_vars_1.GLOBAL_VARS.UTXO_VINDEX].value)) : ethers_1.BigNumber.from("0x0");
        tx['data'] = bitcoinjs.script.decompile(btcDecodedRawTx.outs[global_vars_1.GLOBAL_VARS.UTXO_VINDEX].script)[3].toString("hex");
        tx['value'] = ethers_1.BigNumber.from(utils_1.hexlify(btcDecodedRawTx.outs[global_vars_1.GLOBAL_VARS.UTXO_VINDEX].value)).toNumber() === 0 ? ethers_1.BigNumber.from("0x0") : ethers_1.BigNumber.from(utils_1.hexlify(btcDecodedRawTx.outs[global_vars_1.GLOBAL_VARS.UTXO_VINDEX].value));
    }
    // assume contract creation
    else {
        tx['to'] = "";
        // If there is no change output, which is currently being used to identify the sender, how else can we find out the from address?
        tx['from'] = btcDecodedRawTx.outs.length > 1 ? `0x${bitcoinjs.script.decompile(btcDecodedRawTx.outs[1].script)[2].toString("hex")}` : "";
        tx['gasLimit'] = ethers_1.BigNumber.from(utils_1.hexlify(script_number_1.decode(bitcoinjs.script.decompile(btcDecodedRawTx.outs[0].script)[1])));
        tx['gasPrice'] = ethers_1.BigNumber.from(utils_1.hexlify(script_number_1.decode(bitcoinjs.script.decompile(btcDecodedRawTx.outs[0].script)[2])));
        tx['data'] = bitcoinjs.script.decompile(btcDecodedRawTx.outs[0].script)[3].toString("hex");
    }
    return tx;
}
exports.parseSignedTransaction = parseSignedTransaction;
function computeAddress(key) {
    const publicKey = signing_key_1.computePublicKey(key);
    return computeAddressFromPublicKey(publicKey);
}
exports.computeAddress = computeAddress;
function computeAddressFromPublicKey(publicKey) {
    if (!publicKey.startsWith("0x")) {
        publicKey = "0x" + publicKey;
    }
    const sha256Hash = hash_js_1.sha256().update(publicKey.split("0x")[1], "hex").digest("hex");
    const prefixlessAddress = hash_js_1.ripemd160().update(sha256Hash, "hex").digest("hex");
    return `0x${prefixlessAddress}`;
}
exports.computeAddressFromPublicKey = computeAddressFromPublicKey;
function checkTransactionType(tx) {
    if (!!tx.to === false && (!!tx.value === false || ethers_1.BigNumber.from(tx.value).toNumber() === 0) && !!tx.data === true) {
        const needed = new bignumber_js_1.BigNumber(ethers_1.BigNumber.from(tx.gasPrice).toString() + `e-8`).times(ethers_1.BigNumber.from(tx.gasLimit).toNumber()).toFixed(7).toString();
        return { transactionType: global_vars_1.GLOBAL_VARS.CONTRACT_CREATION, neededAmount: needed };
    }
    else if (!!tx.to === false && ethers_1.BigNumber.from(tx.value).toNumber() > 0 && !!tx.data === true) {
        return { transactionType: global_vars_1.GLOBAL_VARS.DEPLOY_ERROR, neededAmount: "0" };
    }
    else if (!!tx.to === true && !!tx.data === true) {
        const needed = !!tx.value === true ? new bignumber_js_1.BigNumber(new bignumber_js_1.BigNumber(ethers_1.BigNumber.from(tx.gasPrice).toString() + `e-8`).toFixed(7)).times(ethers_1.BigNumber.from(tx.gasLimit).toNumber()).plus(ethers_1.BigNumber.from(tx.value).toString() + `e-8`).toFixed(7) : new bignumber_js_1.BigNumber(new bignumber_js_1.BigNumber(ethers_1.BigNumber.from(tx.gasPrice).toString() + `e-8`).toFixed(7)).times(ethers_1.BigNumber.from(tx.gasLimit).toNumber()).toFixed(7);
        return { transactionType: global_vars_1.GLOBAL_VARS.CONTRACT_CALL, neededAmount: needed };
    }
    else {
        const needed = new bignumber_js_1.BigNumber(ethers_1.BigNumber.from(tx.value).toString() + `e-8`).toFixed(7);
        return { transactionType: global_vars_1.GLOBAL_VARS.P2PKH, neededAmount: needed };
    }
}
exports.checkTransactionType = checkTransactionType;
async function serializeTransaction(utxos, neededAmount, tx, transactionType, privateKey, publicKey) {
    const signer = (hash) => {
        return secp256k1Sign(hash, utils_1.arrayify(privateKey));
    };
    return await serializeTransactionWith(utxos, neededAmount, tx, transactionType, signer, publicKey);
}
exports.serializeTransaction = serializeTransaction;
async function serializeTransactionWith(utxos, neededAmount, tx, transactionType, signer, publicKey) {
    // Building the QTUM tx that will eventually be serialized.
    let qtumTx = { version: 2, locktime: 0, vins: [], vouts: [] };
    // @ts-ignore
    const [vins, amounts] = addVins(utxos, neededAmount, tx.from.split("0x")[1]);
    qtumTx.vins = vins;
    if (transactionType !== 3) {
        if (transactionType === 2) {
            // @ts-ignore
            let localVouts = addContractVouts(ethers_1.BigNumber.from(tx.gasPrice).toNumber(), ethers_1.BigNumber.from(tx.gasLimit).toNumber(), tx.data, "", amounts, new bignumber_js_1.BigNumber(ethers_1.BigNumber.from("0x0").toNumber() + `e-8`).toFixed(7), tx.from.split("0x")[1], qtumTx.vins);
            if (typeof localVouts === 'string') {
                return { serializedTransaction: "", networkFee: localVouts };
            }
            qtumTx.vouts = localVouts;
        }
        else {
            // @ts-ignore
            let localVouts = addContractVouts(ethers_1.BigNumber.from(tx.gasPrice).toNumber(), ethers_1.BigNumber.from(tx.gasLimit).toNumber(), tx.data, tx.to, amounts, !!tx.value === true ? new bignumber_js_1.BigNumber(ethers_1.BigNumber.from(tx.value).toNumber() + `e-8`).toNumber() : new bignumber_js_1.BigNumber(ethers_1.BigNumber.from("0x0").toNumber() + `e-8`).toFixed(7), tx.from.split("0x")[1], qtumTx.vins);
            if (typeof localVouts === 'string') {
                return { serializedTransaction: "", networkFee: localVouts };
            }
            qtumTx.vouts = localVouts;
        }
        // Sign necessary vins
        const updatedVins = [];
        for (let i = 0; i < qtumTx.vins.length; i++) {
            updatedVins.push(Object.assign(Object.assign({}, qtumTx.vins[i]), { ['scriptSig']: p2pkhScriptSig(await signp2pkhWith(qtumTx, i, signer), publicKey.split("0x")[1]) }));
        }
        qtumTx.vins = updatedVins;
        // Build the serialized transaction string.
        const serialized = txToBuffer(qtumTx).toString('hex');
        return { serializedTransaction: serialized, networkFee: "" };
    }
    else {
        // @ts-ignore
        let localVouts = addp2pkhVouts(tx.to.split("0x")[1], amounts, new bignumber_js_1.BigNumber(ethers_1.BigNumber.from(tx.value).toNumber() + `e-8`).toFixed(7), tx.from.split("0x")[1], qtumTx.vins);
        if (typeof localVouts === 'string') {
            return { serializedTransaction: "", networkFee: localVouts };
        }
        else {
            qtumTx.vouts = localVouts;
            // Sign necessary vins
            const updatedVins = [];
            for (let i = 0; i < qtumTx.vins.length; i++) {
                updatedVins.push(Object.assign(Object.assign({}, qtumTx.vins[i]), { ['scriptSig']: p2pkhScriptSig(await signp2pkhWith(qtumTx, i, signer), publicKey.split("0x")[1]) }));
            }
            qtumTx.vins = updatedVins;
            // Build the serialized transaction string.
            const serialized = txToBuffer(qtumTx).toString('hex');
            return { serializedTransaction: serialized, networkFee: "" };
        }
    }
}
exports.serializeTransactionWith = serializeTransactionWith;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvbGliL2hlbHBlcnMvdXRpbHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEscURBQTBFO0FBQzFFLGlDQUErQjtBQUMvQix1Q0FBZ0M7QUFDaEMsK0NBQTRDO0FBQzVDLG1EQUErQztBQUMvQyxZQUFZO0FBQ1oseUNBQTRDO0FBQzVDLElBQUksYUFBYSxHQUFHLHFCQUFTLENBQUE7QUFDN0IsSUFBSSxDQUFDLHFCQUFTLElBQUksZ0JBQUksRUFBRTtJQUNwQix5REFBeUQ7SUFDekQsWUFBWTtJQUNaLGFBQWEsR0FBRyxVQUFTLE1BQU0sRUFBRSxVQUFVO1FBQ3ZDLHVFQUF1RTtRQUN2RSxZQUFZO1FBQ1osTUFBTSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUM7UUFDeEIsWUFBWTtRQUNaLFVBQVUsQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDO1FBQzVCLE9BQU8sZ0JBQUksQ0FBQyxNQUFNLEVBQUUsVUFBVSxDQUFDLENBQUM7SUFDcEMsQ0FBQyxDQUFBO0NBQ0o7QUFDRCxtRUFBNEY7QUFDNUYscUNBQTJDO0FBQzNDLCtDQUF3QztBQUN4Qyw0Q0FJMEI7QUFFMUIsbUNBQXNEO0FBQ3RELCtDQUF1QztBQUN2Qyw0REFBOEQ7QUFHOUQsTUFBTSxRQUFRLEdBQUcsT0FBTyxDQUFDLHNCQUFzQixDQUFDLENBQUE7QUFDaEQsTUFBTSxTQUFTLEdBQUcsT0FBTyxDQUFDLGVBQWUsQ0FBQyxDQUFDO0FBRTNDLDBFQUEwRTtBQUMxRTtJQUNJLG1CQUFtQjtJQUNuQixhQUFhO0lBQ2IsVUFBVTtDQUNiLENBQUMsT0FBTyxDQUFDLENBQUMsVUFBVSxFQUFFLEVBQUU7SUFDckIsd0VBQXdFO0lBQ3hFLE1BQU0sRUFBRSxHQUFHLElBQUksR0FBRyxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLFdBQVcsRUFBRSxHQUFHLFVBQVUsQ0FBQyxLQUFLLENB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Q0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztJQUNyRCxNQUFNLFVBQVUsR0FBRyxJQUFJLHdCQUFTLENBQUMsd0JBQXdCLENBQUMsSUFBSSxFQUFFLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsY0FBYyxFQUFFLEtBQUssQ0FBQyxDQUFDLEVBQUUsV0FBVyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsYUFBYSxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsRUFBRSxHQUFHLEtBQUssQ0FBQyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDL00sS0FBSyxDQUFDLElBQUksQ0FBQztRQUNQLE1BQU0sRUFBRSxXQUFXLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxjQUFjLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDdkQsS0FBSyxFQUFFLElBQUksd0JBQVMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsUUFBUSxFQUFFO0tBQ3BELENBQUMsQ0FBQztJQUNILElBQUksSUFBSSx3QkFBUyxDQUFDLFlBQVksQ0FBQyxDQUFDLGFBQWEsQ0FBQyxJQUFJLHdCQUFTLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDLEVBQUU7UUFDbEYsS0FBSyxDQUFDLElBQUksQ0FBQztZQUNQLE1BQU0sRUFBRSxXQUFXLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxhQUFhLEVBQUUsS0FBSyxDQUFDLENBQUM7WUFDdEQsS0FBSyxFQUFFLElBQUksd0JBQVMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsS0FBSyxDQUFDLFVBQVUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxRQUFRLEVBQUU7U0FDMUYsQ0FBQyxDQUFBO1FBQ0YsT0FBTyxL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