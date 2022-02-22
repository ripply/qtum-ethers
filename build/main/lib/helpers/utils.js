"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.serializeTransactionWith = exports.serializeTransaction = exports.checkTransactionType = exports.computeAddressFromPublicKey = exports.computeAddress = exports.parseSignedTransaction = exports.getMinNonDustValue = exports.addVins = exports.generateContractAddress = exports.contractTxScript = exports.p2pkhScript = exports.p2pkhScriptSig = exports.signp2pkhWith = exports.signp2pkh = exports.txToBuffer = exports.calcTxBytes = void 0;
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
// const toBuffer = require('typedarray-to-buffer')
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
    return global_vars_1.GLOBAL_VARS.TX_OVERHEAD_NVERSION +
        varuint_bitcoin_1.encodingLength(vins.length) +
        vins
            .map(vin => (vin.scriptSig ? vin.scriptSig.byteLength : vin.script.byteLength))
            .reduce((sum, len) => sum + global_vars_1.GLOBAL_VARS.TX_INPUT_OUTPOINT + varuint_bitcoin_1.encodingLength(len) + len + global_vars_1.GLOBAL_VARS.TX_INPUT_NSEQUENCE, 0) +
        varuint_bitcoin_1.encodingLength(vouts.length) +
        vouts
            .map(vout => vout.script.byteLength)
            .reduce((sum, len) => sum + global_vars_1.GLOBAL_VARS.TX_OUTPUT_NVALUE + varuint_bitcoin_1.encodingLength(len) + len, 0) +
        global_vars_1.GLOBAL_VARS.TX_OVERHEAD_NLOCKTIME;
}
exports.calcTxBytes = calcTxBytes;
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
    // TODO: Implement proper handling of OP_CODESEPARATOR, this was filtering 'ab' from the script entirely preventing pubkeyhash with ab addresses from generating proper tx
    // Since all scripts are generated locally in this library, temporarily not having this implemented is OK as no scripts will have this opcode
    // let filteredPrevOutScript = clone.vins[vindex].script.filter((op: any) => op !== OPS.OP_CODESEPARATOR);
    // Uint8Array issue here
    // clone.vins[vindex].script = toBuffer(filteredPrevOutScript);
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
    // sign on next tick so we don't block UI
    await new Promise((resolve) => setImmediate(resolve));
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
const scriptMap = {
    p2pkh: p2pkhScript,
};
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
async function addVins(outputs, utxos, neededAmount, total, gasPriceString, hash160PubKey) {
    const gasPrice = ethers_1.BigNumber.from(gasPriceString);
    const totalNeeded = ethers_1.BigNumber.from(total);
    const filterDust = false;
    let inputs = [];
    let amounts = [];
    let change;
    let inputsAmount = ethers_1.BigNumber.from(0);
    const neededAmountBN = ethers_1.BigNumber.from(new bignumber_js_1.BigNumber(neededAmount + `e+8`).toString());
    for (let i = 0; i < utxos.length; i++) {
        // @ts-ignore
        utxos[i].amountNumber = parseFloat(parseFloat(utxos[i].amount).toFixed(8));
    }
    const spendableUtxos = utxos.filter((utxo) => {
        if (utxo.safe === undefined || !utxo.safe) {
            // unsafe to spend utxo
            return false;
        }
        if (filterDust) {
            // @ts-ignore
            const utxoValue = parseFloat(utxo.amountNumber + `e+8`);
            const minimumValueToNotBeDust = getMinNonDustValue(utxo, gasPrice);
            return utxoValue >= minimumValueToNotBeDust;
        }
        return true;
    });
    let vbytes = ethers_1.BigNumber.from(global_vars_1.GLOBAL_VARS.TX_OVERHEAD_BASE);
    const spendVSizeLookupMap = {
        p2pkh: ethers_1.BigNumber.from(global_vars_1.GLOBAL_VARS.TX_INPUT_BASE + global_vars_1.GLOBAL_VARS.TX_INPUT_SCRIPTSIG_P2PKH).toNumber(),
    };
    const changeType = 'p2pkh';
    const outputVSizeLookupMap = {
        p2pkh: ethers_1.BigNumber.from(global_vars_1.GLOBAL_VARS.TX_OUTPUT_BASE + global_vars_1.GLOBAL_VARS.TX_OUTPUT_SCRIPTPUBKEY_P2PKH).toNumber(),
        p2wpkh: ethers_1.BigNumber.from(global_vars_1.GLOBAL_VARS.TX_OUTPUT_BASE + global_vars_1.GLOBAL_VARS.TX_OUTPUT_SCRIPTPUBKEY_P2WPKH).toNumber(),
        p2sh2of3: ethers_1.BigNumber.from(global_vars_1.GLOBAL_VARS.TX_OUTPUT_BASE + global_vars_1.GLOBAL_VARS.TX_OUTPUT_SCRIPTPUBKEY_P2SH2OF3).toNumber(),
        p2wsh2of3: ethers_1.BigNumber.from(global_vars_1.GLOBAL_VARS.TX_OUTPUT_BASE + global_vars_1.GLOBAL_VARS.TX_OUTPUT_SCRIPTPUBKEY_P2WSH2OF3).toNumber(),
        p2tr: ethers_1.BigNumber.from(global_vars_1.GLOBAL_VARS.TX_OUTPUT_BASE + global_vars_1.GLOBAL_VARS.TX_OUTPUT_SCRIPTPUBKEY_P2TR).toNumber(),
    };
    for (let i = 0; i < outputs.length; i++) {
        const output = outputs[i];
        let outputVSize = output;
        if (typeof output === "string") {
            if (!outputVSizeLookupMap.hasOwnProperty(output.toLowerCase())) {
                throw new Error("Unsupported output script type: " + output.toLowerCase());
            }
            else {
                // @ts-ignore
                outputVSize = outputVSizeLookupMap[output.toLowerCase()];
            }
        }
        else if (output.hasOwnProperty('script') && output.hasOwnProperty('value')) {
            // longer script sizes require up to 3 vbytes to encode
            const scriptEncodingLength = varuint_bitcoin_1.encodingLength(output.script.byteLength) - 1;
            outputVSize = ethers_1.BigNumber.from(global_vars_1.GLOBAL_VARS.TX_OUTPUT_BASE + scriptEncodingLength + output.script.byteLength).toNumber();
        }
        else {
            outputVSize = ethers_1.BigNumber.from(outputVSize).toNumber();
        }
        vbytes = vbytes.add(outputVSize);
    }
    let needMoreInputs = true;
    let i = 0;
    for (i = 0; i < spendableUtxos.length; i++) {
        const spendableUtxo = spendableUtxos[i];
        // investigate issue where amount has no decimal point as calculation panics
        // @ts-ignore
        const amount = spendableUtxo.amountNumber;
        const utxoValue = parseFloat(amount + `e+8`);
        // balance += utxoValue;
        let script = Buffer.from(spendableUtxo.scriptPubKey);
        // all scripts will be p2pkh for now
        const typ = spendableUtxo.type || '';
        if (typ.toLowerCase() === "p2pkh") {
            script = p2pkhScript(Buffer.from(hash160PubKey, "hex"));
        }
        if (!spendVSizeLookupMap.hasOwnProperty(typ.toLowerCase())) {
            throw new Error("Unsupported spendable script type: " + typ.toLowerCase());
        }
        inputs.push({
            txid: Buffer.from(spendableUtxo.txid, 'hex'),
            vout: spendableUtxo.vout,
            hash: reverse(Buffer.from(spendableUtxo.txid, 'hex')),
            sequence: 0xffffffff,
            script: script,
            scriptSig: null
        });
        // @ts-ignore
        const outputVSize = spendVSizeLookupMap[typ.toLowerCase()];
        vbytes = vbytes.add(outputVSize);
        const fee = ethers_1.BigNumber.from(vbytes).mul(gasPrice);
        inputsAmount = inputsAmount.add(utxoValue);
        amounts.push(utxoValue);
        if (neededAmountBN.eq(inputsAmount)) {
            if (i === spendableUtxos.length - 1) {
                // reached end
                // have exactly the needed amount
                // spending all utxo values
                // when caller computes change, it won't generate a change address
                needMoreInputs = false;
            }
            else {
                // not sending all
                // confirm that there is enough in inputs to cover network fees
                const neededAmountPlusFees = neededAmountBN.add(fee);
                const neededAmountPlusFeesAndChange = neededAmountPlusFees.add(outputVSizeLookupMap[changeType]);
                if (inputsAmount.eq(neededAmountPlusFees)) {
                    // no change output required, matches exactly
                    needMoreInputs = false;
                }
                else if (inputsAmount.lt(neededAmountPlusFees)) {
                    // not enough to cover total to send + fees, we need another input
                }
                else if (inputsAmount.gte(neededAmountPlusFeesAndChange)) {
                    // has enough to cover with a change output
                    needMoreInputs = false;
                    change = inputsAmount.sub(neededAmountPlusFeesAndChange);
                }
                else {
                    // not enough to cover with a change output, we need another input
                }
            }
        }
        else if (neededAmountBN.lt(inputsAmount)) {
            // have enough, check that there is enough change to cover fees
            const totalNeededPlusFees = totalNeeded.add(fee);
            const totalNeededPlusFeesAndChange = totalNeededPlusFees.add(outputVSizeLookupMap[changeType]);
            if (inputsAmount.eq(totalNeededPlusFees)) {
                // no change output required, matches exactly
                needMoreInputs = false;
            }
            else if (inputsAmount.lt(totalNeededPlusFees)) {
                // not enough to cover total to send + fees, we need another input
            }
            else if (inputsAmount.gte(totalNeededPlusFeesAndChange)) {
                // has enough to cover with a change output
                needMoreInputs = false;
                change = inputsAmount.sub(totalNeededPlusFeesAndChange);
            }
            else {
                // not enough to cover with a change output, we need another input
            }
        }
        else {
            // neededAmountBN.gt(inputsAmount)
        }
        if (!needMoreInputs) {
            break;
        }
        if (i % 100 === 0) {
            // lots of UTXOs, don't block UI
            await new Promise((resolve) => setImmediate(resolve));
        }
    }
    if (needMoreInputs) {
        const missing = neededAmountBN.sub(inputsAmount).toNumber();
        throw new Error("Need " + missing + " more satoshi");
    }
    const fee = ethers_1.BigNumber.from(vbytes).mul(gasPrice);
    const availableAmount = inputsAmount.sub(fee).toNumber();
    return [inputs, amounts, availableAmount, fee, change, changeType];
}
exports.addVins = addVins;
function getMinNonDustValue(input, feePerByte) {
    // "Dust" is defined in terms of dustRelayFee,
    // which has units satoshis-per-kilobyte.
    // If you'd pay more in fees than the value of the output
    // to spend something, then we consider it dust.
    // A typical spendable non-segwit txout is 34 bytes big, and will
    // need a CTxIn of at least 148 bytes to spend:
    // so dust is a spendable txout less than
    // 182*dustRelayFee/1000 (in satoshis).
    // 546 satoshis at the default rate of 3000 sat/kB.
    // A typical spendable segwit txout is 31 bytes big, and will
    // need a CTxIn of at least 67 bytes to spend:
    // so dust is a spendable txout less than
    // 98*dustRelayFee/1000 (in satoshis).
    // 294 satoshis at the default rate of 3000 sat/kB.
    let size = 0;
    switch (input.type) {
        case "P2PKH":
            // size = 8 + encodingLength(input.scriptPubKey.length) + input.scriptPubKey.length
            size = global_vars_1.GLOBAL_VARS.TX_OUTPUT_SCRIPTPUBKEY_P2PKH;
            size += 32 + 4 + 1 + 107 + 4; // 148
            break;
        // @ts-ignore
        case "P2PK":
            // TODO: Implement support
            // size = 8 + encodingLength(input.scriptPubKey.length) + input.scriptPubKey.length
            size += 32 + 4 + 1 + 107 + 4; // 148
        // fallthrough, unsupported script type
        // @ts-ignore
        case "P2SH":
            // TODO: Implement support
            // size = 8 + encodingLength(input.scriptPubKey.length) + input.scriptPubKey.length
            size += 32 + 4 + 1 + 107 + 4; // 148
        // fallthrough, unsupported script type
        // @ts-ignore
        case "P2WH":
            // TODO: Implement support
            // size = 8 + encodingLength(input.scriptPubKey.length) + input.scriptPubKey.length
            size += 32 + 4 + 1 + (107 / global_vars_1.GLOBAL_VARS.WITNESS_SCALE_FACTOR) + 4; // 68
        // fallthrough, unsupported script type
        default:
            throw new Error("Unsupported output script type: " + input.type);
    }
    return ethers_1.BigNumber.from(feePerByte).mul(size).toNumber();
}
exports.getMinNonDustValue = getMinNonDustValue;
function checkLostPrecisionInGasPrice(gasPrice) {
    const roundedGasPrice = new bignumber_js_1.BigNumber(new bignumber_js_1.BigNumber(gasPrice + `e-8`).toFixed(8)).toNumber();
    const originalGasPrice = new bignumber_js_1.BigNumber(new bignumber_js_1.BigNumber(gasPrice + `e-8`).toFixed()).toNumber();
    if (roundedGasPrice != originalGasPrice) {
        throw new Error("Precision lost in gasPrice: " + (originalGasPrice - roundedGasPrice));
    }
}
function getContractVout(gasPrice, gasLimit, data, address, value) {
    return {
        script: contractTxScript(address === "" ? "" : address.split("0x")[1], gasLimit, gasPrice, data.split("0x")[1]),
        value: new bignumber_js_1.BigNumber(value).times(1e8).toNumber(),
    };
}
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
function computeAddress(key, compressed) {
    const publicKey = signing_key_1.computePublicKey(key, compressed);
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
        const needed = new bignumber_js_1.BigNumber(ethers_1.BigNumber.from(tx.gasPrice).toString() + `e-8`).times(ethers_1.BigNumber.from(tx.gasLimit).toNumber()).toFixed(8).toString();
        return { transactionType: global_vars_1.GLOBAL_VARS.CONTRACT_CREATION, neededAmount: needed };
    }
    else if (!!tx.to === false && ethers_1.BigNumber.from(tx.value).toNumber() > 0 && !!tx.data === true) {
        return { transactionType: global_vars_1.GLOBAL_VARS.DEPLOY_ERROR, neededAmount: "0" };
    }
    else if (!!tx.to === true && !!tx.data === true) {
        const needed = !!tx.value === true ? new bignumber_js_1.BigNumber(new bignumber_js_1.BigNumber(ethers_1.BigNumber.from(tx.gasPrice).toString() + `e-8`).toFixed(8)).times(ethers_1.BigNumber.from(tx.gasLimit).toNumber()).plus(ethers_1.BigNumber.from(tx.value).toString() + `e-8`).toFixed(8) : new bignumber_js_1.BigNumber(new bignumber_js_1.BigNumber(ethers_1.BigNumber.from(tx.gasPrice).toString() + `e-8`).toFixed(8)).times(ethers_1.BigNumber.from(tx.gasLimit).toNumber()).toFixed(8);
        return { transactionType: global_vars_1.GLOBAL_VARS.CONTRACT_CALL, neededAmount: needed };
    }
    else {
        const gas = new bignumber_js_1.BigNumber(ethers_1.BigNumber.from(tx.gasPrice).toString() + `e-9`).times(ethers_1.BigNumber.from(tx.gasLimit).toNumber());
        const needed = new bignumber_js_1.BigNumber(ethers_1.BigNumber.from(tx.value).toString() + `e-8`).plus(gas).toFixed(8);
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
function dropPrecisionLessThanOneSatoshi(wei) {
    const inWei = ethers_1.BigNumber.from(wei).toNumber();
    const inSatoshiString = new bignumber_js_1.BigNumber(inWei + `e-8`).toFixed(8);
    const inWeiStringDroppedPrecision = new bignumber_js_1.BigNumber(inSatoshiString + `e+8`).toString();
    return inWeiStringDroppedPrecision;
}
async function serializeTransactionWith(utxos, neededAmount, tx, transactionType, signer, publicKey) {
    // Building the QTUM tx that will eventually be serialized.
    let qtumTx = { version: 2, locktime: 0, vins: [], vouts: [] };
    // reduce precision in gasPrice to 1 satoshi
    tx.gasPrice = dropPrecisionLessThanOneSatoshi(ethers_1.BigNumber.from(tx.gasPrice).toString());
    const total = ethers_1.BigNumber.from(new bignumber_js_1.BigNumber(neededAmount + `e+8`).toString());
    // in ethereum, the way to send your entire balance is to solve a simple equation:
    // amount to send in wei = entire balance in wei - (gas limit * gas price)
    // in order to properly be able to spend all UTXOs we need compute
    // we need to filter outputs that are dust
    // something is considered dust
    checkLostPrecisionInGasPrice(ethers_1.BigNumber.from(tx.gasPrice).toNumber());
    const satoshiPerKb = ethers_1.BigNumber.from(tx.gasPrice).mul(10);
    const vouts = [];
    if (transactionType === global_vars_1.GLOBAL_VARS.CONTRACT_CREATION) {
        const contractCreateVout = getContractVout(ethers_1.BigNumber.from(tx.gasPrice).toNumber(), ethers_1.BigNumber.from(tx.gasLimit).toNumber(), 
        // @ts-ignore
        tx.data, "", 
        // OP_CREATE cannot send QTUM when deploying contract
        new bignumber_js_1.BigNumber(ethers_1.BigNumber.from("0x0").toNumber() + `e-8`).toFixed(8));
        vouts.push(contractCreateVout);
        qtumTx.vouts.push(contractCreateVout);
    }
    else if (transactionType === global_vars_1.GLOBAL_VARS.CONTRACT_CALL) {
        const contractVoutValue = !!tx.value === true ?
            new bignumber_js_1.BigNumber(ethers_1.BigNumber.from(tx.value).toNumber() + `e-8`).toNumber() :
            new bignumber_js_1.BigNumber(ethers_1.BigNumber.from("0x0").toNumber() + `e-8`).toFixed(8);
        const contractCallVout = getContractVout(ethers_1.BigNumber.from(tx.gasPrice).toNumber(), ethers_1.BigNumber.from(tx.gasLimit).toNumber(), 
        // @ts-ignore
        tx.data, tx.to, contractVoutValue);
        vouts.push(contractCallVout);
        qtumTx.vouts.push(contractCallVout);
    }
    else if (transactionType === global_vars_1.GLOBAL_VARS.P2PKH) {
        vouts.push('p2pkh');
    }
    else if (transactionType === global_vars_1.GLOBAL_VARS.DEPLOY_ERROR) {
        // user requested sending QTUM with OP_CREATE which will result in the QTUM being lost
        throw new Error("Cannot send QTUM to contract when deploying a contract");
    }
    else {
        throw new Error("Internal error: unknown transaction type: " + transactionType);
    }
    // @ts-ignore
    const hash160PubKey = tx.from.split("0x")[1];
    // @ts-ignore
    const [vins, amounts, availableAmount, fee, changeAmount, changeType] = await addVins(vouts, utxos, neededAmount, total.toString(), satoshiPerKb.toString(), hash160PubKey);
    if (vins.length === 0) {
        throw new Error("Couldn't find any vins");
    }
    qtumTx.vins = vins;
    if (transactionType === global_vars_1.GLOBAL_VARS.P2PKH) {
        // @ts-ignore
        const hash160Address = tx.to.split("0x")[1];
        let value;
        if (changeAmount) {
            // not using all
            value = new bignumber_js_1.BigNumber(ethers_1.BigNumber.from(tx.value).toNumber()).toNumber();
        }
        else {
            value = new bignumber_js_1.BigNumber(availableAmount).toNumber();
        }
        const p2pkhVout = {
            script: p2pkhScript(Buffer.from(hash160Address, "hex")),
            value: value
        };
        qtumTx.vouts.push(p2pkhVout);
    }
    // add change if needed
    if (changeAmount) {
        qtumTx.vouts.push({
            // @ts-ignore
            script: scriptMap[changeType](Buffer.from(hash160PubKey, "hex")),
            value: changeAmount.toNumber()
        });
    }
    // Sign necessary vins
    const updatedVins = [];
    for (let i = 0; i < qtumTx.vins.length; i++) {
        updatedVins.push(Object.assign(Object.assign({}, qtumTx.vins[i]), { ['scriptSig']: p2pkhScriptSig(await signp2pkhWith(qtumTx, i, signer), publicKey.split("0x")[1]) }));
    }
    qtumTx.vins = updatedVins;
    // Build the serialized transaction string.
    const serialized = txToBuffer(qtumTx).toString('hex');
    return serialized;
}
exports.serializeTransactionWith = serializeTransactionWith;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvbGliL2hlbHBlcnMvdXRpbHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEscURBQTBFO0FBQzFFLGlDQUErQjtBQUMvQix1Q0FBZ0M7QUFDaEMsK0NBQTRDO0FBQzVDLG1EQUErQztBQUMvQyxZQUFZO0FBQ1oseUNBQTRDO0FBQzVDLElBQUksYUFBYSxHQUFHLHFCQUFTLENBQUE7QUFDN0IsSUFBSSxDQUFDLHFCQUFTLElBQUksZ0JBQUksRUFBRTtJQUNwQix5REFBeUQ7SUFDekQsWUFBWTtJQUNaLGFBQWEsR0FBRyxVQUFTLE1BQU0sRUFBRSxVQUFVO1FBQ3ZDLHVFQUF1RTtRQUN2RSxZQUFZO1FBQ1osTUFBTSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUM7UUFDeEIsWUFBWTtRQUNaLFVBQVUsQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDO1FBQzVCLE9BQU8sZ0JBQUksQ0FBQyxNQUFNLEVBQUUsVUFBVSxDQUFDLENBQUM7SUFDcEMsQ0FBQyxDQUFBO0NBQ0o7QUFDRCxtRUFBNEY7QUFDNUYscUNBQTJDO0FBQzNDLCtDQUF3QztBQUN4Qyw0Q0FJMEI7QUFFMUIsbUNBQW9FO0FBQ3BFLCtDQUF1QztBQUN2Qyw0REFBOEQ7QUFHOUQsbURBQW1EO0FBQ25ELE1BQU0sU0FBUyxHQUFHLE9BQU8sQ0FBQyxlQUFlLENBQUMsQ0FBQztBQUUzQywwRUFBMEU7QUFDMUU7SUFDSSxtQkFBbUI7SUFDbkIsYUFBYTtJQUNiLFVBQVU7Q0FDYixDQUFDLE9BQU8sQ0FBQyxDQUFDLFVBQVUsRUFBRSxFQUFFO0lBQ3JCLHdFQUF3RTtJQUN4RSxNQUFNLEVBQUUsR0FBRyxJQUFJLEdBQUcsVUFBVSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxXQUFXLEVBQUUsR0FBRyxVQUFVLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQzNFLGFBQWE7SUFDYixJQUFJLENBQUMsd0JBQVMsQ0FBQyxTQUFTLENBQUMsRUFBRSxDQUFDLElBQUksd0JBQVMsQ0FBQyxTQUFTLENBQUMsVUFBVSxDQUFDLEVBQUU7UUFDN0QsYUFBYTtRQUNiLHdCQUFTLENBQUMsU0FBUyxDQUFDLEVBQUUsQ0FBQyxHQUFHLHdCQUFTLENBQUMsU0FBUyxDQUFDLFVBQVUsQ0FBQyxDQUFDO0tBQzdEO0FBQ0wsQ0FBQyxDQUFDLENBQUE7QUFrRUYsU0FBUyxXQUFXLENBQUMsTUFBYztJQUMvQixJQUFJLE1BQU0sR0FBRyxNQUFNLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUN6QyxNQUFNLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQ3BCLE9BQU8sTUFBTSxDQUFDO0FBQ2xCLENBQUM7QUFFRCxTQUFTLE9BQU8sQ0FBQyxFQUFPO0lBQ3BCLElBQUksTUFBTSxHQUFHLEVBQUUsT0FBTyxFQUFFLEVBQUUsQ0FBQyxPQUFPLEVBQUUsUUFBUSxFQUFFLEVBQUUsQ0FBQyxRQUFRLEVBQUUsSUFBSSxFQUFPLEVBQUUsRUFBRSxLQUFLLEVBQU8sRUFBRSxFQUFFLENBQUM7SUFDM0YsS0FBSyxJQUFJLEdBQUcsSUFBSSxFQUFFLENBQUMsSUFBSSxFQUFFO1FBQ3JCLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDO1lBQ2IsSUFBSSxFQUFFLFdBQVcsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDO1lBQzNCLElBQUksRUFBRSxHQUFHLENBQUMsSUFBSTtZQUNkLElBQUksRUFBRSxXQUFXLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQztZQUMzQixRQUFRLEVBQUUsR0FBRyxDQUFDLFFBQVE7WUFDdEIsTUFBTSxFQUFFLFdBQVcsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDO1lBQy9CLFNBQVMsRUFBRSxJQUFJO1NBQ2xCLENBQUMsQ0FBQztLQUNOO0lBQ0QsS0FBSyxJQUFJLElBQUksSUFBSSxFQUFFLENBQUMsS0FBSyxFQUFFO1FBQ3ZCLE1BQU0sQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDO1lBQ2QsTUFBTSxFQUFFLFdBQVcsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDO1lBQ2hDLEtBQUssRUFBRSxJQUFJLENBQUMsS0FBSztTQUNwQixDQUFDLENBQUM7S0FDTjtJQUNELE9BQU8sTUFBTSxDQUFDO0FBQ2xCLENBQUM7QUFFRCwrR0FBK0c7QUFDL0csU0FBZ0IsV0FBVyxDQUFDLElBQStELEVBQUUsS0FBb0I7SUFDN0csT0FBTyx5QkFBVyxDQUFDLG9CQUFvQjtRQUNuQyxnQ0FBYyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUM7UUFDM0IsSUFBSTthQUNDLEdBQUcsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsVUFBVSxDQUFDLENBQUM7YUFDOUUsTUFBTSxDQUFDLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsR0FBRyxHQUFHLHlCQUFXLENBQUMsaUJBQWlCLEdBQUcsZ0NBQWMsQ0FBQyxHQUFHLENBQUMsR0FBRyxHQUFHLEdBQUcseUJBQVcsQ0FBQyxrQkFBa0IsRUFBRSxDQUFDLENBQUM7UUFDOUgsZ0NBQWMsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDO1FBQzVCLEtBQUs7YUFDQSxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQzthQUNuQyxNQUFNLENBQUMsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxHQUFHLEdBQUcseUJBQVcsQ0FBQyxnQkFBZ0IsR0FBRyxnQ0FBYyxDQUFDLEdBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRSxDQUFDLENBQUM7UUFDNUYseUJBQVcsQ0FBQyxxQkFBcUIsQ0FBQTtBQUN6QyxDQUFDO0FBWEQsa0NBV0M7QUFFRCxTQUFnQixVQUFVLENBQUMsRUFBTztJQUM5QixJQUFJLFdBQVcsR0FBRyxXQUFXLENBQUMsRUFBRSxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDakQsSUFBSSxNQUFNLEdBQUcsTUFBTSxDQUFDLEtBQUssQ0FBQyxXQUFXLENBQUMsQ0FBQztJQUN2QyxJQUFJLE1BQU0sR0FBRyxJQUFJLDRCQUFZLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDdEMsVUFBVTtJQUNWLE1BQU0sQ0FBQyxhQUFhLENBQUMsRUFBRSxDQUFDLE9BQU8sQ0FBQyxDQUFDO0lBQ2pDLGFBQWE7SUFDYixNQUFNLENBQUMsVUFBVSxDQUFDLHdCQUFhLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO0lBQ2pELE1BQU07SUFDTixLQUFLLElBQUksR0FBRyxJQUFJLEVBQUUsQ0FBQyxJQUFJLEVBQUU7UUFDckIsTUFBTSxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDNUIsTUFBTSxDQUFDLGFBQWEsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDL0IsSUFBSSxHQUFHLENBQUMsU0FBUyxLQUFLLElBQUksRUFBRTtZQUN4QixNQUFNLENBQUMsVUFBVSxDQUFDLHdCQUFhLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO1lBQ3ZELE1BQU0sQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxDQUFDO1NBQ3BDO2FBQU07WUFDSCxNQUFNLENBQUMsVUFBVSxDQUFDLHdCQUFhLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO1lBQ3BELE1BQU0sQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDO1NBQ2pDO1FBQ0QsTUFBTSxDQUFDLGFBQWEsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLENBQUM7S0FDdEM7SUFDRCxjQUFjO0lBQ2QsTUFBTSxDQUFDLFVBQVUsQ0FBQyx3QkFBYSxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQztJQUNsRCxRQUFRO0lBQ1IsS0FBSyxJQUFJLElBQUksSUFBSSxFQUFFLENBQUMsS0FBSyxFQUFFO1FBQ3ZCLE1BQU0sQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQ2pDLE1BQU0sQ0FBQyxVQUFVLENBQUMsd0JBQWEsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7UUFDckQsTUFBTSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7S0FDbEM7SUFDRCxXQUFXO0lBQ1gsTUFBTSxDQUFDLGFBQWEsQ0FBQyxFQUFFLENBQUMsUUFBUSxDQUFDLENBQUM7SUFDbEMsT0FBTyxNQUFNLENBQUM7QUFDbEIsQ0FBQztBQWhDRCxnQ0FnQ0M7QUFFRCwyRkFBMkY7QUFDM0YsU0FBUyxLQUFLLENBQUMsQ0FBUztJQUNwQixJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDVixPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDO1FBQUUsRUFBRSxDQUFDLENBQUM7SUFDdkIsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLE1BQU07UUFBRSxPQUFPLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDM0MsQ0FBQyxHQUFHLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDZixJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxJQUFJO1FBQUUsT0FBTyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQzFFLE9BQU8sQ0FBQyxDQUFDO0FBQ2IsQ0FBQztBQUVELDJGQUEyRjtBQUMzRixTQUFTLFNBQVMsQ0FBQyxTQUFxQixFQUFFLFFBQWdCO0lBQ3RELE1BQU0sV0FBVyxHQUFHLFFBQVEsR0FBRyxDQUFDLElBQUksQ0FBQztJQUNyQyxJQUFJLFdBQVcsSUFBSSxDQUFDLElBQUksV0FBVyxJQUFJLENBQUM7UUFBRSxNQUFNLElBQUksS0FBSyxDQUFDLG1CQUFtQixHQUFHLFFBQVEsQ0FBQyxDQUFDO0lBRTFGLE1BQU0sY0FBYyxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO0lBQy9DLE1BQU0sZUFBZSxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7SUFDL0MsTUFBTSxDQUFDLEdBQUcsS0FBSyxDQUFDLGVBQWUsQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFDOUMsTUFBTSxDQUFDLEdBQUcsS0FBSyxDQUFDLGVBQWUsQ0FBQyxLQUFLLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFFL0MsT0FBTyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsY0FBTSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxjQUFjLENBQUMsQ0FBQyxDQUFDO0FBQ3pELENBQUM7QUFHRCx5Q0FBeUM7QUFFbEMsS0FBSyxVQUFVLFNBQVMsQ0FBQyxFQUFPLEVBQUUsTUFBYyxFQUFFLE9BQWU7SUFDcEUsT0FBTyxNQUFNLGFBQWEsQ0FBQyxFQUFFLEVBQUUsTUFBTSxFQUFFLENBQUMsSUFBZ0IsRUFBRSxFQUFFO1FBQ3hELE9BQU8sYUFBYSxDQUFDLElBQUksRUFBRSxnQkFBUSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7SUFDbEQsQ0FBQyxDQUFDLENBQUM7QUFDUCxDQUFDO0FBSkQsOEJBSUM7QUFFTSxLQUFLLFVBQVUsYUFBYSxDQUFDLEVBQU8sRUFBRSxNQUFjLEVBQUUsTUFBZ0I7SUFDekUsSUFBSSxLQUFLLEdBQUcsT0FBTyxDQUFDLEVBQUUsQ0FBQyxDQUFDO0lBQ3hCLDJCQUEyQjtJQUMzQiwwS0FBMEs7SUFDMUssNklBQTZJO0lBQzdJLDBHQUEwRztJQUMxRyx3QkFBd0I7SUFDeEIsK0RBQStEO0lBQy9ELG1DQUFtQztJQUNuQyxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsS0FBSyxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUU7UUFDeEMsSUFBSSxDQUFDLEtBQUssTUFBTTtZQUFFLFNBQVM7UUFDM0IsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLEdBQUcsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztLQUMxQztJQUNELHNCQUFzQjtJQUN0QixJQUFJLE1BQU0sR0FBRyxVQUFVLENBQUMsS0FBSyxDQUFDLENBQUE7SUFDOUIsOEJBQThCO0lBQzlCLE1BQU0sR0FBRyxNQUFNLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxVQUFVLEdBQUcsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxDQUFDO0lBQ3JELHVCQUF1QjtJQUN2QixNQUFNLENBQUMsYUFBYSxDQUFDLHlCQUFXLENBQUMsU0FBUyxFQUFFLE1BQU0sQ0FBQyxVQUFVLEdBQUcsQ0FBQyxDQUFDLENBQUM7SUFFbkUsZ0JBQWdCO0lBQ2hCLElBQUksU0FBUyxHQUFHLGdCQUFNLEVBQUUsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsTUFBTSxFQUFFLENBQUM7SUFDakQsSUFBSSxVQUFVLEdBQUcsZ0JBQU0sRUFBRSxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQztJQUVyRCx5Q0FBeUM7SUFDekMsTUFBTSxJQUFJLE9BQU8sQ0FBQyxDQUFDLE9BQU8sRUFBRSxFQUFFLENBQUMsWUFBWSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7SUFFdEQsWUFBWTtJQUNaLElBQUksR0FBRyxHQUFHLE1BQU0sTUFBTSxDQUFDLElBQUksVUFBVSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUM7SUFFbkQsYUFBYTtJQUNiLE9BQU8sU0FBUyxDQUFDLEdBQUcsQ0FBQyxTQUFTLEVBQUUseUJBQVcsQ0FBQyxTQUFTLENBQUMsQ0FBQztBQUMzRCxDQUFDO0FBaENELHNDQWdDQztBQUNELFNBQWdCLGNBQWMsQ0FBQyxHQUFRLEVBQUUsTUFBVztJQUNoRCxPQUFPLFNBQVMsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsR0FBRyxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUN2RSxDQUFDO0FBRkQsd0NBRUM7QUFFRCxZQUFZO0FBQ1osbUZBQW1GO0FBQ25GLFNBQWdCLFdBQVcsQ0FBQyxhQUFxQjtJQUM3QyxPQUFPLFNBQVMsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDO1FBQzVCLGFBQUcsQ0FBQyxNQUFNO1FBQ1YsYUFBRyxDQUFDLFVBQVU7UUFDZCxhQUFhO1FBQ2IsYUFBRyxDQUFDLGNBQWM7UUFDbEIsYUFBRyxDQUFDLFdBQVc7S0FDbEIsQ0FBQyxDQUFDO0FBQ1AsQ0FBQztBQVJELGtDQVFDO0FBRUQsTUFBTSxTQUFTLEdBQUc7SUFDZCxLQUFLLEVBQUUsV0FBVztDQUNyQixDQUFBO0FBRUQsU0FBZ0IsZ0JBQWdCLENBQUMsZUFBdUIsRUFBRSxRQUFnQixFQUFFLFFBQWdCLEVBQUUsV0FBbUI7SUFDN0csMEdBQTBHO0lBQzFHLElBQUksZUFBZSxLQUFLLEVBQUUsRUFBRTtRQUN4QixPQUFPLFNBQVMsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDO1lBQzVCLGFBQUcsQ0FBQyxJQUFJO1lBQ1Isc0JBQVUsQ0FBQyxRQUFRLENBQUM7WUFDcEIsc0JBQVUsQ0FBQyxRQUFRLENBQUM7WUFDcEIsTUFBTSxDQUFDLElBQUksQ0FBQyxXQUFXLEVBQUUsS0FBSyxDQUFDO1lBQy9CLGFBQUcsQ0FBQyxTQUFTO1NBQ2hCLENBQUMsQ0FBQTtLQUNMO1NBQU07UUFDSCxPQUFPLFNBQVMsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDO1lBQzVCLGFBQUcsQ0FBQyxJQUFJO1lBQ1Isc0JBQVUsQ0FBQyxRQUFRLENBQUM7WUFDcEIsc0JBQVUsQ0FBQyxRQUFRLENBQUM7WUFDcEIsTUFBTSxDQUFDLElBQUksQ0FBQyxXQUFXLEVBQUUsS0FBSyxDQUFDO1lBQy9CLE1BQU0sQ0FBQyxJQUFJLENBQUMsZUFBZSxFQUFFLEtBQUssQ0FBQztZQUNuQyxhQUFHLENBQUMsT0FBTztTQUNkLENBQUMsQ0FBQTtLQUNMO0FBQ0wsQ0FBQztBQXBCRCw0Q0FvQkM7QUFFRCxTQUFTLE9BQU8sQ0FBQyxHQUFXO0lBQ3hCLElBQUksTUFBTSxHQUFHLE1BQU0sQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFBO0lBQ3JDLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxHQUFHLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxFQUFFLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxFQUFFO1FBQ2xELE1BQU0sQ0FBQyxDQUFDLENBQUMsR0FBRyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUE7UUFDbEIsTUFBTSxDQUFDLENBQUMsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQTtLQUNyQjtJQUNELE9BQU8sTUFBTSxDQUFBO0FBQ2pCLENBQUM7QUFFRCxTQUFnQix1QkFBdUIsQ0FBQyxJQUFZO0lBQ2hELElBQUksTUFBTSxHQUFHLE1BQU0sQ0FBQyxLQUFLLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDO0lBQ2xDLElBQUksTUFBTSxHQUFHLElBQUksNEJBQVksQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUN0QyxNQUFNLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDckQsa0ZBQWtGO0lBQ2xGLE1BQU0sQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDeEIsSUFBSSxTQUFTLEdBQUcsZ0JBQU0sRUFBRSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUM3RSxJQUFJLFVBQVUsR0FBRyxtQkFBUyxFQUFFLENBQUMsTUFBTSxDQUFDLFNBQVMsRUFBRSxLQUFLLENBQUMsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDcEUsT0FBTyxVQUFVLENBQUM7QUFDdEIsQ0FBQztBQVRELDBEQVNDO0FBRU0sS0FBSyxVQUFVLE9BQU8sQ0FBQyxPQUFtQixFQUFFLEtBQXVCLEVBQUUsWUFBb0IsRUFBRSxLQUFhLEVBQUUsY0FBc0IsRUFBRSxhQUFxQjtJQUMxSixNQUFNLFFBQVEsR0FBRyxrQkFBZSxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQztJQUN0RCxNQUFNLFdBQVcsR0FBRyxrQkFBZSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUNoRCxNQUFNLFVBQVUsR0FBRyxLQUFLLENBQUM7SUFFekIsSUFBSSxNQUFNLEdBQUcsRUFBRSxDQUFDO0lBQ2hCLElBQUksT0FBTyxHQUFHLEVBQUUsQ0FBQztJQUNqQixJQUFJLE1BQU0sQ0FBQztJQUNYLElBQUksWUFBWSxHQUFHLGtCQUFlLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQzNDLE1BQU0sY0FBYyxHQUFHLGtCQUFlLENBQUMsSUFBSSxDQUFDLElBQUksd0JBQVMsQ0FBQyxZQUFZLEdBQUcsS0FBSyxDQUFDLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQztJQUM1RixLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsS0FBSyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTtRQUNuQyxhQUFhO1FBQ2IsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLFlBQVksR0FBRyxVQUFVLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztLQUM5RTtJQUNELE1BQU0sY0FBYyxHQUFHLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLEVBQUUsRUFBRTtRQUN6QyxJQUFJLElBQUksQ0FBQyxJQUFJLEtBQUssU0FBUyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRTtZQUN2Qyx1QkFBdUI7WUFDdkIsT0FBTyxLQUFLLENBQUM7U0FDaEI7UUFDRCxJQUFJLFVBQVUsRUFBRTtZQUNaLGFBQWE7WUFDYixNQUFNLFNBQVMsR0FBRyxVQUFVLENBQUMsSUFBSSxDQUFDLFlBQVksR0FBRyxLQUFLLENBQUMsQ0FBQztZQUN4RCxNQUFNLHVCQUF1QixHQUFHLGtCQUFrQixDQUFDLElBQUksRUFBRSxRQUFRLENBQUMsQ0FBQztZQUNuRSxPQUFPLFNBQVMsSUFBSSx1QkFBdUIsQ0FBQztTQUMvQztRQUNELE9BQU8sSUFBSSxDQUFDO0lBQ2hCLENBQUMsQ0FBQyxDQUFDO0lBQ0gsSUFBSSxNQUFNLEdBQUcsa0JBQWUsQ0FBQyxJQUFJLENBQUMseUJBQVcsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO0lBQ2hFLE1BQU0sbUJBQW1CLEdBQUc7UUFDeEIsS0FBSyxFQUFFLGtCQUFlLENBQUMsSUFBSSxDQUFDLHlCQUFXLENBQUMsYUFBYSxHQUFHLHlCQUFXLENBQUMsd0JBQXdCLENBQUMsQ0FBQyxRQUFRLEVBQUU7S0FDM0csQ0FBQTtJQUNELE1BQU0sVUFBVSxHQUFHLE9BQU8sQ0FBQztJQUMzQixNQUFNLG9CQUFvQixHQUFHO1FBQ3pCLEtBQUssRUFBRSxrQkFBZSxDQUFDLElBQUksQ0FBQyx5QkFBVyxDQUFDLGNBQWMsR0FBRyx5QkFBVyxDQUFDLDRCQUE0QixDQUFDLENBQUMsUUFBUSxFQUFFO1FBQzdHLE1BQU0sRUFBRSxrQkFBZSxDQUFDLElBQUksQ0FBQyx5QkFBVyxDQUFDLGNBQWMsR0FBRyx5QkFBVyxDQUFDLDZCQUE2QixDQUFDLENBQUMsUUFBUSxFQUFFO1FBQy9HLFFBQVEsRUFBRSxrQkFBZSxDQUFDLElBQUksQ0FBQyx5QkFBVyxDQUFDLGNBQWMsR0FBRyx5QkFBVyxDQUFDLCtCQUErQixDQUFDLENBQUMsUUFBUSxFQUFFO1FBQ25ILFNBQVMsRUFBRSxrQkFBZSxDQUFDLElBQUksQ0FBQyx5QkFBVyxDQUFDLGNBQWMsR0FBRyx5QkFBVyxDQUFDLGdDQUFnQyxDQUFDLENBQUMsUUFBUSxFQUFFO1FBQ3JILElBQUksRUFBRSxrQkFBZSxDQUFDLElBQUksQ0FBQyx5QkFBVyxDQUFDLGNBQWMsR0FBRyx5QkFBVyxDQUFDLDJCQUEyQixDQUFDLENBQUMsUUFBUSxFQUFFO0tBQzlHLENBQUE7SUFDRCxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsT0FBTyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTtRQUNyQyxNQUFNLE1BQU0sR0FBRyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDMUIsSUFBSSxXQUFXLEdBQVEsTUFBTSxDQUFDO1FBQzlCLElBQUksT0FBTyxNQUFNLEtBQUssUUFBUSxFQUFFO1lBQzVCLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxjQUFjLENBQUMsTUFBTSxDQUFDLFdBQVcsRUFBRSxDQUFDLEVBQUU7Z0JBQzVELE1BQU0sSUFBSSxLQUFLLENBQUMsa0NBQWtDLEdBQUcsTUFBTSxDQUFDLFdBQVcsRUFBRSxDQUFDLENBQUM7YUFDOUU7aUJBQU07Z0JBQ0gsYUFBYTtnQkFDYixXQUFXLEdBQUcsb0JBQW9CLENBQUMsTUFBTSxDQUFDLFdBQVcsRUFBRSxDQUFDLENBQUM7YUFDNUQ7U0FDSjthQUFNLElBQUksTUFBTSxDQUFDLGNBQWMsQ0FBQyxRQUFRLENBQUMsSUFBSSxNQUFNLENBQUMsY0FBYyxDQUFDLE9BQU8sQ0FBQyxFQUFFO1lBQzFFLHVEQUF1RDtZQUN2RCxNQUFNLG9CQUFvQixHQUFHLGdDQUFjLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLENBQUM7WUFDMUUsV0FBVyxHQUFHLGtCQUFlLENBQUMsSUFBSSxDQUFDLHlCQUFXLENBQUMsY0FBYyxHQUFHLG9CQUFvQixHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUMsVUFBVSxDQUFDLENBQUMsUUFBUSxFQUFFLENBQUM7U0FDL0g7YUFBTTtZQUNILFdBQVcsR0FBRyxrQkFBZSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQyxRQUFRLEVBQUUsQ0FBQztTQUM5RDtRQUVELE1BQU0sR0FBRyxNQUFNLENBQUMsR0FBRyxDQUFDLFdBQVcsQ0FBQyxDQUFDO0tBQ3BDO0lBQ0QsSUFBSSxjQUFjLEdBQUcsSUFBSSxDQUFDO0lBQzFCLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUNWLEtBQUssQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsY0FBYyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTtRQUN4QyxNQUFNLGFBQWEsR0FBRyxjQUFjLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDeEMsNEVBQTRFO1FBQzVFLGFBQWE7UUFDYixNQUFNLE1BQU0sR0FBRyxhQUFhLENBQUMsWUFBWSxDQUFDO1FBQzFDLE1BQU0sU0FBUyxHQUFHLFVBQVUsQ0FBQyxNQUFNLEdBQUcsS0FBSyxDQUFDLENBQUM7UUFDN0Msd0JBQXdCO1FBQ3hCLElBQUksTUFBTSxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLFlBQVksQ0FBQyxDQUFDO1FBQ3JELG9DQUFvQztRQUNwQyxNQUFNLEdBQUcsR0FBVyxhQUFhLENBQUMsSUFBSSxJQUFJLEVBQUUsQ0FBQztRQUM3QyxJQUFJLEdBQUcsQ0FBQyxXQUFXLEVBQUUsS0FBSyxPQUFPLEVBQUU7WUFDL0IsTUFBTSxHQUFHLFdBQVcsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLGFBQWEsRUFBRSxLQUFLLENBQUMsQ0FBQyxDQUFDO1NBQzNEO1FBQ0QsSUFBSSxDQUFDLG1CQUFtQixDQUFDLGNBQWMsQ0FBQyxHQUFHLENBQUMsV0FBVyxFQUFFLENBQUMsRUFBRTtZQUN4RCxNQUFNLElBQUksS0FBSyxDQUFDLHFDQUFxQyxHQUFHLEdBQUcsQ0FBQyxXQUFXLEVBQUUsQ0FBQyxDQUFDO1NBQzlFO1FBQ0QsTUFBTSxDQUFDLElBQUksQ0FBQztZQUNSLElBQUksRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLEVBQUUsS0FBSyxDQUFDO1lBQzVDLElBQUksRUFBRSxhQUFhLENBQUMsSUFBSTtZQUN4QixJQUFJLEVBQUUsT0FBTyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksRUFBRSxLQUFLLENBQUMsQ0FBQztZQUNyRCxRQUFRLEVBQUUsVUFBVTtZQUNwQixNQUFNLEVBQUUsTUFBTTtZQUNkLFNBQVMsRUFBRSxJQUFJO1NBQ2xCLENBQUMsQ0FBQztRQUNILGFBQWE7UUFDYixNQUFNLFdBQVcsR0FBVyxtQkFBbUIsQ0FBQyxHQUFHLENBQUMsV0FBVyxFQUFFLENBQUMsQ0FBQztRQUNuRSxNQUFNLEdBQUcsTUFBTSxDQUFDLEdBQUcsQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUNqQyxNQUFNLEdBQUcsR0FBRyxrQkFBZSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLENBQUM7UUFFdkQsWUFBWSxHQUFHLFlBQVksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLENBQUM7UUFDM0MsT0FBTyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUV4QixJQUFJLGNBQWMsQ0FBQyxFQUFFLENBQUMsWUFBWSxDQUFDLEVBQUU7WUFDakMsSUFBSSxDQUFDLEtBQUssY0FBYyxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7Z0JBQ2pDLGNBQWM7Z0JBQ2QsaUNBQWlDO2dCQUNqQywyQkFBMkI7Z0JBQzNCLGtFQUFrRTtnQkFDbEUsY0FBYyxHQUFHLEtBQUssQ0FBQzthQUMxQjtpQkFBTTtnQkFDSCxrQkFBa0I7Z0JBQ2xCLCtEQUErRDtnQkFDL0QsTUFBTSxvQkFBb0IsR0FBRyxjQUFjLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDO2dCQUNyRCxNQUFNLDZCQUE2QixHQUFHLG9CQUFvQixDQUFDLEdBQUcsQ0FBQyxvQkFBb0IsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDO2dCQUNqRyxJQUFJLFlBQVksQ0FBQyxFQUFFLENBQUMsb0JBQW9CLENBQUMsRUFBRTtvQkFDdkMsNkNBQTZDO29CQUM3QyxjQUFjLEdBQUcsS0FBSyxDQUFDO2lCQUMxQjtxQkFBTSxJQUFJLFlBQVksQ0FBQyxFQUFFLENBQUMsb0JBQW9CLENBQUMsRUFBRTtvQkFDOUMsa0VBQWtFO2lCQUNyRTtxQkFBTSxJQUFJLFlBQVksQ0FBQyxHQUFHLENBQUMsNkJBQTZCLENBQUMsRUFBRTtvQkFDeEQsMkNBQTJDO29CQUMzQyxjQUFjLEdBQUcsS0FBSyxDQUFDO29CQUN2QixNQUFNLEdBQUcsWUFBWSxDQUFDLEdBQUcsQ0FBQyw2QkFBNkIsQ0FBQyxDQUFDO2lCQUM1RDtxQkFBTTtvQkFDSCxrRUFBa0U7aUJBQ3JFO2FBQ0o7U0FDSjthQUFNLElBQUksY0FBYyxDQUFDLEVBQUUsQ0FBQyxZQUFZLENBQUMsRUFBRTtZQUN4QywrREFBK0Q7WUFDL0QsTUFBTSxtQkFBbUIsR0FBRyxXQUFXLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1lBQ2pELE1BQU0sNEJBQTRCLEdBQUcsbUJBQW1CLENBQUMsR0FBRyxDQUFDLG9CQUFvQixDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUM7WUFDL0YsSUFBSSxZQUFZLENBQUMsRUFBRSxDQUFDLG1CQUFtQixDQUFDLEVBQUU7Z0JBQ3RDLDZDQUE2QztnQkFDN0MsY0FBYyxHQUFHLEtBQUssQ0FBQzthQUMxQjtpQkFBTSxJQUFJLFlBQVksQ0FBQyxFQUFFLENBQUMsbUJBQW1CLENBQUMsRUFBRTtnQkFDN0Msa0VBQWtFO2FBQ3JFO2lCQUFNLElBQUksWUFBWSxDQUFDLEdBQUcsQ0FBQyw0QkFBNEIsQ0FBQyxFQUFFO2dCQUN2RCwyQ0FBMkM7Z0JBQzNDLGNBQWMsR0FBRyxLQUFLLENBQUM7Z0JBQ3ZCLE1BQU0sR0FBRyxZQUFZLENBQUMsR0FBRyxDQUFDLDRCQUE0QixDQUFDLENBQUM7YUFDM0Q7aUJBQU07Z0JBQ0gsa0VBQWtFO2FBQ3JFO1NBQ0o7YUFBTTtZQUNILGtDQUFrQztTQUNyQztRQUVELElBQUksQ0FBQyxjQUFjLEVBQUU7WUFDakIsTUFBTTtTQUNUO1FBRUQsSUFBSSxDQUFDLEdBQUcsR0FBRyxLQUFLLENBQUMsRUFBRTtZQUNmLGdDQUFnQztZQUNoQyxNQUFNLElBQUksT0FBTyxDQUFDLENBQUMsT0FBTyxFQUFFLEVBQUUsQ0FBQyxZQUFZLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztTQUN6RDtLQUNKO0lBRUQsSUFBSSxjQUFjLEVBQUU7UUFDaEIsTUFBTSxPQUFPLEdBQUcsY0FBYyxDQUFDLEdBQUcsQ0FBQyxZQUFZLENBQUMsQ0FBQyxRQUFRLEVBQUUsQ0FBQTtRQUMzRCxNQUFNLElBQUksS0FBSyxDQUFDLE9BQU8sR0FBRyxPQUFPLEdBQUcsZUFBZSxDQUFDLENBQUM7S0FDeEQ7SUFFRCxNQUFNLEdBQUcsR0FBRyxrQkFBZSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLENBQUM7SUFDdkQsTUFBTSxlQUFlLEdBQUcsWUFBWSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxRQUFRLEVBQUUsQ0FBQTtJQUV4RCxPQUFPLENBQUMsTUFBTSxFQUFFLE9BQU8sRUFBRSxlQUFlLEVBQUUsR0FBRyxFQUFFLE1BQU0sRUFBRSxVQUFVLENBQUMsQ0FBQztBQUN2RSxDQUFDO0FBN0pELDBCQTZKQztBQUVELFNBQWdCLGtCQUFrQixDQUFDLEtBQWdCLEVBQUUsVUFBd0I7SUFDekUsOENBQThDO0lBQzlDLHlDQUF5QztJQUN6Qyx5REFBeUQ7SUFDekQsZ0RBQWdEO0lBQ2hELGlFQUFpRTtJQUNqRSwrQ0FBK0M7SUFDL0MseUNBQXlDO0lBQ3pDLHVDQUF1QztJQUN2QyxtREFBbUQ7SUFDbkQsNkRBQTZEO0lBQzdELDhDQUE4QztJQUM5Qyx5Q0FBeUM7SUFDekMsc0NBQXNDO0lBQ3RDLG1EQUFtRDtJQUNuRCxJQUFJLElBQUksR0FBRyxDQUFDLENBQUM7SUFDYixRQUFRLEtBQUssQ0FBQyxJQUFJLEVBQUU7UUFDaEIsS0FBSyxPQUFPO1lBQ1IsbUZBQW1GO1lBQ25GLElBQUksR0FBRyx5QkFBVyxDQUFDLDRCQUE0QixDQUFDO1lBQ2hELElBQUksSUFBSSxFQUFFLEdBQUcsQ0FBQyxHQUFHLENBQUMsR0FBRyxHQUFHLEdBQUcsQ0FBQyxDQUFDLENBQUMsTUFBTTtZQUNwQyxNQUFNO1FBQ1YsYUFBYTtRQUNiLEtBQUssTUFBTTtZQUNQLDBCQUEwQjtZQUMxQixtRkFBbUY7WUFDbkYsSUFBSSxJQUFJLEVBQUUsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLEdBQUcsR0FBRyxDQUFDLENBQUMsQ0FBQyxNQUFNO1FBQ3BDLHVDQUF1QztRQUMzQyxhQUFhO1FBQ2IsS0FBSyxNQUFNO1lBQ1AsMEJBQTBCO1lBQzFCLG1GQUFtRjtZQUNuRixJQUFJLElBQUksRUFBRSxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQyxDQUFDLE1BQU07UUFDcEMsdUNBQXVDO1FBQzNDLGFBQWE7UUFDYixLQUFLLE1BQU07WUFDUCwwQkFBMEI7WUFDMUIsbUZBQW1GO1lBQ25GLElBQUksSUFBSSxFQUFFLEdBQUcsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsR0FBRyx5QkFBVyxDQUFDLG9CQUFvQixDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsS0FBSztRQUN4RSx1Q0FBdUM7UUFDM0M7WUFDSSxNQUFNLElBQUksS0FBSyxDQUFDLGtDQUFrQyxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztLQUN4RTtJQUVELE9BQU8sa0JBQWUsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDLFFBQVEsRUFBRSxDQUFDO0FBQ2pFLENBQUM7QUE3Q0QsZ0RBNkNDO0FBRUQsU0FBUyw0QkFBNEIsQ0FBQyxRQUFnQjtJQUNsRCxNQUFNLGVBQWUsR0FBRyxJQUFJLHdCQUFTLENBQUMsSUFBSSx3QkFBUyxDQUFDLFFBQVEsR0FBRyxLQUFLLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLEVBQUUsQ0FBQztJQUM3RixNQUFNLGdCQUFnQixHQUFHLElBQUksd0JBQVMsQ0FBQyxJQUFJLHdCQUFTLENBQUMsUUFBUSxHQUFHLEtBQUssQ0FBQyxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUMsUUFBUSxFQUFFLENBQUM7SUFDN0YsSUFBSSxlQUFlLElBQUksZ0JBQWdCLEVBQUU7UUFDckMsTUFBTSxJQUFJLEtBQUssQ0FBQyw4QkFBOEIsR0FBRyxDQUFDLGdCQUFnQixHQUFHLGVBQWUsQ0FBQyxDQUFDLENBQUE7S0FDekY7QUFDTCxDQUFDO0FBRUQsU0FBUyxlQUFlLENBQUMsUUFBZ0IsRUFBRSxRQUFnQixFQUFFLElBQVksRUFBRSxPQUFlLEVBQUUsS0FBYTtJQUNyRyxPQUFPO1FBQ0gsTUFBTSxFQUFFLGdCQUFnQixDQUNwQixPQUFPLEtBQUssRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQzVDLFFBQVEsRUFDUixRQUFRLEVBQ1IsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FDdEI7UUFDRCxLQUFLLEVBQUUsSUFBSSx3QkFBUyxDQUFDLEtBQUssQ0FBQyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxRQUFRLEVBQUU7S0FDcEQsQ0FBQTtBQUNMLENBQUM7QUFFRCxTQUFnQixzQkFBc0IsQ0FBQyxXQUFtQjtJQUN0RCxJQUFJLEVBQUUsR0FBZ0I7UUFDbEIsSUFBSSxFQUFFLEVBQUU7UUFDUixFQUFFLEVBQUUsRUFBRTtRQUNOLElBQUksRUFBRSxFQUFFO1FBQ1IsS0FBSyxFQUFFLENBQUM7UUFDUixRQUFRLEVBQUUsa0JBQWUsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDO1FBQ3pDLFFBQVEsRUFBRSxrQkFBZSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUM7UUFDdEMsSUFBSSxFQUFFLEVBQUU7UUFDUixLQUFLLEVBQUUsa0JBQWUsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDO1FBQ2xDLE9BQU8sRUFBRSxFQUFFO0tBQ2QsQ0FBQztJQUNGLDRDQUE0QztJQUM1QyxNQUFNLGVBQWUsR0FBRyxnQkFBTSxFQUFFLENBQUMsTUFBTSxDQUFDLFdBQVcsRUFBRSxLQUFLLENBQUMsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUE7SUFDekUsTUFBTSxnQkFBZ0IsR0FBRyxPQUFPLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxnQkFBTSxFQUFFLENBQUMsTUFBTSxDQUFDLGVBQWUsRUFBRSxLQUFLLENBQUMsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUE7SUFDM0gsRUFBRSxDQUFDLE1BQU0sQ0FBQyxHQUFHLEtBQUssZ0JBQWdCLEVBQUUsQ0FBQTtJQUNwQyxNQUFNLGVBQWUsR0FBRyxvQkFBTSxDQUFDLFdBQVcsQ0FBQyxDQUFDO0lBQzVDLDBEQUEwRDtJQUMxRCxJQUFJLFNBQVMsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMseUJBQVcsQ0FBQyxXQUFXLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxhQUFHLENBQUMsTUFBTSxFQUFFO1FBQ3BHLEVBQUUsQ0FBQyxJQUFJLENBQUMsR0FBRyxLQUFLLFNBQVMsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMseUJBQVcsQ0FBQyxXQUFXLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQTtRQUNySCxpSUFBaUk7UUFDakksRUFBRSxDQUFDLE1BQU0sQ0FBQyxHQUFHLGVBQWUsQ0FBQyxJQUFJLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxTQUFTLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUE7UUFDeEksRUFBRSxDQUFDLE9BQU8sQ0FBQyxHQUFHLGtCQUFlLENBQUMsSUFBSSxDQUFDLGVBQU8sQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLHlCQUFXLENBQUMsV0FBVyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQTtLQUNuRztJQUNELDJFQUEyRTtTQUN0RSxJQUFJLFNBQVMsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMseUJBQVcsQ0FBQyxXQUFXLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxhQUFHLENBQUMsSUFBSSxJQUFJLFNBQVMsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMseUJBQVcsQ0FBQyxXQUFXLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO1FBQ3RNLEVBQUUsQ0FBQyxJQUFJLENBQUMsR0FBRyxLQUFLLFNBQVMsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMseUJBQVcsQ0FBQyxXQUFXLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQTtRQUNySCxpSUFBaUk7UUFDakksRUFBRSxDQUFDLE1BQU0sQ0FBQyxHQUFHLGVBQWUsQ0FBQyxJQUFJLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxTQUFTLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUE7UUFDeEksRUFBRSxDQUFDLE9BQU8sQ0FBQyxHQUFHLGVBQWUsQ0FBQyxJQUFJLENBQUMseUJBQVcsQ0FBQyxXQUFXLENBQUMsQ0FBQyxLQUFLLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxrQkFBZSxDQUFDLElBQUksQ0FBQyxlQUFPLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyx5QkFBVyxDQUFDLFdBQVcsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLGtCQUFlLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFBO1FBQ3hMLEVBQUUsQ0FBQyxNQUFNLENBQUMsR0FBRyxTQUFTLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLHlCQUFXLENBQUMsV0FBVyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFBO1FBQ2hILEVBQUUsQ0FBQyxPQUFPLENBQUMsR0FBRyxrQkFBZSxDQUFDLElBQUksQ0FBQyxlQUFPLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyx5QkFBVyxDQUFDLFdBQVcsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsUUFBUSxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxrQkFBZSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsa0JBQWUsQ0FBQyxJQUFJLENBQUMsZUFBTyxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMseUJBQVcsQ0FBQyxXQUFXLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFBO0tBQ3ZPO0lBQ0QsMkJBQTJCO1NBQ3RCO1FBQ0QsRUFBRSxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQTtRQUNiLGlJQUFpSTtRQUNqSSxFQUFFLENBQUMsTUFBTSxDQUFDLEdBQUcsZUFBZSxDQUFDLElBQUksQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLFNBQVMsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQTtRQUN4SSxFQUFFLENBQUMsVUFBVSxDQUFDLEdBQUcsa0JBQWUsQ0FBQyxJQUFJLENBQUMsZUFBTyxDQUFDLHNCQUFVLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQTtRQUN6SCxFQUFFLENBQUMsVUFBVSxDQUFDLEdBQUcsa0JBQWUsQ0FBQyxJQUFJLENBQUMsZUFBTyxDQUFDLHNCQUFVLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQTtRQUN6SCxFQUFFLENBQUMsTUFBTSxDQUFDLEdBQUcsU0FBUyxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUE7S0FDN0Y7SUFDRCxPQUFPLEVBQUUsQ0FBQTtBQUNiLENBQUM7QUEzQ0Qsd0RBMkNDO0FBRUQsU0FBZ0IsY0FBYyxDQUFDLEdBQXVCLEVBQUUsVUFBb0I7SUFDeEUsTUFBTSxTQUFTLEdBQUcsOEJBQWdCLENBQUMsR0FBRyxFQUFFLFVBQVUsQ0FBQyxDQUFDO0lBQ3BELE9BQU8sMkJBQTJCLENBQUMsU0FBUyxDQUFDLENBQUM7QUFDbEQsQ0FBQztBQUhELHdDQUdDO0FBRUQsU0FBZ0IsMkJBQTJCLENBQUMsU0FBaUI7SUFDekQsSUFBSSxDQUFDLFNBQVMsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLEVBQUU7UUFDN0IsU0FBUyxHQUFHLElBQUksR0FBRyxTQUFTLENBQUM7S0FDaEM7SUFDRCxNQUFNLFVBQVUsR0FBRyxnQkFBTSxFQUFFLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFBO0lBQ2pGLE1BQU0saUJBQWlCLEdBQUcsbUJBQVMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxVQUFVLEVBQUUsS0FBSyxDQUFDLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFBO0lBQzdFLE9BQU8sS0FBSyxpQkFBaUIsRUFBRSxDQUFDO0FBQ3BDLENBQUM7QUFQRCxrRUFPQztBQUVELFNBQWdCLG9CQUFvQixDQUFDLEVBQXNCO0lBQ3ZELElBQUksQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEtBQUssS0FBSyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxLQUFLLEtBQUssS0FBSyxJQUFJLGtCQUFlLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUMsQ0FBQyxRQUFRLEVBQUUsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxDQUFDLElBQUksS0FBSyxJQUFJLEVBQUU7UUFDdEgsTUFBTSxNQUFNLEdBQUcsSUFBSSx3QkFBUyxDQUFDLGtCQUFlLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxRQUFRLENBQUMsQ0FBQyxRQUFRLEVBQUUsR0FBRyxLQUFLLENBQUMsQ0FBQyxLQUFLLENBQUMsa0JBQWUsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLFFBQVEsQ0FBQyxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsRUFBRSxDQUFBO1FBQzVKLE9BQU8sRUFBRSxlQUFlLEVBQUUseUJBQVcsQ0FBQyxpQkFBaUIsRUFBRSxZQUFZLEVBQUUsTUFBTSxFQUFFLENBQUE7S0FDbEY7U0FDSSxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxLQUFLLEtBQUssSUFBSSxrQkFBZSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFDLENBQUMsUUFBUSxFQUFFLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsSUFBSSxLQUFLLElBQUksRUFBRTtRQUMvRixPQUFPLEVBQUUsZUFBZSxFQUFFLHlCQUFXLENBQUMsWUFBWSxFQUFFLFlBQVksRUFBRSxHQUFHLEVBQUUsQ0FBQTtLQUMxRTtTQUNJLElBQUksQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEtBQUssSUFBSSxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsSUFBSSxLQUFLLElBQUksRUFBRTtRQUM3QyxNQUFNLE1BQU0sR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLEtBQUssS0FBSyxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksd0JBQVMsQ0FBQyxJQUFJLHdCQUFTLENBQUMsa0JBQWUsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLFFBQVEsQ0FBQyxDQUFDLFFBQVEsRUFBRSxHQUFHLEtBQUssQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxrQkFBZSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsUUFBUSxDQUFDLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsa0JBQWUsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLEtBQUssQ0FBQyxDQUFDLFFBQVEsRUFBRSxHQUFHLEtBQUssQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSx3QkFBUyxDQUFDLElBQUksd0JBQVMsQ0FBQyxrQkFBZSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsUUFBUSxDQUFDLENBQUMsUUFBUSxFQUFFLEdBQUcsS0FBSyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLGtCQUFlLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxRQUFRLENBQUMsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQTtRQUN4WixPQUFPLEVBQUUsZUFBZSxFQUFFLHlCQUFXLENBQUMsYUFBYSxFQUFFLFlBQVksRUFBRSxNQUFNLEVBQUUsQ0FBQTtLQUM5RTtTQUNJO1FBQ0QsTUFBTSxHQUFHLEdBQUcsSUFBSSx3QkFBUyxDQUFDLGtCQUFlLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxRQUFRLENBQUMsQ0FBQyxRQUFRLEVBQUUsR0FBRyxLQUFLLENBQUMsQ0FBQyxLQUFLLENBQUMsa0JBQWUsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLFFBQVEsQ0FBQyxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUM7UUFDcEksTUFBTSxNQUFNLEdBQUcsSUFBSSx3QkFBUyxDQUFDLGtCQUFlLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUMsQ0FBQyxRQUFRLEVBQUUsR0FBRyxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ3JHLE9BQU8sRUFBRSxlQUFlLEVBQUUseUJBQVcsQ0FBQyxLQUFLLEVBQUUsWUFBWSxFQUFFLE1BQU0sRUFBRSxDQUFBO0tBQ3RFO0FBQ0wsQ0FBQztBQWpCRCxvREFpQkM7QUFFTSxLQUFLLFVBQVUsb0JBQW9CLENBQUMsS0FBaUIsRUFBRSxZQUFvQixFQUFFLEVBQXNCLEVBQUUsZUFBdUIsRUFBRSxVQUFrQixFQUFFLFNBQWlCO0lBQ3RLLE1BQU0sTUFBTSxHQUFHLENBQUMsSUFBZ0IsRUFBRSxFQUFFO1FBQ2hDLE9BQU8sYUFBYSxDQUFDLElBQUksRUFBRSxnQkFBUSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUM7SUFDckQsQ0FBQyxDQUFDO0lBQ0YsT0FBTyxNQUFNLHdCQUF3QixDQUFDLEtBQUssRUFBRSxZQUFZLEVBQUUsRUFBRSxFQUFFLGVBQWUsRUFBRSxNQUFNLEVBQUUsU0FBUyxDQUFDLENBQUM7QUFDdkcsQ0FBQztBQUxELG9EQUtDO0FBRUQsU0FBUywrQkFBK0IsQ0FBQyxHQUFXO0lBQ2hELE1BQU0sS0FBSyxHQUFHLGtCQUFlLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLFFBQVEsRUFBRSxDQUFDO0lBQ25ELE1BQU0sZUFBZSxHQUFHLElBQUksd0JBQVMsQ0FBQyxLQUFLLEdBQUcsS0FBSyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ2hFLE1BQU0sMkJBQTJCLEdBQUcsSUFBSSx3QkFBUyxDQUFDLGVBQWUsR0FBRyxLQUFLLENBQUMsQ0FBQyxRQUFRLEVBQUUsQ0FBQztJQUN0RixPQUFPLDJCQUEyQixDQUFDO0FBQ3ZDLENBQUM7QUFFTSxLQUFLLFVBQVUsd0JBQXdCLENBQUMsS0FBaUIsRUFBRSxZQUFvQixFQUFFLEVBQXNCLEVBQUUsZUFBdUIsRUFBRSxNQUFnQixFQUFFLFNBQWlCO0lBQ3hLLDJEQUEyRDtJQUMzRCxJQUFJLE1BQU0sR0FBTyxFQUFFLE9BQU8sRUFBRSxDQUFDLEVBQUUsUUFBUSxFQUFFLENBQUMsRUFBRSxJQUFJLEVBQUUsRUFBRSxFQUFFLEtBQUssRUFBRSxFQUFFLEVBQUUsQ0FBQztJQUNsRSw0Q0FBNEM7SUFDNUMsRUFBRSxDQUFDLFFBQVEsR0FBRywrQkFBK0IsQ0FBQyxrQkFBZSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsUUFBUSxDQUFDLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQztJQUM1RixNQUFNLEtBQUssR0FBRyxrQkFBZSxDQUFDLElBQUksQ0FBQyxJQUFJLHdCQUFTLENBQUMsWUFBWSxHQUFHLEtBQUssQ0FBQyxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUM7SUFDbkYsa0ZBQWtGO0lBQ2xGLDBFQUEwRTtJQUMxRSxrRUFBa0U7SUFDbEUsMENBQTBDO0lBQzFDLCtCQUErQjtJQUMvQiw0QkFBNEIsQ0FBQyxrQkFBZSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsUUFBUSxDQUFDLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQztJQUMzRSxNQUFNLFlBQVksR0FBRyxrQkFBZSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsUUFBUSxDQUFDLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFDO0lBRS9ELE1BQU0sS0FBSyxHQUFRLEVBQUUsQ0FBQztJQUN0QixJQUFJLGVBQWUsS0FBSyx5QkFBVyxDQUFDLGlCQUFpQixFQUFFO1FBQ25ELE1BQU0sa0JBQWtCLEdBQUcsZUFBZSxDQUN0QyxrQkFBZSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsUUFBUSxDQUFDLENBQUMsUUFBUSxFQUFFLEVBQzVDLGtCQUFlLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxRQUFRLENBQUMsQ0FBQyxRQUFRLEVBQUU7UUFDNUMsYUFBYTtRQUNiLEVBQUUsQ0FBQyxJQUFJLEVBQ1AsRUFBRTtRQUNGLHFEQUFxRDtRQUNyRCxJQUFJLHdCQUFTLENBQUMsa0JBQWUsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsUUFBUSxFQUFFLEdBQUcsS0FBSyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUMzRSxDQUFDO1FBQ0YsS0FBSyxDQUFDLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO1FBQy9CLE1BQU0sQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLGtCQUFrQixDQUFDLENBQUM7S0FDekM7U0FBTSxJQUFJLGVBQWUsS0FBSyx5QkFBVyxDQUFDLGFBQWEsRUFBRTtRQUN0RCxNQUFNLGlCQUFpQixHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsS0FBSyxLQUFLLElBQUksQ0FBQyxDQUFDO1lBQzNDLElBQUksd0JBQVMsQ0FBQyxrQkFBZSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFDLENBQUMsUUFBUSxFQUFFLEdBQUcsS0FBSyxDQUFDLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQztZQUM3RSxJQUFJLHdCQUFTLENBQUMsa0JBQWUsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsUUFBUSxFQUFFLEdBQUcsS0FBSyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQzdFLE1BQU0sZ0JBQWdCLEdBQUcsZUFBZSxDQUNwQyxrQkFBZSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsUUFBUSxDQUFDLENBQUMsUUFBUSxFQUFFLEVBQzVDLGtCQUFlLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxRQUFRLENBQUMsQ0FBQyxRQUFRLEVBQUU7UUFDNUMsYUFBYTtRQUNiLEVBQUUsQ0FBQyxJQUFJLEVBQ1AsRUFBRSxDQUFDLEVBQUUsRUFDTCxpQkFBaUIsQ0FDcEIsQ0FBQztRQUNGLEtBQUssQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztRQUM3QixNQUFNLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO0tBQ3ZDO1NBQU0sSUFBSSxlQUFlLEtBQUsseUJBQVcsQ0FBQyxLQUFLLEVBQUU7UUFDOUMsS0FBSyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQTtLQUN0QjtTQUFNLElBQUksZUFBZSxLQUFLLHlCQUFXLENBQUMsWUFBWSxFQUFFO1FBQ3JELHNGQUFzRjtRQUN0RixNQUFNLElBQUksS0FBSyxDQUFDLHdEQUF3RCxDQUFDLENBQUM7S0FDN0U7U0FBTTtRQUNILE1BQU0sSUFBSSxLQUFLLENBQUMsNENBQTRDLEdBQUcsZUFBZSxDQUFDLENBQUM7S0FDbkY7SUFFRCxhQUFhO0lBQ2IsTUFBTSxhQUFhLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDN0MsYUFBYTtJQUNiLE1BQU0sQ0FBQyxJQUFJLEVBQUUsT0FBTyxFQUFFLGVBQWUsRUFBRSxHQUFHLEVBQUUsWUFBWSxFQUFFLFVBQVUsQ0FBQyxHQUFHLE1BQU0sT0FBTyxDQUNqRixLQUFLLEVBQ0wsS0FBSyxFQUNMLFlBQVksRUFDWixLQUFLLENBQUMsUUFBUSxFQUFFLEVBQ2hCLFlBQVksQ0FBQyxRQUFRLEVBQUUsRUFDdkIsYUFBYSxDQUNoQixDQUFDO0lBRUYsSUFBSSxJQUFJLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRTtRQUNuQixNQUFNLElBQUksS0FBSyxDQUFDLHdCQUF3QixDQUFDLENBQUM7S0FDN0M7SUFFRCxNQUFNLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQztJQUVuQixJQUFJLGVBQWUsS0FBSyx5QkFBVyxDQUFDLEtBQUssRUFBRTtRQUN2QyxhQUFhO1FBQ2IsTUFBTSxjQUFjLEdBQUcsRUFBRSxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDNUMsSUFBSSxLQUFhLENBQUM7UUFDbEIsSUFBSSxZQUFZLEVBQUU7WUFDZCxnQkFBZ0I7WUFDaEIsS0FBSyxHQUFHLElBQUksd0JBQVMsQ0FBQyxrQkFBZSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFDLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQyxRQUFRLEVBQUUsQ0FBQTtTQUM5RTthQUFNO1lBQ0gsS0FBSyxHQUFHLElBQUksd0JBQVMsQ0FBQyxlQUFlLENBQUMsQ0FBQyxRQUFRLEVBQUUsQ0FBQztTQUNyRDtRQUVELE1BQU0sU0FBUyxHQUFHO1lBQ2QsTUFBTSxFQUFFLFdBQVcsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLGNBQWMsRUFBRSxLQUFLLENBQUMsQ0FBQztZQUN2RCxLQUFLLEVBQUUsS0FBSztTQUNmLENBQUM7UUFDRixNQUFNLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQztLQUNoQztJQUVELHVCQUF1QjtJQUN2QixJQUFJLFlBQVksRUFBRTtRQUNkLE1BQU0sQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDO1lBQ2QsYUFBYTtZQUNiLE1BQU0sRUFBRSxTQUFTLENBQUMsVUFBVSxDQUFDLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxhQUFhLEVBQUUsS0FBSyxDQUFDLENBQUM7WUFDaEUsS0FBSyxFQUFFLFlBQVksQ0FBQyxRQUFRLEVBQUU7U0FDakMsQ0FBQyxDQUFBO0tBQ0w7SUFFRCxzQkFBc0I7SUFDdEIsTUFBTSxXQUFXLEdBQUcsRUFBRSxDQUFDO0lBQ3ZCLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTtRQUN6QyxXQUFXLENBQUMsSUFBSSxpQ0FBTSxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxLQUFFLENBQUMsV0FBVyxDQUFDLEVBQUUsY0FBYyxDQUFDLE1BQU0sYUFBYSxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsTUFBTSxDQUFDLEVBQUUsU0FBUyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFHLENBQUE7S0FDM0k7SUFDRCxNQUFNLENBQUMsSUFBSSxHQUFHLFdBQVcsQ0FBQTtJQUN6QiwyQ0FBMkM7SUFDM0MsTUFBTSxVQUFVLEdBQUcsVUFBVSxDQUFDLE1BQU0sQ0FBQyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUN0RCxPQUFPLFVBQVUsQ0FBQztBQUN0QixDQUFDO0FBeEdELDREQXdHQyJ9