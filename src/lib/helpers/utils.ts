import { encode as encodeVaruint, encodingLength } from 'varuint-bitcoin';
import { encode } from 'bip66';
import { OPS } from "./opcodes";
import { GLOBAL_VARS } from "./global-vars";
import { BufferCursor } from './buffer-cursor';
import { getAddress } from "@ethersproject/address";

//@ts-ignore
import { ecdsaSign, sign } from 'secp256k1';
let secp256k1Sign = ecdsaSign
if (!ecdsaSign && sign) {
    // support version 3 secp256k1 library (used by metamask)
    //@ts-ignore
    secp256k1Sign = function(buffer, privateKey) {
        // v3 uses different version of Buffer, fake that these are compatabile
        //@ts-ignore
        buffer._isBuffer = true;
        //@ts-ignore
        privateKey._isBuffer = true;
        return sign(buffer, privateKey);
    }
}
import { encode as encodeCInt, decode as decodeCInt } from "bitcoinjs-lib/src/script_number"
import { sha256, ripemd160 } from "hash.js"
import { BigNumber } from "bignumber.js"
// 1 satoshi is e-8 so we need bignumber to not set an exponent for numbers greater than that
// since we use exponents to do multiplication
// BigNumber.config({ EXPONENTIAL_AT: 10 })
import {
    arrayify,
    BytesLike,
    hexlify
} from "ethers/lib/utils";
import { Transaction } from "@ethersproject/transactions";
import { BigNumber as BigNumberEthers, BigNumberish, logger } from "ethers";
import { decode } from "./hex-decoder";
import { computePublicKey } from "@ethersproject/signing-key";
import { TransactionRequest } from "@ethersproject/abstract-provider";

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
    if (!BigNumber.prototype[is] && BigNumber.prototype[methodName]) {
        // @ts-ignore
        BigNumber.prototype[is] = BigNumber.prototype[methodName];
    }
})

export interface ListUTXOs {
    address: string,
    txid: string,
    vout: number,
    amount: string,
    safe: boolean,
    spendable: boolean,
    solvable: boolean,
    label: string,
    type: string,
    confirmations: number,
    scriptPubKey: string,
    redeemScript: string
}

export interface TxVinWithNullScriptSig {
    txid: Buffer,
    hash: Buffer,
    vout: number,
    sequence: number,
    script: Buffer,
    scriptSig: null
}

export interface TxVinWithoutNullScriptSig {
    txid: Buffer,
    hash: Buffer,
    vout: number,
    sequence: number,
    script: Buffer,
    scriptSig: Buffer
}
export interface CloneTxVin {
    txid: Buffer,
    hash: Buffer,
    vout: number,
    sequence: number,
    script: Buffer,
    scriptSig: null
}

export interface TxVout {
    script: Buffer,
    value: number,
}

export interface CloneTx {
    version: number,
    locktime: number,
    vins: Array<TxVinWithNullScriptSig | TxVinWithoutNullScriptSig>,
    vouts: Array<TxVout>
}
export interface Tx {
    version: number,
    locktime: number,
    vins: Array<TxVinWithNullScriptSig | TxVinWithoutNullScriptSig>,
    vouts: Array<TxVout>
}

export interface CheckTransactionType {
    transactionType: number,
    neededAmount: any
}

function cloneBuffer(buffer: Buffer): Buffer {
    let result = Buffer.alloc(buffer.length);
    buffer.copy(result);
    return result;
}

