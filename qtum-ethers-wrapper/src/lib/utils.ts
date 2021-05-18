import { encode as encodeVaruint } from 'varuint-bitcoin';
import { encode } from 'bip66';
import { OPS } from "./helpers/opcodes";
import { BufferCursor } from './helpers/buffer-cursor';
import { ecdsaSign } from 'secp256k1';
import { encode as encodeCInt } from "bitcoinjs-lib/src/script_number"
import { sha256, ripemd160 } from "hash.js"
import { BigNumber } from "bignumber.js"
import {
    arrayify
} from "ethers/lib/utils";
import { Transaction } from "@ethersproject/transactions";
import { BigNumber as BigNumberEthers } from "ethers";
const toBuffer = require('typedarray-to-buffer')
const bitcoinjs = require("bitcoinjs-lib");
const utxoDecoder = require("@crypto-hex-decoder/utxo");
import { decode } from "./helpers/hex-decoder";
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
        if (i === vindex) continue;
        clone.vins[i].script = Buffer.alloc(0);
    }
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

export function generateContractAddress(rawTx: string) {
    let buffer = Buffer.alloc(32 + 4);
    let cursor = new BufferCursor(buffer);
    cursor.writeBytes(reverse(Buffer.from("af6d980f8fb0e067a730736d51c651f88e29c299d1d7c760beea3d36bc71690d", "hex")));
    cursor.writeUInt32LE(1);
    let firstHash = sha256().update(buffer.toString("hex"), "hex").digest("hex");
    let secondHash = ripemd160().update(firstHash).digest("hex");
    console.log(firstHash, 'firstHash', secondHash, 'secondHash')
    return secondHash;
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
        value: 0
    })
    return vouts;
}

export function addp2pkhVouts(hash160Address: string, amounts: Array<any>, neededAmount: string, hash160PubKey: string): (Array<any>) {
    let vouts = [];
    let networkFee = 0.002;
    let returnAmount = amounts.reduce((a, b) => a + b);
    vouts.push({
        script: p2pkhScript(Buffer.from(hash160PubKey, "hex")),
        value: new BigNumber(returnAmount).minus(neededAmount).minus(networkFee).times(1e8).toNumber()
    })
    vouts.push({
        script: p2pkhScript(Buffer.from(hash160Address, "hex")),
        value: new BigNumber(neededAmount).times(1e8).toNumber()
    })
    return vouts;
}

export function parseSignedTransaction(transaction: string) {
    let tx: Transaction = {
        hash: "",
        to: "",
        from: "",
        nonce: 1,
        gasLimit: BigNumberEthers.from("0x28"),
        gasPrice: BigNumberEthers.from("0x28"),
        data: "",
        value: BigNumberEthers.from("0x28"),
        chainId: 81,
    };
    // Set hash (double sha256 of raw TX string)
    const sha256HashFirst = sha256().update(transaction, "hex").digest("hex")
    const sha256HashSecond = reverse(Buffer.from(sha256().update(sha256HashFirst, "hex").digest("hex"), "hex")).toString("hex")
    tx['hash'] = `0x${sha256HashSecond}`

    // tx['from'] = 
    // Hacky way to find out if TX contains contract creation, call, or P2PKH (needs to be refined)
    // Check the outputs for 0 values (creation or call, count items in ASM format) - note: OP_CREATE & OP_CALL are not recognized, thus the logic for figuring out call vs contract is to 
    // count ASM items (4 for creation, OP_4, gasLimit, gasPrice, byteCode), (5 for call, OP_4, gasLimit, gasPrice, data, contractAddress)
    // const btcEncodedRawTx = "02000000024ef16d31536aaa9a0926bcc921324625fabc0a8444b590fe7c42a3cb6985a9f6000000008b483045022100fcf284d1948c87276ad0bd97fd6279fdb96d249abdfbfc0354061ee12f77c1cb02207946fb5a293a9a30685f72e0fea9cf2e0dc447e059dbbce37bc67112887876d30141040674a4bcaba69378609e31faab1475bae52775da9ffc152e3008f7db2baa69abc1e8c4dcb46083ad56b73614d3eb01f717499c19510544a214f4db4a7c2ea503ffffffff4f57d182c55d3a3130e5f4222423b35ce36c2cc67bd03ef4e4e5419abd485a17000000008a473044022044fb2d2f5c81f1f2cd241e500e14974968e5ab7b32f95eaac55c08b259904e6702206b4c93eed33a62124e18f683b39430b3862460ca5812a3d5fc0ed4469584a3d10141040674a4bcaba69378609e31faab1475bae52775da9ffc152e3008f7db2baa69abc1e8c4dcb46083ad56b73614d3eb01f717499c19510544a214f4db4a7c2ea503ffffffff02c0a6c104000000001976a914cca81b02942d8079a871e02ba03a3a4a8d7740d288ac0000000000000000fc5403c0c62d01284cf2608060405234801561001057600080fd5b506040516020806100f2833981016040525160005560bf806100336000396000f30060806040526004361060485763ffffffff7c010000000000000000000000000000000000000000000000000000000060003504166360fe47b18114604d5780636d4ce63c146064575b600080fd5b348015605857600080fd5b5060626004356088565b005b348015606f57600080fd5b506076608d565b60408051918252519081900360200190f35b600055565b600054905600a165627a7a7230582049a087087e1fc6da0b68ca259d45a2e369efcbb50e93f9b7fa3e198de6402b810029c100000000";
    // const btcDecodedRawTx = decode(btcEncodedRawTx);
    // console.log(btcDecodedRawTx.outs.filter((i: any) => i.value === 0), "first")
    // console.log("Decoded transaction : " + JSON.stringify(btcDecodedRawTx));
    // tx['to'] = 
    return tx
}