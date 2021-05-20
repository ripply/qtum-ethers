"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.serializeTransaction = exports.checkTransactionType = exports.computeAddress = exports.parseSignedTransaction = exports.addp2pkhVouts = exports.addContractVouts = exports.addVins = exports.generateContractAddress = exports.reverse = exports.contractTxScript = exports.p2pkhScript = exports.p2pkhScriptSig = exports.signp2pkh = exports.encodeSig = exports.toDER = exports.txToBuffer = exports.calcTxBytesToEstimateFee = exports.calcTxBytes = void 0;
const varuint_bitcoin_1 = require("varuint-bitcoin");
const bip66_1 = require("bip66");
const opcodes_1 = require("./opcodes");
const global_vars_1 = require("./global-vars");
const buffer_cursor_1 = require("./buffer-cursor");
const secp256k1_1 = require("secp256k1");
const script_number_1 = require("bitcoinjs-lib/src/script_number");
const hash_js_1 = require("hash.js");
const bignumber_js_1 = require("bignumber.js");
const utils_1 = require("ethers/lib/utils");
const ethers_1 = require("ethers");
const hex_decoder_1 = require("./hex-decoder");
const signing_key_1 = require("@ethersproject/signing-key");
const toBuffer = require('typedarray-to-buffer');
const bitcoinjs = require("bitcoinjs-lib");
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
function inputBytes(input) {
    return global_vars_1.GLOBAL_VARS.TX_INPUT_BASE + (input.scriptSig ? input.scriptSig.byteLength : input.script.byteLength);
}
function outputBytes(output) {
    return global_vars_1.GLOBAL_VARS.TX_OUTPUT_BASE + (output.script ? output.script.byteLength : global_vars_1.GLOBAL_VARS.TX_OUTPUT_PUBKEYHASH);
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
        vins.reduce(function (a, x) { return a + inputBytesToEstimateFee(); }, 0) +
        vouts.reduce(function (a, x) { return a + outputBytesToEstimateFee(x); }, 0);
}
exports.calcTxBytesToEstimateFee = calcTxBytesToEstimateFee;
// Argument here would be irrelevant considering the assumption that all vins are p2pkh
function inputBytesToEstimateFee() {
    return global_vars_1.GLOBAL_VARS.TX_INPUT_BASE + 139;
}
function outputBytesToEstimateFee(script) {
    return global_vars_1.GLOBAL_VARS.TX_OUTPUT_BASE + script.byteLength;
}
function txToBuffer(tx) {
    // +2 on certain contracts?
    let neededBytes = calcTxBytes(tx.vins, tx.vouts);
    console.log(neededBytes, 'neededBuffer');
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
exports.toDER = toDER;
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
exports.encodeSig = encodeSig;
/////////////////////////////////////////
function signp2pkh(tx, vindex, privKey) {
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
    let sig = secp256k1_1.ecdsaSign(new Uint8Array(secondHash), utils_1.arrayify(privKey));
    // encode sig
    return encodeSig(sig.signature, global_vars_1.GLOBAL_VARS.HASH_TYPE);
}
exports.signp2pkh = signp2pkh;
function p2pkhScriptSig(sig, pubkey) {
    return bitcoinjs.script.compile([sig, Buffer.from(pubkey, 'hex')]);
}
exports.p2pkhScriptSig = p2pkhScriptSig;
// Refer to:
// https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/src/payments/p2pkh.js#L58
function p2pkhScript(hash160PubKey) {
    // prettier-ignore
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
exports.reverse = reverse;
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
        // issue with this txid -> cd159803a85f0b2076a8beb5710b2a42a15d9a905f49a7c1ab4427d51e7cd4e3
        let x = parseFloat(utxos[i].amount).toFixed(7);
        // if (x % 1 == 0 ) {
        //    let y = parseInt(x)
        //    x = y.toFixed(7)
        // }
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
    // call qtum_getUTXOs to see if the account has enough to spend with the networkFee taken into account
    else if (new bignumber_js_1.BigNumber(returnAmount).isLessThan(new bignumber_js_1.BigNumber(gas).plus(networkFee).plus(value))) {
        return networkFee;
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
    // call qtum_getUTXOs to see if the account has enough to spend with the networkFee taken into account
    else if (new bignumber_js_1.BigNumber(returnAmount).isLessThan(new bignumber_js_1.BigNumber(networkFee).plus(networkFee).plus(value))) {
        return networkFee;
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
    // Hacky way to find out if TX contains contract creation, call, or P2PKH (needs to be refined)
    // Check the outputs for 0 values (creation or call, count items in ASM format) - note: OP_CREATE & OP_CALL are not recognized, thus the logic for figuring out call vs contract is to 
    // count ASM items (4 for creation, OP_4, gasLimit, gasPrice, byteCode), (5 for call, OP_4, gasLimit, gasPrice, data, contractAddress)
    const btcDecodedRawTx = hex_decoder_1.decode(transaction);
    // Check if first OP code is OP_DUP -> assume p2pkh script
    if (bitcoinjs.script.decompile(btcDecodedRawTx.outs[0].script)[0] === opcodes_1.OPS.OP_DUP) {
        tx['to'] = `0x${bitcoinjs.script.decompile(btcDecodedRawTx.outs[0].script)[2].toString("hex")}`;
        // If there is no change output, which is currently being used to identify the sender, how else can we find out the from address?
        tx['from'] = btcDecodedRawTx.outs.length > 1 ? `0x${bitcoinjs.script.decompile(btcDecodedRawTx.outs[1].script)[2].toString("hex")}` : "";
        tx['value'] = ethers_1.BigNumber.from(utils_1.hexlify(btcDecodedRawTx.outs[0].value));
    }
    // Check if first OP code is OP_4 and length is > 5 -> assume contract call
    else if (bitcoinjs.script.decompile(btcDecodedRawTx.outs[0].script)[0] === opcodes_1.OPS.OP_4 && bitcoinjs.script.decompile(btcDecodedRawTx.outs[0].script).length > 5) {
        tx['to'] = `0x${bitcoinjs.script.decompile(btcDecodedRawTx.outs[0].script)[4].toString("hex")}`;
        tx['from'] = btcDecodedRawTx.outs.length > 1 ? `0x${bitcoinjs.script.decompile(btcDecodedRawTx.outs[1].script)[2].toString("hex")}` : "";
        tx['value'] = btcDecodedRawTx.outs[0].value > 0 ? ethers_1.BigNumber.from(utils_1.hexlify(btcDecodedRawTx.outs[0].value)) : ethers_1.BigNumber.from("0x0");
        tx['data'] = bitcoinjs.script.decompile(btcDecodedRawTx.outs[0].script)[3].toString("hex");
        tx['value'] = ethers_1.BigNumber.from(utils_1.hexlify(btcDecodedRawTx.outs[0].value)).toNumber() === 0 ? ethers_1.BigNumber.from("0x0") : ethers_1.BigNumber.from(utils_1.hexlify(btcDecodedRawTx.outs[0].value));
    }
    // assume contract creation
    else {
        tx['to'] = "";
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
    const sha256Hash = hash_js_1.sha256().update(publicKey.split("0x")[1], "hex").digest("hex");
    const prefixlessAddress = hash_js_1.ripemd160().update(sha256Hash, "hex").digest("hex");
    return `0x${prefixlessAddress}`;
}
exports.computeAddress = computeAddress;
function checkTransactionType(tx) {
    if (!!tx.to === false && (!!tx.value === false || ethers_1.BigNumber.from(tx.value).toNumber() === 0) && !!tx.data === true) {
        const needed = new bignumber_js_1.BigNumber(ethers_1.BigNumber.from(tx.gasPrice).toNumber().toString() + `e-8`).times(ethers_1.BigNumber.from(tx.gasLimit).toNumber()).toFixed(7).toString();
        return { transactionType: global_vars_1.GLOBAL_VARS.CONTRACT_CALL, neededAmount: needed };
    }
    else if (!!tx.to === false && ethers_1.BigNumber.from(tx.value).toNumber() > 0 && !!tx.data === true) {
        return { transactionType: global_vars_1.GLOBAL_VARS.DEPLOY_ERROR, neededAmount: "0" };
    }
    else if (!!tx.to === true && !!tx.data === true) {
        const needed = !!tx.value === true ? new bignumber_js_1.BigNumber(new bignumber_js_1.BigNumber(ethers_1.BigNumber.from(tx.gasPrice).toNumber() + `e-8`).toFixed(7)).times(ethers_1.BigNumber.from(tx.gasLimit).toNumber()).plus(ethers_1.BigNumber.from(tx.value).toNumber() + `e-8`).toFixed(7) : new bignumber_js_1.BigNumber(new bignumber_js_1.BigNumber(ethers_1.BigNumber.from(tx.gasPrice).toNumber() + `e-8`).toFixed(7)).times(ethers_1.BigNumber.from(tx.gasLimit).toNumber()).toFixed(7);
        return { transactionType: global_vars_1.GLOBAL_VARS.CONTRACT_CREATION, neededAmount: needed };
    }
    else {
        const needed = new bignumber_js_1.BigNumber(ethers_1.BigNumber.from(tx.value).toNumber() + `e-8`).toFixed(7);
        return { transactionType: global_vars_1.GLOBAL_VARS.P2PKH, neededAmount: needed };
    }
}
exports.checkTransactionType = checkTransactionType;
function serializeTransaction(utxos, neededAmount, tx, transactionType, privateKey, publicKey) {
    // Building the QTUM tx that will eventually be serialized.
    let qtumTx = { version: 2, locktime: 0, vins: [], vouts: [] };
    // @ts-ignore
    const [vins, amounts] = addVins(utxos, neededAmount, tx.from.split("0x")[1]);
    qtumTx.vins = vins;
    console.log(tx, 'tx');
    if (transactionType !== 3) {
        if (transactionType === 2) {
            let localVouts = addContractVouts(ethers_1.BigNumber.from(tx.gasPrice).toNumber(), ethers_1.BigNumber.from(tx.gasLimit).toNumber(), tx.data, "", amounts, new bignumber_js_1.BigNumber(ethers_1.BigNumber.from("0x0").toNumber() + `e-8`).toFixed(7), tx.from.split("0x")[1], qtumTx.vins);
            if (typeof localVouts === 'string') {
                return { serializedTransaction: "", networkFee: localVouts };
            }
            qtumTx.vouts = localVouts;
        }
        else {
            let localVouts = addContractVouts(ethers_1.BigNumber.from(tx.gasPrice).toNumber(), ethers_1.BigNumber.from(tx.gasLimit).toNumber(), tx.data, tx.to, amounts, !!tx.value === true ? new bignumber_js_1.BigNumber(ethers_1.BigNumber.from(tx.value).toNumber() + `e-8`).toNumber() : new bignumber_js_1.BigNumber(ethers_1.BigNumber.from("0x0").toNumber() + `e-8`).toFixed(7), tx.from.split("0x")[1], qtumTx.vins);
            if (typeof localVouts === 'string') {
                return { serializedTransaction: "", networkFee: localVouts };
            }
            qtumTx.vouts = localVouts;
        }
        // Sign necessary vins
        const updatedVins = qtumTx.vins.map((vin, index) => {
            return Object.assign(Object.assign({}, vin), { ['scriptSig']: p2pkhScriptSig(signp2pkh(qtumTx, index, privateKey), publicKey.split("0x")[1]) });
        });
        qtumTx.vins = updatedVins;
        // Build the serialized transaction string.
        const serialized = txToBuffer(qtumTx).toString('hex');
        return { serializedTransaction: serialized, networkFee: "" };
    }
    else {
        let localVouts = addp2pkhVouts(tx.to.split("0x")[1], amounts, new bignumber_js_1.BigNumber(ethers_1.BigNumber.from(tx.value).toNumber() + `e-8`).toFixed(7), tx.from.split("0x")[1], qtumTx.vins);
        if (typeof localVouts === 'string') {
            return { serializedTransaction: "", networkFee: localVouts };
        }
        else {
            qtumTx.vouts = localVouts;
            // Sign necessary vins
            const updatedVins = qtumTx.vins.map((vin, index) => {
                return Object.assign(Object.assign({}, vin), { ['scriptSig']: p2pkhScriptSig(signp2pkh(qtumTx, index, privateKey), publicKey.split("0x")[1]) });
            });
            qtumTx.vins = updatedVins;
            // Build the serialized transaction string.
            const serialized = txToBuffer(qtumTx).toString('hex');
            return { serializedTransaction: serialized, networkFee: "" };
        }
    }
}
exports.serializeTransaction = serializeTransaction;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvbGliL2hlbHBlcnMvdXRpbHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEscURBQTBFO0FBQzFFLGlDQUErQjtBQUMvQix1Q0FBZ0M7QUFDaEMsK0NBQTRDO0FBQzVDLG1EQUErQztBQUMvQyx5Q0FBc0M7QUFDdEMsbUVBQTRGO0FBQzVGLHFDQUEyQztBQUMzQywrQ0FBd0M7QUFDeEMsNENBSTBCO0FBRTFCLG1DQUFzRDtBQUN0RCwrQ0FBdUM7QUFDdkMsNERBQThEO0FBRzlELE1BQU0sUUFBUSxHQUFHLE9BQU8sQ0FBQyxzQkFBc0IsQ0FBQyxDQUFBO0FBQ2hELE1BQU0sU0FBUyxHQUFHLE9BQU8sQ0FBQyxlQUFlLENBQUMsQ0FBQztBQXFFM0MsU0FBUyxXQUFXLENBQUMsTUFBYztJQUMvQixJQUFJLE1BQU0sR0FBRyxNQUFNLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUN6QyxNQUFNLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQ3BCLE9BQU8sTUFBTSxDQUFDO0FBQ2xCLENBQUM7QUFFRCxTQUFTLE9BQU8sQ0FBQyxFQUFPO0lBQ3BCLElBQUksTUFBTSxHQUFHLEVBQUUsT0FBTyxFQUFFLEVBQUUsQ0FBQyxPQUFPLEVBQUUsUUFBUSxFQUFFLEVBQUUsQ0FBQyxRQUFRLEVBQUUsSUFBSSxFQUFPLEVBQUUsRUFBRSxLQUFLLEVBQU8sRUFBRSxFQUFFLENBQUM7SUFDM0YsS0FBSyxJQUFJLEdBQUcsSUFBSSxFQUFFLENBQUMsSUFBSSxFQUFFO1FBQ3JCLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDO1lBQ2IsSUFBSSxFQUFFLFdBQVcsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDO1lBQzNCLElBQUksRUFBRSxHQUFHLENBQUMsSUFBSTtZQUNkLElBQUksRUFBRSxXQUFXLENBQUMsR0FBRyxDQUFD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QUFDLEtBQUssU0FBUyxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFBO1FBQ3hJLEVBQUUsQ0FBQyxPQUFPLENBQUMsR0FBRyxrQkFBZSxDQUFDLElBQUksQ0FBQyxlQUFPLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFBO0tBQzdFO0lBQ0QsMkVBQTJFO1NBQ3RFLElBQUksU0FBUyxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxhQUFHLENBQUMsSUFBSSxJQUFJLFNBQVMsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRTtRQUMxSixFQUFFLENBQUMsSUFBSSxDQUFDLEdBQUcsS0FBSyxTQUFTLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFBO1FBQy9GLEVBQUUsQ0FBQyxNQUFNLENBQUMsR0FBRyxlQUFlLENBQUMsSUFBSSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssU0FBUyxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFBO1FBQ3hJLEVBQUUsQ0FBQyxPQUFPLENBQUMsR0FBRyxlQUFlLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLGtCQUFlLENBQUMsSUFBSSxDQUFDLGVBQU8sQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLGtCQUFlLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFBO1FBQzVJLEVBQUUsQ0FBQyxNQUFNLENBQUMsR0FBRyxTQUFTLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQTtRQUMxRixFQUFFLENBQUMsT0FBTyxDQUFDLEdBQUcsa0JBQWUsQ0FBQyxJQUFJLENBQUMsZUFBTyxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxRQUFRLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLGtCQUFlLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxrQkFBZSxDQUFDLElBQUksQ0FBQyxlQUFPLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFBO0tBQzNMO0lBQ0QsMkJBQTJCO1NBQ3RCO1FBQ0QsRUFBRSxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQTtRQUNiLEVBQUUsQ0FBQyxNQUFNLENBQUMsR0FBRyxlQUFlLENBQUMsSUFBSSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssU0FBUyxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxD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