function cloneTx(tx: any): CloneTx {
    let result = { version: tx.version, locktime: tx.locktime, vins: <any>[], vouts: <any>[] };
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
export function calcTxBytes(vins: Array<TxVinWithoutNullScriptSig | TxVinWithNullScriptSig>, vouts: Array<TxVout>): number {
    return GLOBAL_VARS.TX_OVERHEAD_NVERSION +
        encodingLength(vins.length) +
        vins
            .map(vin => (vin.scriptSig ? vin.scriptSig.byteLength : vin.script.byteLength))
            .reduce((sum, len) => sum + GLOBAL_VARS.TX_INPUT_OUTPOINT + encodingLength(len) + len + GLOBAL_VARS.TX_INPUT_NSEQUENCE, 0) +
        encodingLength(vouts.length) +
        vouts
            .map(vout => vout.script.byteLength)
            .reduce((sum, len) => sum + GLOBAL_VARS.TX_OUTPUT_NVALUE + encodingLength(len) + len, 0) +
        GLOBAL_VARS.TX_OVERHEAD_NLOCKTIME
}

export function txToBuffer(tx: any): Buffer {
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
        } else {
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
function toDER(x: Buffer): Buffer {
    let i = 0;
    while (x[i] === 0) ++i;
    if (i === x.length) return Buffer.alloc(1);
    x = x.slice(i);
    if (x[0] & 0x80) return Buffer.concat([Buffer.alloc(1), x], 1 + x.length);
    return x;
}

// refer to: https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/src/script_signature.js
function encodeSig(signature: Uint8Array, hashType: number): Buffer {
    const hashTypeMod = hashType & ~0x80;
    if (hashTypeMod <= 0 || hashTypeMod >= 4) throw new Error('Invalid hashType ' + hashType);

    const hashTypeBuffer = Buffer.from([hashType]);
    const bufferSignature = Buffer.from(signature);
    const r = toDER(bufferSignature.slice(0, 32));
    const s = toDER(bufferSignature.slice(32, 64));

    return Buffer.concat([encode(r, s), hashTypeBuffer]);
}


/////////////////////////////////////////

export async function signp2pkh(tx: any, vindex: number, privKey: string): Promise<Buffer> {
    return await signp2pkhWith(tx, vindex, (hash: Uint8Array) => {
        return secp256k1Sign(hash, arrayify(privKey));
    });
}

export async function signp2pkhWith(tx: any, vindex: number, signer: Function): Promise<Buffer> {
    let clone = cloneTx(tx);
    // clean up relevant script
    // TODO: Implement proper handling of OP_CODESEPARATOR, this was filtering 'ab' from the script entirely preventing pubkeyhash with ab addresses from generating proper tx
    // Since all scripts are generated locally in this library, temporarily not having this implemented is OK as no scripts will have this opcode
    // let filteredPrevOutScript = clone.vins[vindex].script.filter((op: any) => op !== OPS.OP_CODESEPARATOR);
    // Uint8Array issue here
    // clone.vins[vindex].script = toBuffer(filteredPrevOutScript);
    // zero out scripts of other inputs
    for (let i = 0; i < clone.vins.length; i++) {
        if (i === vindex) continue;
        clone.vins[i].script = Buffer.alloc(0);
    }
    // write to the buffer
    let buffer = txToBuffer(clone)
    // extend and append hash type
    buffer = Buffer.alloc(buffer.byteLength + 4, buffer);
    // append the hash type
    buffer.writeUInt32LE(GLOBAL_VARS.HASH_TYPE, buffer.byteLength - 4);

    // double-sha256
    let firstHash = sha256().update(buffer).digest();
    let secondHash = sha256().update(firstHash).digest();

    // sign on next tick so we don't block UI
    await new Promise((resolve) => setImmediate(resolve));

    // sign hash
    let sig = await signer(new Uint8Array(secondHash));

    // encode sig
    return encodeSig(sig.signature, GLOBAL_VARS.HASH_TYPE);
}
export function p2pkhScriptSig(sig: any, pubkey: any): Buffer {
    return bitcoinjs.script.compile([sig, Buffer.from(pubkey, 'hex')]);
}

// Refer to:
// https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/src/payments/p2pkh.js#L58
export function p2pkhScript(hash160PubKey: Buffer): Buffer {
    return bitcoinjs.script.compile([
        OPS.OP_DUP,
        OPS.OP_HASH160,
        hash160PubKey,
        OPS.OP_EQUALVERIFY,
        OPS.OP_CHECKSIG
    ]);
}

const scriptMap = {
    p2pkh: p2pkhScript,
}

export function contractTxScript(contractAddress: string, gasLimit: number, gasPrice: number, encodedData: string): Buffer {
    // If contractAddress is missing, assume it's a create script, else assume its a call contract interaction
    if (contractAddress === "") {
        return bitcoinjs.script.compile([
            OPS.OP_4,
            encodeCInt(gasLimit),
            encodeCInt(gasPrice),
            Buffer.from(encodedData, "hex"),
            OPS.OP_CREATE,
        ])
    } else {
        return bitcoinjs.script.compile([
            OPS.OP_4,
            encodeCInt(gasLimit),
            encodeCInt(gasPrice),
            Buffer.from(encodedData, "hex"),
            Buffer.from(contractAddress, "hex"),
            OPS.OP_CALL,
        ])
    }
}

function reverse(src: Buffer) {
    let buffer = Buffer.alloc(src.length)
    for (var i = 0, j = src.length - 1; i <= j; ++i, --j) {
        buffer[i] = src[j]
        buffer[j] = src[i]
    }
    return buffer
}

export function generateContractAddress(txid: string) {
    let buffer = Buffer.alloc(32 + 4);
    let cursor = new BufferCursor(buffer);
    cursor.writeBytes(reverse(Buffer.from(txid, "hex")));
    // Assuming vout index is 0 as the transaction is serialized with that assumption.
    cursor.writeUInt32LE(0);
    let firstHash = sha256().update(buffer.toString("hex"), "hex").digest("hex");
    let secondHash = ripemd160().update(firstHash, "hex").digest("hex");
    return getAddress(secondHash).substring(2);
}

export async function addVins(outputs: Array<any>, spendableUtxos: Array<ListUTXOs>, neededAmount: string, needChange: boolean, gasPriceString: string, hash160PubKey: string): Promise<Array<any>> {
    // minimum gas price is 40 satoshi
    // minimum sat/kb is 4000
    const gasPrice = BigNumberEthers.from(gasPriceString);
    const minimumSatoshiPerByte = 400;
    if (gasPrice.lt(BigNumberEthers.from(minimumSatoshiPerByte))) {
        throw new Error("Gas price lower than minimum relay fee: " + gasPriceString + " => " + gasPrice.toString() + " < " + minimumSatoshiPerByte);
    }

    let inputs = [];
    let amounts = [];
    let change;
    let inputsAmount = BigNumberEthers.from(0);
    const neededAmountBN = BigNumberEthers.from(new BigNumber(qtumToSatoshi(neededAmount)).toString());
    let vbytes = BigNumberEthers.from(GLOBAL_VARS.TX_OVERHEAD_BASE);
    const spendVSizeLookupMap = {
        p2pkh: BigNumberEthers.from(GLOBAL_VARS.TX_INPUT_BASE + GLOBAL_VARS.TX_INPUT_SCRIPTSIG_P2PKH).toNumber(),
    }
    const changeType = 'p2pkh';
    const outputVSizeLookupMap = {
        p2pkh: BigNumberEthers.from(GLOBAL_VARS.TX_OUTPUT_BASE + GLOBAL_VARS.TX_OUTPUT_SCRIPTPUBKEY_P2PKH).toNumber(),
        p2wpkh: BigNumberEthers.from(GLOBAL_VARS.TX_OUTPUT_BASE + GLOBAL_VARS.TX_OUTPUT_SCRIPTPUBKEY_P2WPKH).toNumber(),
        p2sh2of3: BigNumberEthers.from(GLOBAL_VARS.TX_OUTPUT_BASE + GLOBAL_VARS.TX_OUTPUT_SCRIPTPUBKEY_P2SH2OF3).toNumber(),
        p2wsh2of3: BigNumberEthers.from(GLOBAL_VARS.TX_OUTPUT_BASE + GLOBAL_VARS.TX_OUTPUT_SCRIPTPUBKEY_P2WSH2OF3).toNumber(),
        p2tr: BigNumberEthers.from(GLOBAL_VARS.TX_OUTPUT_BASE + GLOBAL_VARS.TX_OUTPUT_SCRIPTPUBKEY_P2TR).toNumber(),
    }
    for (let i = 0; i < outputs.length; i++) {
        const output = outputs[i];
        let outputVSize: any = output;
        if (typeof output === "string") {
            if (!outputVSizeLookupMap.hasOwnProperty(output.toLowerCase())) {
                throw new Error("Unsupported output script type: " + output.toLowerCase());
            } else {
                // @ts-ignore
                outputVSize = outputVSizeLookupMap[output.toLowerCase()];
            }
        } else if (output.hasOwnProperty('script') && output.hasOwnProperty('value')) {
            // longer script sizes require up to 3 vbytes to encode
            const scriptEncodingLength = encodingLength(output.script.byteLength) - 1;
            outputVSize = BigNumberEthers.from(GLOBAL_VARS.TX_OUTPUT_BASE + scriptEncodingLength + output.script.byteLength).toNumber();
        } else {
            outputVSize = BigNumberEthers.from(outputVSize).toNumber();
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
        const utxoValue = parseFloat(shiftBy(amount, 8));
        // balance += utxoValue;
        let script = Buffer.from(spendableUtxo.scriptPubKey);
        // all scripts will be p2pkh for now
        const typ: string = spendableUtxo.type || '';
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
        const outputVSize: number = spendVSizeLookupMap[typ.toLowerCase()];
        vbytes = vbytes.add(outputVSize);
        const fee = BigNumberEthers.from(vbytes).mul(gasPrice);

        inputsAmount = inputsAmount.add(utxoValue);
        amounts.push(utxoValue);

        if (neededAmountBN.eq(inputsAmount)) {
            if (i === spendableUtxos.length - 1) {
                // reached end
                // have exactly the needed amount
                // spending all utxo values
                // when caller computes change, it won't generate a change address
                needMoreInputs = false;
            } else {
                // not sending all
                // confirm that there is enough in inputs to cover network fees
                const neededAmountPlusFees = neededAmountBN.add(fee);
                const changeVBytes = outputVSizeLookupMap[changeType];
                const changeFee = BigNumberEthers.from(changeVBytes).mul(gasPrice).toNumber();
                const neededAmountPlusFeesAndChange = needChange ? neededAmountPlusFees.add(changeFee) : neededAmountPlusFees;
                if (inputsAmount.eq(neededAmountPlusFees)) {
                    // no change output required, matches exactly
                    needMoreInputs = false;
                } else if (inputsAmount.lt(neededAmountPlusFees)) {
                    // not enough to cover total to send + fees, we need another input
                } else if (inputsAmount.gte(neededAmountPlusFeesAndChange)) {
                    // has enough to cover with a change output
                    needMoreInputs = false;
                    vbytes = vbytes.add(changeVBytes);
                    change = inputsAmount.sub(neededAmountPlusFeesAndChange);
                } else {
                    // not enough to cover with a change output, we need another input
                }
            }
        } else if (neededAmountBN.lt(inputsAmount)) {
            // have enough, check that there is enough change to cover fees
            const totalNeededPlusFees = neededAmountBN.add(fee);
            const changeVBytes = outputVSizeLookupMap[changeType];
            const changeFee = BigNumberEthers.from(changeVBytes).mul(gasPrice).toNumber();
            const totalNeededPlusFeesAndChange = needChange ? totalNeededPlusFees.add(changeFee) : totalNeededPlusFees;
            if (inputsAmount.eq(totalNeededPlusFees)) {
                // no change output required, matches exactly
                needMoreInputs = false;
            } else if (inputsAmount.lt(totalNeededPlusFees)) {
                // not enough to cover total to send + fees, we need another input
            } else if (inputsAmount.gte(totalNeededPlusFeesAndChange)) {
                if (needChange) {
                    // has enough to cover with a change output
                    needMoreInputs = false;
                    vbytes = vbytes.add(changeVBytes);
                    change = inputsAmount.sub(totalNeededPlusFeesAndChange);
                    // throw new Error("Change output...2");
                } else {
                    // no change output requested
                    // bump the output by the change
                }
            } else {
                // not enough to cover with a change output, we need another input
            }
        } else {
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
        const missing = neededAmountBN.sub(inputsAmount).toNumber()
        throw new Error("Need " + missing + " more satoshi, we have " + inputsAmount.toString());
    }

    const fee = BigNumberEthers.from(vbytes).mul(gasPrice);
    const availableAmount = inputsAmount.sub(fee).toNumber()

    return [inputs, amounts, availableAmount, fee, change, changeType];
}

export function getMinNonDustValue(input: ListUTXOs, feePerByte: BigNumberish): number {
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
            size = GLOBAL_VARS.TX_OUTPUT_SCRIPTPUBKEY_P2PKH;
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
            size += 32 + 4 + 1 + (107 / GLOBAL_VARS.WITNESS_SCALE_FACTOR) + 4; // 68
            // fallthrough, unsupported script type
        default:
            throw new Error("Unsupported output script type: " + input.type);
    }

    return BigNumberEthers.from(feePerByte).mul(size).toNumber();
}

function shiftBy(amount: BigNumberish, byPowerOfTen: number): string {
    let amountString;
    if (typeof amount === "number") {
        amountString = `${amount}`;
        logger.info("amountString is number: ", amount, amountString)
    } else if (typeof amount === 'string') {
        amountString = amount;
        logger.info("amountString is string: ", amountString)
    } else {
        amountString = BigNumberEthers.from(amount).toString();
        logger.info("amountString is other: ", typeof amount, " => ", amountString)
    }

    const indexOfExponent = amountString.indexOf('e');
    if (indexOfExponent !== -1) {
        // very small or large number with lots of decimals with an exponent
        // we want to adjust the exponent
        const exponentString = amountString.substring(indexOfExponent + 1, amountString.length);
        // exponentString = '-10', '+10' etc
        const exponent = parseInt(exponentString);
        const shiftedExponent = exponent + byPowerOfTen;
        amountString = amountString.substring(0, indexOfExponent);
        byPowerOfTen = shiftedExponent;
    }
    const a = byPowerOfTen === 0 ? amountString : `${amountString}e${byPowerOfTen < 0 ? '':'+'}${byPowerOfTen}`;
    logger.info("shiftBy: ", amount, " => ", amountString, " => ", a);
    return a;
}

function satoshiToQtum(inSatoshi?: BigNumberish): string {
    return shiftBy(inSatoshi || 0, -8);
    /*
    const a = BigNumberEthers.from(inSatoshi).div(BigNumberEthers.from('100000000')).toString();
    logger.info("satoshiToQtum: ", inSatoshi, " => ", a);
    return a;
    */
}

function qtumToSatoshi(inQtum?: BigNumberish): string {
    return shiftBy(inQtum || 0, 8);
    /*
    const a = BigNumberEthers.from(inQtum).mul(BigNumberEthers.from('100000000')).toString();
    logger.info("qtumToSatoshi: ", inQtum, " => ", a);
    return a;
    */
}

function checkLostPrecisionInGasPrice(gasPrice: number) {
    const roundedGasPrice = new BigNumber(new BigNumber(satoshiToQtum(gasPrice)).toFixed(8)).toNumber();
    const originalGasPrice = new BigNumber(new BigNumber(satoshiToQtum(gasPrice)).toFixed()).toNumber();
    if (roundedGasPrice != originalGasPrice) {
        throw new Error("Precision lost in gasPrice: " + (originalGasPrice - roundedGasPrice))
    }
}

function getContractVout(gasPrice: number, gasLimit: number, data: string, address: string, value: string): TxVout {
    return {
        script: contractTxScript(
            address === "" ? "" : address.split("0x")[1],
            gasLimit,
            gasPrice,
            data.split("0x")[1]
        ),
        value: new BigNumber(value).times(1e8).toNumber(),
    }
}

export function parseSignedTransaction(transaction: string): Transaction {
    if (transaction.startsWith("0x")) {
        transaction = transaction.substring(2);
    }
    let tx: Transaction = {
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
    const sha256HashFirst = sha256().update(transaction, "hex").digest("hex")
    const sha256HashSecond = reverse(Buffer.from(sha256().update(sha256HashFirst, "hex").digest("hex"), "hex")).toString("hex")
    tx['hash'] = `0x${sha256HashSecond}`
    const btcDecodedRawTx = decode(transaction);
    // Check if first OP code is OP_DUP -> assume p2pkh script
    if (bitcoinjs.script.decompile(btcDecodedRawTx.outs[GLOBAL_VARS.UTXO_VINDEX].script)[0] === OPS.OP_DUP) {
        tx['to'] = `0x${bitcoinjs.script.decompile(btcDecodedRawTx.outs[GLOBAL_VARS.UTXO_VINDEX].script)[2].toString("hex")}`
        // If there is no change output, which is currently being used to identify the sender, how else can we find out the from address?
        tx['from'] = btcDecodedRawTx.outs.length > 1 ? `0x${bitcoinjs.script.decompile(btcDecodedRawTx.outs[1].script)[2].toString("hex")}` : ""
        tx['value'] = BigNumberEthers.from(hexlify(btcDecodedRawTx.outs[GLOBAL_VARS.UTXO_VINDEX].value))
    }
    // Check if first OP code is OP_4 and length is > 5 -> assume contract call
    else if (bitcoinjs.script.decompile(btcDecodedRawTx.outs[GLOBAL_VARS.UTXO_VINDEX].script)[0] === OPS.OP_4 && bitcoinjs.script.decompile(btcDecodedRawTx.outs[GLOBAL_VARS.UTXO_VINDEX].script).length > 5) {
        tx['to'] = `0x${bitcoinjs.script.decompile(btcDecodedRawTx.outs[GLOBAL_VARS.UTXO_VINDEX].script)[4].toString("hex")}`
        // If there is no change output, which is currently being used to identify the sender, how else can we find out the from address?
        tx['from'] = btcDecodedRawTx.outs.length > 1 ? `0x${bitcoinjs.script.decompile(btcDecodedRawTx.outs[1].script)[2].toString("hex")}` : ""
        tx['value'] = btcDecodedRawTx.outs[GLOBAL_VARS.UTXO_VINDEX].value > 0 ? BigNumberEthers.from(hexlify(btcDecodedRawTx.outs[GLOBAL_VARS.UTXO_VINDEX].value)) : BigNumberEthers.from("0x0")
        tx['data'] = bitcoinjs.script.decompile(btcDecodedRawTx.outs[GLOBAL_VARS.UTXO_VINDEX].script)[3].toString("hex")
        tx['value'] = BigNumberEthers.from(hexlify(btcDecodedRawTx.outs[GLOBAL_VARS.UTXO_VINDEX].value)).toNumber() === 0 ? BigNumberEthers.from("0x0") : BigNumberEthers.from(hexlify(btcDecodedRawTx.outs[GLOBAL_VARS.UTXO_VINDEX].value))
    }
    // assume contract creation
    else {
        tx['to'] = ""
        // If there is no change output, which is currently being used to identify the sender, how else can we find out the from address?
        tx['from'] = btcDecodedRawTx.outs.length > 1 ? `0x${bitcoinjs.script.decompile(btcDecodedRawTx.outs[1].script)[2].toString("hex")}` : ""
        tx['gasLimit'] = BigNumberEthers.from(hexlify(decodeCInt(bitcoinjs.script.decompile(btcDecodedRawTx.outs[0].script)[1])))
        tx['gasPrice'] = BigNumberEthers.from(hexlify(decodeCInt(bitcoinjs.script.decompile(btcDecodedRawTx.outs[0].script)[2])))
        tx['data'] = bitcoinjs.script.decompile(btcDecodedRawTx.outs[0].script)[3].toString("hex")
    }
    return tx
}

export function computeAddress(key: BytesLike | string, compressed?: boolean): string {
    const publicKey = computePublicKey(key, compressed);
    return computeAddressFromPublicKey(publicKey);
}

export function computeAddressFromPublicKey(publicKey: string): string {
    if (!publicKey.startsWith("0x")) {
        publicKey = "0x" + publicKey;
    }
    const sha256Hash = sha256().update(publicKey.split("0x")[1], "hex").digest("hex")
    const prefixlessAddress = ripemd160().update(sha256Hash, "hex").digest("hex")
    return getAddress(`0x${prefixlessAddress}`);
}

export function checkTransactionType(tx: TransactionRequest): CheckTransactionType {
    if (!!tx.to === false && (!!tx.value === false || BigNumberEthers.from(tx.value).toNumber() === 0) && !!tx.data === true) {
        const needed = new BigNumber(satoshiToQtum(tx.gasPrice)).times(BigNumberEthers.from(tx.gasLimit).toNumber()).toFixed(8).toString()
        return { transactionType: GLOBAL_VARS.CONTRACT_CREATION, neededAmount: needed }
    }
    else if (!!tx.to === false && BigNumberEthers.from(tx.value).toNumber() > 0 && !!tx.data === true) {
        return { transactionType: GLOBAL_VARS.DEPLOY_ERROR, neededAmount: "0" }
    }
    else if (!!tx.to === true && !!tx.data === true) {
        const needed = !!tx.value === true ? 
            new BigNumber(
                new BigNumber(satoshiToQtum(tx.gasPrice)).toFixed(8))
                    .times(BigNumberEthers.from(tx.gasLimit).toNumber())
                    .plus(satoshiToQtum(tx.value)).toFixed(8) :
            new BigNumber(new BigNumber(satoshiToQtum(tx.gasPrice)).toFixed(8))
                .times(BigNumberEthers.from(tx.gasLimit).toNumber()).toFixed(8)
        return { transactionType: GLOBAL_VARS.CONTRACT_CALL, neededAmount: needed }
    }
    else {
        const gas = new BigNumber(satoshiToQtum(tx.gasPrice)).times(BigNumberEthers.from(tx.gasLimit).toNumber());
        const needed = new BigNumber(satoshiToQtum(tx.value)).plus(gas).toFixed(8);
        logger.info("tx.value: ", tx.value, " => ", gas.toString(), " => ", needed)
        return { transactionType: GLOBAL_VARS.P2PKH, neededAmount: needed }
    }
}

export async function serializeTransaction(utxos: Array<any>, fetchUtxos: Function, neededAmount: string, tx: TransactionRequest, transactionType: number, privateKey: string, publicKey: string, filterDust: boolean): Promise<string> {
    const signer = (hash: Uint8Array) => {
        return secp256k1Sign(hash, arrayify(privateKey));
    };
    return await serializeTransactionWith(utxos, fetchUtxos, neededAmount, tx, transactionType, signer, publicKey, filterDust);
}

export async function serializeTransactionWith(utxos: Array<any>, fetchUtxos: Function, neededAmount: string, tx: TransactionRequest, transactionType: number, signer: Function, publicKey: string, filterDust: boolean): Promise<string> {
    // Building the QTUM tx that will eventually be serialized.
    let qtumTx: Tx = { version: 2, locktime: 0, vins: [], vouts: [] };
    // reduce precision in gasPrice to 1 satoshi
    tx.gasPrice = tx.gasPrice;
    // tx.gasPrice = dropPrecisionLessThanOneSatoshi(BigNumberEthers.from(tx.gasPrice).toString());
    // in ethereum, the way to send your entire balance is to solve a simple equation:
    // amount to send in wei = entire balance in wei - (gas limit * gas price)
    // in order to properly be able to spend all UTXOs we need compute
    // we need to filter outputs that are dust
    // something is considered dust
    checkLostPrecisionInGasPrice(BigNumberEthers.from(tx.gasPrice).toNumber());
    // 40 satoshi gasPrice => 400 satoshi/byte which is the minimum relay fee
    const satoshiPerByte = BigNumberEthers.from(tx.gasPrice).mul(10);

    const gas = BigNumberEthers.from(BigNumberEthers.from(tx.gasPrice).mul(BigNumberEthers.from(tx.gasLimit).toNumber()).toString());
    const nonContractTx = transactionType === GLOBAL_VARS.P2PKH;
    const a = new BigNumber(neededAmount + `e+8`).toString();
    const b = new BigNumber(neededAmount + `e+8`).toNumber();
    logger.info("aaaaaaaaaaaa", a, 'bbbbbbbbbbbbb', b)
    let neededAmountBN = BigNumberEthers.from(a);
    const neededAmountMinusGasBN = nonContractTx ? neededAmountBN.sub(gas) : neededAmountBN;
    const spendableUtxos = filterUtxos(utxos, satoshiPerByte, filterDust);

    const vouts: any = [];
    let needChange = true;
    if (transactionType === GLOBAL_VARS.CONTRACT_CREATION) {
        const contractCreateVout = getContractVout(
            BigNumberEthers.from(tx.gasPrice).toNumber(),
            BigNumberEthers.from(tx.gasLimit).toNumber(),
            // @ts-ignore
            tx.data,
            "",
            // OP_CREATE cannot send QTUM when deploying contract
            new BigNumber(BigNumberEthers.from("0x0").toNumber() + `e-8`).toFixed(8),
        );
        vouts.push(contractCreateVout);
        qtumTx.vouts.push(contractCreateVout);
    } else if (transactionType === GLOBAL_VARS.CONTRACT_CALL) {
        const contractVoutValue = !!tx.value === true ?
            new BigNumber(satoshiToQtum(tx.value)).toNumber() :
            new BigNumber(BigNumberEthers.from("0x0").toNumber() + `e-8`).toFixed(8);
        const contractCallVout = getContractVout(
            BigNumberEthers.from(tx.gasPrice).toNumber(),
            BigNumberEthers.from(tx.gasLimit).toNumber(),
            // @ts-ignore
            tx.data,
            tx.to,
            contractVoutValue,
        );
        vouts.push(contractCallVout);
        qtumTx.vouts.push(contractCallVout);
    } else if (transactionType === GLOBAL_VARS.P2PKH) {
        // need to correct neededAmount
        // check if sending all
        let inputsAmount = BigNumberEthers.from(0);
        let i = 0;
        for (i = 0; i < spendableUtxos.length; i++) {
            const spendableUtxo = spendableUtxos[i];
            // investigate issue where amount has no decimal point as calculation panics
            // @ts-ignore
            const amount = spendableUtxo.amountNumber;
            const utxoValue = parseFloat(shiftBy(amount, 8));
            inputsAmount = inputsAmount.add(utxoValue);
        }

        needChange = !inputsAmount.eq(neededAmountBN);
        if (needChange) {
            neededAmountBN = neededAmountMinusGasBN;
            const a = neededAmount;
            neededAmount = satoshiToQtum(neededAmountBN);
            logger.info("neededAmount:::::", a, " => ", neededAmount);
        }
        if (!neededAmountBN.eq(BigNumberEthers.from(0))) {
            // no need to generate an empty UTXO and clog the blockchain
            vouts.push('p2pkh')
        }
    } else if (transactionType === GLOBAL_VARS.DEPLOY_ERROR) {
        // user requested sending QTUM with OP_CREATE which will result in the QTUM being lost
        throw new Error("Cannot send QTUM to contract when deploying a contract");
    } else {
        throw new Error("Internal error: unknown transaction type: " + transactionType);
    }

    // @ts-ignore
    const hash160PubKey = tx.from.split("0x")[1];

    // @ts-ignore
    let vins, amounts, availableAmount, fee, changeAmount, changeType;
    try {
        // @ts-ignore
        [vins, amounts, availableAmount, fee, changeAmount, changeType] = await addVins(
            vouts,
            spendableUtxos,
            neededAmount,
            needChange,
            satoshiPerByte.toString(),
            hash160PubKey,
        );
    } catch (e) {
        if (!neededAmountBN.eq(neededAmountMinusGasBN) || ((typeof e.message) === 'string' && e.message.indexOf('more satoshi') === -1)) {
            throw e;
        }
        // needs more satoshi, provide more inputs
        // we probably need to filter dust here since the above non-filtered dust failed, there should be more inputs here
        const allSpendableUtxos = filterUtxos(await fetchUtxos(), satoshiPerByte, filterDust);
        const neededAmountMinusGas = satoshiToQtum(neededAmountMinusGasBN);
        // @ts-ignore
        [vins, amounts, availableAmount, fee, changeAmount, changeType] = await addVins(
            vouts,
            allSpendableUtxos,
            neededAmountMinusGas,
            needChange,
            satoshiPerByte.toString(),
            hash160PubKey,
        );
    }

    if (vins.length === 0) {
        throw new Error("Couldn't find any vins");
    }

    qtumTx.vins = vins;

    if (transactionType === GLOBAL_VARS.P2PKH) {
        // @ts-ignore
        const hash160Address = tx.to.split("0x")[1];
        let value: number;
        if (changeAmount) {
            // not using all
            value = new BigNumber(BigNumberEthers.from(tx.value).toNumber()).toNumber()
        } else {
            value = new BigNumber(availableAmount).toNumber();
        }

        if (value != 0) {
            const p2pkhVout = {
                script: p2pkhScript(Buffer.from(hash160Address, "hex")),
                value: value
            };
            qtumTx.vouts.push(p2pkhVout);
        }
    }

    // add change if needed
    if (changeAmount) {
        qtumTx.vouts.push({
            // @ts-ignore
            script: scriptMap[changeType](Buffer.from(hash160PubKey, "hex")),
            value: changeAmount.toNumber()
        })
    }

    // Sign necessary vins
    const updatedVins = [];
    for (let i = 0; i < qtumTx.vins.length; i++) {
        updatedVins.push({ ...qtumTx.vins[i], ['scriptSig']: p2pkhScriptSig(await signp2pkhWith(qtumTx, i, signer), publicKey.split("0x")[1]) })
    }
    qtumTx.vins = updatedVins
    // Build the serialized transaction string.
    const serialized = txToBuffer(qtumTx).toString('hex');
    return serialized;
}

function filterUtxos(utxos: Array<any>, satoshiPerByte: BigNumberish, filterDust: boolean): Array<any> {
    for (let i = 0; i < utxos.length; i++) {
        // @ts-ignore
        utxos[i].amountNumber = parseFloat(parseFloat(utxos[i].amount).toFixed(8));
    }
    return utxos.filter((utxo) => {
        if (utxo.safe === undefined || !utxo.safe) {
            // unsafe to spend utxo
            return false;
        }
        if (filterDust) {
            // @ts-ignore
            const utxoValue = parseFloat(utxo.amountNumber + `e+8`);
            const minimumValueToNotBeDust = getMinNonDustValue(utxo, satoshiPerByte);
            logger.info("filterDust?", utxo.amountNumber, " => ", utxoValue, " => ", minimumValueToNotBeDust, " => ", utxoValue >= minimumValueToNotBeDust)
            return utxoValue >= minimumValueToNotBeDust;
        } else {
            logger.info("not filtering dust")
        }
        return true;
    });
}