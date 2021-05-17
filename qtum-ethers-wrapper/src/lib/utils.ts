import { encode as encodeVaruint } from 'varuint-bitcoin';
import { encode } from 'bip66';
import { OPS } from "./helpers/opcodes";
import { BufferCursor } from './helpers/buffer-cursor';
import { ecdsaSign } from 'secp256k1';
import bitcoinjs = require("bitcoinjs-lib");
import { encode as encodeCInt } from "bitcoinjs-lib/src/script_number"
import { sha256 } from "hash.js"
const toBuffer = require('typedarray-to-buffer')
import { BigNumber } from "bignumber.js"
import {
    arrayify
} from "ethers/lib/utils";
export interface ListUTXOs {
    address: string,
    txid: string,
    vout: number,
    amount: string,
    safe: boolean,
    spendable: boolean,
    solvable: boolean,
    label: string,
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
function cloneBuffer(buffer: Buffer) {
    let result = Buffer.alloc(buffer.length);
    buffer.copy(result);
    return result;
}

function cloneTx(tx: any) {
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
function inputBytes(input: any) {
    var TX_INPUT_BASE = 32 + 4 + 1 + 4
    // var TX_INPUT_PUBKEYHASH = 107

    return TX_INPUT_BASE + (input.scriptSig ? input.scriptSig.length : input.script.length)
}

function outputBytes(output: any) {
    var TX_OUTPUT_BASE = 8 + 1
    var TX_OUTPUT_PUBKEYHASH = 25
    return TX_OUTPUT_BASE + (output.script ? output.script.length : TX_OUTPUT_PUBKEYHASH)
}

// refer to https://en.bitcoin.it/wiki/Transaction#General_format_of_a_Bitcoin_transaction_.28inside_a_block.29
export function calcTxBytes(vins: Array<TxVinWithoutNullScriptSig | TxVinWithNullScriptSig>, vouts: Array<TxVout>) {
    const TX_EMPTY_SIZE = 4 + 1 + 1 + 4;
    return TX_EMPTY_SIZE +
        vins.reduce(function (a, x) { return a + inputBytes(x) }, 0) +
        vouts.reduce(function (a, x) { return a + outputBytes(x) }, 0)
}

export function txToBuffer(tx: any) {
    let buffer = Buffer.alloc(calcTxBytes(tx.vins, tx.vouts));
    let cursor = new BufferCursor(buffer);
    // version
    cursor.writeUInt32LE(tx.version);

    // vin length
    cursor.writeBytes(encodeVaruint(tx.vins.length));
    // vin
    for (let vin of tx.vins) {
        cursor.writeBytes(vin.hash);
        // Issue with using 4, needed 5
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
export function toDER(x: Buffer) {
    let i = 0;
    while (x[i] === 0) ++i;
    if (i === x.length) return Buffer.alloc(1);
    x = x.slice(i);
    if (x[0] & 0x80) return Buffer.concat([Buffer.alloc(1), x], 1 + x.length);
    return x;
}

// refer to: https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/src/script_signature.js
export function encodeSig(signature: Uint8Array, hashType: number) {
    const hashTypeMod = hashType & ~0x80;
    if (hashTypeMod <= 0 || hashTypeMod >= 4) throw new Error('Invalid hashType ' + hashType);

    const hashTypeBuffer = Buffer.from([hashType]);
    const bufferSignature = Buffer.from(signature);
    const r = toDER(bufferSignature.slice(0, 32));
    const s = toDER(bufferSignature.slice(32, 64));

    return Buffer.concat([encode(r, s), hashTypeBuffer]);
}


/////////////////////////////////////////

export function signp2pkh(tx: any, vindex: number, privKey: string, hashType = 0x01) {
    let clone = cloneTx(tx);
    // clean up relevant script
    let filteredPrevOutScript = clone.vins[vindex].script.filter((op: any) => op !== OPS.OP_CODESEPARATOR);
    // Uint8Array issue here
    clone.vins[vindex].script = toBuffer(filteredPrevOutScript);

    // zero out scripts of other inputs
    for (let i = 0; i < clone.vins.length; i++) {
        console.log(i, vindex)
        if (i === vindex) continue;
        clone.vins[i].script = Buffer.alloc(0);
    }
    console.log(clone, 'clone')
    // write to the buffer
    let buffer = txToBuffer(clone)
    // extend and append hash type
    buffer = Buffer.alloc(buffer.length + 4, buffer);
    // append the hash type
    buffer.writeUInt32LE(hashType, buffer.length - 4);

    // double-sha256
    let firstHash = sha256().update(buffer).digest();
    let secondHash = sha256().update(firstHash).digest();
    let sig = ecdsaSign(new Uint8Array(secondHash), arrayify(privKey));

    return encodeSig(sig.signature, hashType);
}
export function p2pkhScriptSig(sig: any, pubkey: any) {
    return bitcoinjs.script.compile([sig, Buffer.from(pubkey, 'hex')]);
}

// Refer to:
// https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/src/payments/p2pkh.js#L58
export function p2pkhScript(hash160PubKey: Buffer) {
    // prettier-ignore
    return bitcoinjs.script.compile([
        OPS.OP_DUP,
        OPS.OP_HASH160,
        hash160PubKey,
        OPS.OP_EQUALVERIFY,
        OPS.OP_CHECKSIG
    ]);
}

export function contractTxScript(contractAddress: string, gasLimit: number, gasPrice: number, encodedData: string) {
    // If contractAddress is missing, assume it's a create script, else assume its a call contract interaction
    if (contractAddress === "") {
        // console.log(bitcoinjs.script.toASM(Buffer.from("010114cca81b02942d8079a871e02ba03a3a4a8d7740d24c8b8a473044022038774a834bc0128366a5aba49e20d3b2774b30404670fd8be00e35794fbdd9a002205edb423e3d612b86c1d4a3c1cf7cf50543e7a8b1083bfc034102e2e2fc882a7c0141040674a4bcaba69378609e31faab1475bae52775da9ffc152e3008f7db2baa69abc1e8c4dcb46083ad56b73614d3eb01f717499c19510544a214f4db4a7c2ea503c4010403a0252601284cf2608060405234801561001057600080fd5b506040516020806100f2833981016040525160005560bf806100336000396000f30060806040526004361060485763ffffffff7c010000000000000000000000000000000000000000000000000000000060003504166360fe47b18114604d5780636d4ce63c146064575b600080fd5b348015605857600080fd5b5060626004356088565b005b348015606f57600080fd5b506076608d565b60408051918252519081900360200190f35b600055565b600054905600a165627a7a7230582049a087087e1fc6da0b68ca259d45a2e369efcbb50e93f9b7fa3e198de6402b810029c1", "hex")))
        // Issue here with OPS.OP_4 not compiling correctly, when Buffer is casted to string, the first 3 characters should be 010 instead of a 5.
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

export function reverse(src: Buffer) {
    var buffer = Buffer.alloc(src.length)

    for (var i = 0, j = src.length - 1; i <= j; ++i, --j) {
        buffer[i] = src[j]
        buffer[j] = src[i]
    }

    return buffer
}

export function generateContractAddress() {
    // 20 bytes
    // let buffer = Buffer.alloc(32);
    let uintBuff = Buffer.alloc(4);
    uintBuff.writeUInt32LE(0);
    console.log(uintBuff, "uintbff")
    let bufferAlt = Buffer.from("12c42f02875fd777737203ccb186e8e70f97f7ae9fcaba96996b0837a9e44710", "hex");
    console.log(bufferAlt, "ere")
    // bufferAlt.writeUInt32LE(0)
    // return bufferAlt.toString("hex")
    // console.log(bufferAlt.toString("hex"), 'bufferAlt', bufferAlt.length)
    // let cursor = new BufferCursor(buffer);
    // cursor.writeBytes(Buffer.from("12c42f02875fd777737203ccb186e8e70f97f7ae9fcaba96996b0837a9e44710", "hex"));
    // cursor.writeUInt32LE(0);
    // console.log(buffer.toString("hex"), "bufferNorm")
    return Buffer.concat([uintBuff, bufferAlt]).toString("hex");
}

export function addVins(utxos: Array<ListUTXOs>, neededAmount: number | string, hash160PubKey: string): (Array<any>) {
    let balance = 0;
    let inputs = [];
    let amounts = [];
    for (let i = 0; i < utxos.length; i++) {
            balance += parseFloat(utxos[i].amount);
            inputs.push({ txid: Buffer.from(utxos[i].txid, 'hex'), vout: utxos[i].vout, hash: reverse(Buffer.from(utxos[i].txid, 'hex')), sequence: 0xffffffff, script: p2pkhScript(Buffer.from(hash160PubKey, "hex")), scriptSig: null });
            amounts.push(parseFloat(utxos[i].amount));
            if (balance >= neededAmount) {
                break;
            }
    }
    // amounts.reduce((a, b) => a + b, 0)
    return [inputs, amounts];
}

export function addContractVouts(gasPrice: number, gasLimit: number, data: string, address: string, amounts: Array<any>, neededAmount: string, hash160PubKey: string): (Array<any>) {
    let vouts = [];
    let networkFee = 0.002;
    let returnAmount = amounts.reduce((a, b) => a + b);
    vouts.push({
        script: p2pkhScript(Buffer.from(hash160PubKey, "hex")),
        value: new BigNumber(returnAmount).minus(neededAmount).minus(networkFee).times(1e8).toNumber()
    })
    vouts.push({
        script: contractTxScript(address === "" ? "" : address.split("0x")[1], gasLimit, gasPrice, data.split("0x")[1]),
        // script: Buffer.from("010403a0252601284cf2608060405234801561001057600080fd5b506040516020806100f2833981016040525160005560bf806100336000396000f30060806040526004361060485763ffffffff7c010000000000000000000000000000000000000000000000000000000060003504166360fe47b18114604d5780636d4ce63c146064575b600080fd5b348015605857600080fd5b5060626004356088565b005b348015606f57600080fd5b506076608d565b60408051918252519081900360200190f35b600055565b600054905600a165627a7a7230582049a087087e1fc6da0b68ca259d45a2e369efcbb50e93f9b7fa3e198de6402b810029c1", "hex"),
        value: 0
    })
    console.log(Buffer.from("010403a0252601284cf2608060405234801561001057600080fd5b506040516020806100f2833981016040525160005560bf806100336000396000f30060806040526004361060485763ffffffff7c010000000000000000000000000000000000000000000000000000000060003504166360fe47b18114604d5780636d4ce63c146064575b600080fd5b348015605857600080fd5b5060626004356088565b005b348015606f57600080fd5b506076608d565b60408051918252519081900360200190f35b600055565b600054905600a165627a7a7230582049a087087e1fc6da0b68ca259d45a2e369efcbb50e93f9b7fa3e198de6402b810029c1", "hex").length)
    return vouts;
}

export function addp2pkhVouts(hash160Address: string, amounts: Array<any>, neededAmount: string, hash160PubKey: string): (Array<any>) {
    let vouts = [];
    let networkFee = 0.002;
    let returnAmount = amounts.reduce((a, b) => a + b);
    vouts.push({
        script: p2pkhScript(Buffer.from(hash160Address, "hex")),
        value: new BigNumber(neededAmount).times(1e8).toNumber()
    })
    vouts.push({
        script: p2pkhScript(Buffer.from(hash160PubKey, "hex")),
        value: new BigNumber(returnAmount).minus(neededAmount).minus(networkFee).times(1e8).toNumber()
    })
    return vouts;
}