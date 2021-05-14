"use strict";
// const varuint = require('varuint-bitcoin');
// const pushdata = require('pushdata-bitcoin');
// const bip66 = require('bip66');
// import { OPS } from "./helpers/opcodes"
// const BufferCursor = require('./buffer-cursor');
// const bs58check = require('bs58check');
// const secp256k1 = require('secp256k1');
// import bitcoinjs = require("bitcoinjs-lib");
// import { sha256 } from "hash.js"
// const toBuffer = require('typedarray-to-buffer')
// export interface TxVinWithNullScriptSig {
//     txid: Buffer,
//     hash: Buffer,
//     vout: number,
//     sequence: number,
//     script: Buffer,
//     scriptSig: null
// }
// export interface TxVinWithoutNullScriptSig {
//     txid: Buffer,
//     hash: Buffer,
//     vout: number,
//     sequence: number,
//     script: Buffer,
//     scriptSig: Buffer
// }
// export interface CloneTxVin {
//     txid: Buffer,
//     hash: Buffer,
//     vout: number,
//     sequence: number,
//     script: Buffer,
//     scriptSig: null
// }
// export interface TxVout {
//     script: Buffer,
//     value: number,
// }
// export interface CloneTx {
//     version: number,
//     locktime: number,
//     vins: Array<TxVinWithNullScriptSig | TxVinWithoutNullScriptSig>,
//     vouts: Array<TxVout>
// }
// export interface Tx {
//     version: number,
//     locktime: number,
//     vins: Array<TxVinWithNullScriptSig | TxVinWithoutNullScriptSig>,
//     vouts: Array<TxVout>
// }
// function cloneBuffer(buffer: Buffer) {
//     let result = Buffer.alloc(buffer.length);
//     buffer.copy(result);
//     return result;
// }
// function cloneTx(tx: Tx) {
//     let result: CloneTx = { version: tx.version, locktime: tx.locktime, vins: [], vouts: [] };
//     for (let vin of tx.vins) {
//         result.vins.push({
//             txid: cloneBuffer(vin.txid),
//             vout: vin.vout,
//             hash: cloneBuffer(vin.hash),
//             sequence: vin.sequence,
//             script: cloneBuffer(vin.script),
//             scriptSig: null
//         });
//     }
//     for (let vout of tx.vouts) {
//         result.vouts.push({
//             script: cloneBuffer(vout.script),
//             value: vout.value,
//         });
//     }
//     return result;
// }
// // refer to https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/src/script.js#L35
// // check type on chunks here
// // function compileScript(chunks: any) {
// //     function asMinimalOP(buffer: any) {
// //         if (buffer.length === 0) return OPS.OP_0;
// //         if (buffer.length !== 1) return;
// //         if (buffer[0] >= 1 && buffer[0] <= 16) return OPS.OP_RESERVED + buffer[0];
// //         if (buffer[0] === 0x81) return OPS.OP_1NEGATE;
// //     }
// //     let bufferSize = chunks.reduce((accum: any, chunk: any) => {
// //         // data chunk
// //         if (Buffer.isBuffer(chunk)) {
// //             // adhere to BIP62.3, minimal push policy
// //             if (chunk.length === 1 && asMinimalOP(chunk) !== undefined) {
// //                 return accum + 1;
// //             }
// //             return accum + pushdata.encodingLength(chunk.length) + chunk.length;
// //         }
// //         // opcode
// //         return accum + 1;
// //     }, 0.0);
// //     let buffer = Buffer.alloc(bufferSize);
// //     let offset = 0;
// //     chunks.forEach((chunk: any) => {
// //         // data chunk
// //         if (Buffer.isBuffer(chunk)) {
// //             // adhere to BIP62.3, minimal push policy
// //             const opcode = asMinimalOP(chunk);
// //             if (opcode !== undefined) {
// //                 buffer.writeUInt8(opcode, offset);
// //                 offset += 1;
// //                 return;
// //             }
// //             offset += pushdata.encode(buffer, chunk.length, offset);
// //             chunk.copy(buffer, offset);
// //             offset += chunk.length;
// //             // opcode
// //         } else {
// //             buffer.writeUInt8(chunk, offset);
// //             offset += 1;
// //         }
// //     });
// //     if (offset !== buffer.length) throw new Error('Could not decode chunks');
// //     return buffer;
// // }
// // // refer to https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/src/address.js
// // function fromBase58Check(address: string) {
// //     let payload = bs58check.decode(address);
// //     let version = payload.readUInt8(0);
// //     let hash = payload.slice(1);
// //     return { version, hash };
// // }
// // refer to https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/src/address.js
// // function toBase58Check(privKey, version = 0x6f) {
// //   let buffer = Buffer.alloc(21);
// //   buffer.writeInt8(version);
// //   hash160(secp256k1.publicKeyCreate(privKey)).copy(buffer, 1);
// //   return bs58check.encode(buffer);
// // }
// // refer to https://en.bitcoin.it/wiki/Transaction#General_format_of_a_Bitcoin_transaction_.28inside_a_block.29
// export function calcTxBytes(vins: Array<TxVinWithoutNullScriptSig | TxVinWithNullScriptSig>, vouts: Array<TxVout>) {
//     return (
//         1 + // version
//         varuint.encodingLength(vins.length) +
//         vins
//             .map(vin => (vin.scriptSig !== null ? vin.scriptSig.length : vin.script.length))
//             .reduce((sum, len) => sum + 40 + varuint.encodingLength(len) + len, 0) +
//         varuint.encodingLength(vouts.length) +
//         vouts
//             .map(vout => vout.script.length)
//             .reduce((sum, len) => sum + 8 + varuint.encodingLength(len) + len, 0) +
//         0 // locktime
//     );
// }
// export function txToBuffer(tx: CloneTx) {
//     let buffer = Buffer.alloc(calcTxBytes(tx.vins, tx.vouts));
//     let cursor = new BufferCursor(buffer);
//     // version
//     cursor.writeInt32LE(tx.version);
//     // vin length
//     cursor.writeBytes(varuint.encode(tx.vins.length));
//     // vin
//     for (let vin of tx.vins) {
//         cursor.writeBytes(vin.hash);
//         cursor.writeUInt32LE(vin.vout);
//         if (vin.scriptSig !== null) {
//             cursor.writeBytes(varuint.encode(vin.scriptSig.length));
//             cursor.writeBytes(vin.scriptSig);
//         } else {
//             cursor.writeBytes(varuint.encode(vin.script.length));
//             cursor.writeBytes(vin.script);
//         }
//         cursor.writeUInt32LE(vin.sequence);
//     }
//     // vout length
//     cursor.writeBytes(varuint.encode(tx.vouts.length));
//     // vouts
//     for (let vout of tx.vouts) {
//         cursor.writeUInt64LE(vout.value);
//         cursor.writeBytes(varuint.encode(vout.script.length));
//         cursor.writeBytes(vout.script);
//     }
//     // locktime
//     cursor.writeUInt32LE(tx.locktime);
//     return buffer;
// }
// // refer to: https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/src/script_signature.js
// export function toDER(x: Buffer) {
//     let i = 0;
//     while (x[i] === 0) ++i;
//     if (i === x.length) return Buffer.alloc(1);
//     x = x.slice(i);
//     if (x[0] & 0x80) return Buffer.concat([Buffer.alloc(1), x], 1 + x.length);
//     return x;
// }
// // refer to: https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/src/script_signature.js
// export function encodeSig(signature: Buffer, hashType: number) {
//     const hashTypeMod = hashType & ~0x80;
//     if (hashTypeMod <= 0 || hashTypeMod >= 4) throw new Error('Invalid hashType ' + hashType);
//     const hashTypeBuffer = Buffer.from([hashType]);
//     const r = toDER(signature.slice(0, 32));
//     const s = toDER(signature.slice(32, 64));
//     return Buffer.concat([bip66.encode(r, s), hashTypeBuffer]);
// }
// /////////////////////////////////////////
// export function signp2pkh(tx: Tx, vindex: number, privKey: string, hashType = 0x01) {
//     let clone: CloneTx = cloneTx(tx);
//     // clean up relevant script
//     let filteredPrevOutScript = clone.vins[vindex].script.filter(op => op !== OPS.OP_CODESEPARATOR);
//     // Uint8Array issue here
//     clone.vins[vindex].script = toBuffer(filteredPrevOutScript);
//     // zero out scripts of other inputs
//     for (let i = 0; i < clone.vins.length; i++) {
//         if (i === vindex) continue;
//         clone.vins[i].script = Buffer.alloc(0);
//     }
//     // write to the buffer
//     let buffer = txToBuffer(clone);
//     // extend and append hash type
//     buffer = Buffer.alloc(buffer.length + 4, buffer);
//     // append the hash type
//     buffer.writeInt32LE(hashType, buffer.length - 4);
//     // double-sha256
//     let firstHash = sha256().update(buffer, "hex").digest("hex")
//     let secondHash = sha256().update(firstHash, "hex").digest("hex");
//     // sign input
//     let sig = secp256k1.sign(secondHash, privKey);
//     // encode
//     return encodeSig(sig.signature, hashType);
// }
// // function p2pkhScriptSig(sig: any, pubkey: string) {
// //     return bitcoinjs.script.compile([sig, pubkey]);
// // }
// // Refer to:
// // https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/src/payments/p2pkh.js#L58
// export function p2pkhScript(hash160PubKey: Buffer) {
//     // prettier-ignore
//     return bitcoinjs.script.compile([
//         OPS.OP_DUP,
//         OPS.OP_HASH160,
//         hash160PubKey,
//         OPS.OP_EQUALVERIFY,
//         OPS.OP_CHECKSIG
//     ]);
// }
// export function encodeCInt(number: number) {
//     var value = Math.abs(number)
//     var size = scriptNumSize(value)
//     var buffer = Buffer.allocUnsafe(size)
//     var negative = number < 0
//     for (var i = 0; i < size; ++i) {
//         buffer.writeUInt8(value & 0xff, i)
//         value >>= 8
//     }
//     if (buffer[size - 1] & 0x80) {
//         buffer.writeUInt8(negative ? 0x80 : 0x00, size - 1)
//     } else if (negative) {
//         buffer[size - 1] |= 0x80
//     }
//     return buffer
// }
// export function scriptNumSize(i: number) {
//     return i > 0x7fffffff ? 5
//         : i > 0x7fffff ? 4
//             : i > 0x7fff ? 3
//                 : i > 0x7f ? 2
//                     : i > 0x00 ? 1
//                         : 0
// }
// export function contractTxScript(contractAddress: string, gasLimit: number, gasPrice: number, encodedData: string) {
//     // If contractAddress is missing, assume it's a create script, else assume its a call contract interaction
//     if (!!contractAddress) {
//         return bitcoinjs.script.compile([
//             OPS.OP_4,
//             encodeCInt(gasLimit),
//             encodeCInt(gasPrice),
//             Buffer.from(encodedData, "hex"),
//             OPS.OP_CREATE,
//         ])
//     } else {
//         return bitcoinjs.script.compile([
//             OPS.OP_4,
//             encodeCInt(gasLimit),
//             encodeCInt(gasPrice),
//             Buffer.from(encodedData, "hex"),
//             Buffer.from(contractAddress, "hex"),
//             OPS.OP_CALL,
//         ])
//     }
// }
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvbGliL3V0aWxzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQSw4Q0FBOEM7QUFDOUMsZ0RBQWdEO0FBQ2hELGtDQUFrQztBQUNsQywwQ0FBMEM7QUFDMUMsbURBQW1EO0FBQ25ELDBDQUEwQztBQUMxQywwQ0FBMEM7QUFDMUMsK0NBQStDO0FBQy9DLG1DQUFtQztBQUNuQyxtREFBbUQ7QUFFbkQsNENBQTRDO0FBQzVDLG9CQUFvQjtBQUNwQixvQkFBb0I7QUFDcEIsb0JBQW9CO0FBQ3BCLHdCQUF3QjtBQUN4QixzQkFBc0I7QUFDdEIsc0JBQXNCO0FBQ3RCLElBQUk7QUFFSiwrQ0FBK0M7QUFDL0Msb0JBQW9CO0FBQ3BCLG9CQUFvQjtBQUNwQixvQkFBb0I7QUFDcEIsd0JBQXdCO0FBQ3hCLHNCQUFzQjtBQUN0Qix3QkFBd0I7QUFDeEIsSUFBSTtBQUNKLGdDQUFnQztBQUNoQyxvQkFBb0I7QUFDcEIsb0JBQW9CO0FBQ3BCLG9CQUFvQjtBQUNwQix3QkFBd0I7QUFDeEIsc0JBQXNCO0FBQ3RCLHNCQUFzQjtBQUN0QixJQUFJO0FBRUosNEJBQTRCO0FBQzVCLHNCQUFzQjtBQUN0QixxQkFBcUI7QUFDckIsSUFBSTtBQUVKLDZCQUE2QjtBQUM3Qix1QkFBdUI7QUFDdkIsd0JBQXdCO0FBQ3hCLHVFQUF1RTtBQUN2RSwyQkFBMkI7QUFDM0IsSUFBSTtBQUNKLHdCQUF3QjtBQUN4Qix1QkFBdUI7QUFDdkIsd0JBQXdCO0FBQ3hCLHVFQUF1RTtBQUN2RSwyQkFBMkI7QUFDM0IsSUFBSTtBQUNKLHlDQUF5QztBQUN6QyxnREFBZ0Q7QUFDaEQsMkJBQTJCO0FBQzNCLHFCQUFxQjtBQUNyQixJQUFJO0FBRUosNkJBQTZCO0FBQzdCLGlHQUFpRztBQUNqRyxpQ0FBaUM7QUFDakMsNkJBQTZCO0FBQzdCLDJDQUEyQztBQUMzQyw4QkFBOEI7QUFDOUIsMkNBQTJDO0FBQzND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